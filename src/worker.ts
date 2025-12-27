import { runAction } from './engine.js';
import { resolveVariables, evaluateCondition } from './mapping-engine.js';
import { pool } from './db.js';
import { FlowDefinition, FlowStep } from './types.js';

interface ExecuteFlowArgs {
  runId?: string; // Optional: if provided, we assume the run record already exists
  flowId: string;
  userId: string;
  definition: FlowDefinition;
  triggerData?: any;
  onEvent?: (event: string, data: any) => void;
}

export async function executeFlow({ runId: initialRunId, flowId, userId, definition, triggerData, onEvent }: ExecuteFlowArgs) {
  const flowStartTime = Date.now();
  console.log(`[Executor] 🚀 Starting Flow: ${flowId} (RunId: ${initialRunId || 'new'})`);
  if (triggerData) console.log(`[Executor] 📦 Trigger Data:`, JSON.stringify(triggerData, null, 2));
  
  let runId = initialRunId;
  let context: any = { steps: { trigger: { data: triggerData } } };
  let lastStepIndex = -1;
  const logs: string[] = [];

  // 1. Resolve Run State
  if (runId) {
    const existingRunRes = await pool.query('SELECT * FROM flow_runs WHERE id = $1', [runId]);
    const existingRun = existingRunRes.rows[0];
    if (existingRun) {
        console.log(`[Executor] 🔄 Resuming existing run: ${runId} from index: ${existingRun.last_step_index}`);
        context = existingRun.current_context || context;
        lastStepIndex = existingRun.last_step_index ?? -1;
    }
  } else {
    // Fallback: Create a run record if not pre-created by scanner
    const runRes = await pool.query(
      'INSERT INTO flow_runs (flow_id, status, trigger_data, current_context, last_step_index) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [flowId, 'running', JSON.stringify(triggerData), JSON.stringify(context), -1]
    );
    runId = runRes.rows[0].id;
    console.log(`[Executor] 📝 Created new run record: ${runId}`);
  }

  if (onEvent) onEvent('flow-start', { flowId, runId });

  // Emit Trigger Events (Start -> Finish) for UI feedback
  if (onEvent && definition.trigger && definition.trigger.nodeId) {
      onEvent('step-run-start', { nodeId: definition.trigger.nodeId, status: 'running' });
      await new Promise(r => setTimeout(r, 400));
      onEvent('step-run-finish', {
          nodeId: definition.trigger.nodeId,
          status: 'success',
          output: triggerData || {},
          duration: 0
      });
  }

  async function executeStepList(steps: FlowStep[], startIndex: number = 0): Promise<'success' | 'failed' | 'waiting'> {
    for (let i = startIndex; i < steps.length; i++) {
      const step = steps[i];
      const stepStartTime = Date.now();
      
      if (steps === definition.steps && i <= lastStepIndex) {
        console.log(`[Executor] ⏭️ Skipping Step: ${step.name}`);
        continue;
      }

      console.log(`[Executor] ⚡ Executing Step: ${step.displayName || step.name} (${step.type || 'action'})`);
      logs.push(`[${new Date().toISOString()}] Executing Step: ${step.displayName || step.name}`);
      
      if (onEvent) {
          onEvent('step-run-start', { nodeId: step.name, status: 'running' });
      }
      
      try {
        if (!step.type || step.type === 'action') {
            const resolvedParams = resolveVariables(step.params, context);
            const result = await runAction({
              userId,
              service: step.piece!,
              actionName: step.action!,
              params: resolvedParams
            });
            context.steps[step.name] = { data: result };
            console.log(`[Executor] ✅ Action "${step.name}" success.`);
        } 
        else if (step.type === 'parallel') {
            console.log(`[Executor] 🌪️ Starting Parallel Block: ${step.name} (${step.branches?.length || 0} branches)`);
            const branchPromises = (step.branches || []).map((branch: FlowStep[]) => executeStepList(branch, 0));
            const results = await Promise.all(branchPromises);
            
            console.log(`[Executor] 🌪️ Parallel Block "${step.name}" branches complete results:`, results);
            if (results.includes('waiting')) return 'waiting';
            if (results.includes('failed')) return 'failed';

            context.steps[step.name] = { data: { status: 'parallel-complete' } };
        }
        else if (step.type === 'condition') {
            const isTrue = evaluateCondition(step.condition || 'false', context);
            console.log(`[Executor] ⚖️ Condition "${step.name}" evaluated to: ${isTrue}`);
            const branchToRun = isTrue ? step.onTrue : step.onFalse;
            if (branchToRun) {
                const bStatus = await executeStepList(branchToRun, 0);
                if (bStatus !== 'success') return bStatus;
            }
            context.steps[step.name] = { data: { result: isTrue } };
        }
        else if (step.type === 'loop') {
            const items = resolveVariables(step.params?.items, context);
            console.log(`[Executor] 🔄 Starting Loop "${step.name}" with ${items?.length || 0} items`);
            
            if (Array.isArray(items)) {
                for (let j = 0; j < items.length; j++) {
                    console.log(`[Executor] 🔄 Loop "${step.name}" Iteration ${j+1}/${items.length}`);
                    context.loop_index = j;
                    context.loop_item = items[j];
                    const lStatus = await executeStepList(step.branches?.[0] || [], 0);
                    if (lStatus !== 'success') return lStatus;
                }
            }
            context.steps[step.name] = { data: { iterations: items?.length || 0 } };
            console.log(`[Executor] 🔄 Loop "${step.name}" complete.`);
        }
        else if (step.type === 'wait') {
            console.log(`[Executor] ⏸️ Flow is WAITING at: ${step.name}`);
            logs.push(`[${new Date().toISOString()}] ⏸️ Step "${step.name}" triggered a WAIT.`);
            
            const currentTopIndex = steps === definition.steps ? i : lastStepIndex;
            await pool.query(
                'UPDATE flow_runs SET status = \'waiting\', logs = $1, current_context = $2, last_step_index = $3 WHERE id = $4',
                [JSON.stringify(logs), JSON.stringify(context), currentTopIndex, runId] 
            );
            
            if (onEvent) onEvent('run-waiting', { runId, stepName: step.name });
            return 'waiting'; 
        }

        const duration = Date.now() - stepStartTime;
        const currentTopIndex = steps === definition.steps ? i : lastStepIndex;
        await pool.query(
          'UPDATE flow_runs SET logs = $1, result = $2, current_context = $3, last_step_index = $4, status = \'running\' WHERE id = $5',
          [JSON.stringify(logs), JSON.stringify(context.steps), JSON.stringify(context), currentTopIndex, runId]
        );

        if (onEvent) {
            onEvent('step-run-finish', {
                nodeId: step.name,
                status: 'success',
                output: context.steps[step.name]?.data || {},
                duration
            });
        }

      } catch (stepError: any) {
        const errorDetail = (stepError as any).response?.data 
          ? JSON.stringify((stepError as any).response.data) 
          : (stepError as any).message;
        
        console.error(`[Executor] ❌ FAILED Step: ${step.name}. Error:`, errorDetail);
        logs.push(`[${new Date().toISOString()}] ❌ FAILED at "${step.name}": ${errorDetail}`);
        
        const currentTopIndex = steps === definition.steps ? i - 1 : lastStepIndex;
        await pool.query(
          'UPDATE flow_runs SET status = $1, logs = $2, result = $3, current_context = $4, last_step_index = $5 WHERE id = $6',
          ['failed', JSON.stringify(logs), JSON.stringify(context.steps), JSON.stringify(context), currentTopIndex, runId]
        );
        
        if (onEvent) onEvent('step-failure', { stepName: step.name, error: errorDetail });
        if (onEvent) {
            onEvent('step-run-finish', {
                nodeId: step.name,
                status: 'error',
                output: { error: errorDetail },
                duration: Date.now() - stepStartTime
            });
        }
        return 'failed'; 
      }
    }
    return 'success';
  }

  try {
    const finalStatus = await executeStepList(definition.steps, 0);
    const totalDuration = Date.now() - flowStartTime;

    if (finalStatus === 'waiting') {
        console.log(`[Executor] 🏁 Flow paused (waiting). Duration: ${totalDuration}ms`);
        return { success: true, status: 'waiting', runId };
    }
    if (finalStatus === 'failed') {
        console.error(`[Executor] 🏁 Flow failed. Duration: ${totalDuration}ms`);
        if (onEvent) onEvent('run-complete', { flowId, runId, status: 'failed' });
        return { success: false, runId };
    }

    // Mark as success
    await pool.query(
      'UPDATE flow_runs SET status = $1, logs = $2, result = $3, current_context = $4, last_step_index = $5 WHERE id = $6',
      ['success', JSON.stringify(logs), JSON.stringify(context.steps), JSON.stringify(context), definition.steps.length - 1, runId]
    );
    
    if (onEvent) onEvent('flow-success', { flowId, runId });
    if (onEvent) onEvent('run-complete', { flowId, runId, status: 'success' });
    
    console.log(`[Executor] 🏁 Flow finished successfully. Duration: ${totalDuration}ms`);
    return { success: true, runId };

  } catch (error: any) {
    console.error(`[Executor] 💀 CRITICAL ERROR in flow ${flowId}:`, error.message);
    logs.push(`[${new Date().toISOString()}] 💀 CRITICAL ERROR: ${error.message}`);
    
    await pool.query(
      'UPDATE flow_runs SET status = $1, logs = $2, current_context = $3, last_step_index = $4 WHERE id = $5',
      ['failed', JSON.stringify(logs), JSON.stringify(context), lastStepIndex, runId]
    );

    if (onEvent) onEvent('run-complete', { flowId, runId, status: 'failed', error: error.message });
    return { success: false, error: error.message, runId };
  }
}
