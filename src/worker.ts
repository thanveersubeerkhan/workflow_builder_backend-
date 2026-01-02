import { runAction } from './engine.js';
import { resolveVariables, evaluateCondition } from './mapping-engine.js';
import { pool } from './db.js';
import { FlowDefinition, FlowStep } from './types.js';

interface ExecuteFlowArgs {
  runId?: string;
  flowId: string;
  userId: string;
  definition: FlowDefinition;
  triggerData?: Record<string, any>;
  onEvent?: (event: string, data: any) => void;
}

export async function executeFlow({ runId: initialRunId, flowId, userId, definition, triggerData, onEvent }: ExecuteFlowArgs) {
  const flowStartTime = Date.now();
  console.log(`[Executor] 🚀 Starting Flow: ${flowId} (RunId: ${initialRunId || 'new'})`);
  
  let runId = initialRunId;
  let context: any = { steps: { trigger: { data: triggerData || {} } }, waited_steps: {}, completed_steps: {} };
  
  if (definition.trigger?.nodeId) {
    context.steps[definition.trigger.nodeId] = { data: triggerData };
  }

  let lastStepIndex = -1;
  let logs: string[] = [];

  // 1. Resolve Run State
  if (runId) {
    const existingRunRes = await pool.query('SELECT * FROM flow_runs WHERE id = $1', [runId]);
    const existingRun = existingRunRes.rows[0];
    if (existingRun) {
        console.log(`[Executor] 🔄 Resuming existing run: ${runId}`);
        context = existingRun.current_context || { steps: { trigger: { data: existingRun.trigger_data } } };
        if (typeof context === 'string') try { context = JSON.parse(context); } catch(e) {}
        if (!context.waited_steps) context.waited_steps = {};
        if (!context.completed_steps) context.completed_steps = {};
        if (!context.steps) context.steps = { trigger: { data: existingRun.trigger_data || {} } };
        
        if (definition.trigger?.nodeId && !context.steps[definition.trigger.nodeId]) {
          context.steps[definition.trigger.nodeId] = { data: existingRun.trigger_data };
        }
        lastStepIndex = existingRun.last_step_index ?? -1;
        
        const dbLogs = existingRun.logs;
        if (dbLogs) {
            try {
                const parsed = typeof dbLogs === 'string' ? JSON.parse(dbLogs) : dbLogs;
                if (Array.isArray(parsed)) logs = [...parsed];
            } catch(e) {}
        }
    }
  } else {
    const runRes = await pool.query(
      'INSERT INTO flow_runs (flow_id, status, trigger_data, current_context, last_step_index) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [flowId, 'running', JSON.stringify(triggerData), JSON.stringify(context), -1]
    );
    runId = runRes.rows[0].id;
    console.log(`[Executor] 📝 Created new run record: ${runId}`);
  }

  // Safety Check
  if (!triggerData?.manual) {
      const flowCheck = await pool.query('SELECT is_active FROM flows WHERE id = $1', [flowId]);
      if (!flowCheck.rows[0]?.is_active) {
        console.log(`[Executor] 🛑 Aborting: Flow ${flowId} is no longer active.`);
        await pool.query('UPDATE flow_runs SET status = $1 WHERE id = $2', ['failed', runId]);
        if (onEvent) onEvent('flow-failed', { flowId, runId, error: 'Flow deactivated' });
        return;
      }
  }

  // Persistence Helper
  let updateQueue = Promise.resolve();
  const statusPriority: Record<string, number> = { 'pending': 0, 'running': 1, 'waiting': 2, 'rejected': 3, 'failed': 3, 'success': 3 };

  async function persistState(status: string = 'running', overrideIndex?: number) {
      const currentIndex = overrideIndex ?? lastStepIndex;
      const contextSnapshot = JSON.parse(JSON.stringify(context));
      const logsSnapshot = JSON.parse(JSON.stringify(logs));
      const resultsSnapshot = JSON.parse(JSON.stringify(context.steps));

      updateQueue = updateQueue.then(async () => {
          try {
              const currentStatusRes = await pool.query('SELECT status FROM flow_runs WHERE id = $1', [runId]);
              const dbStatus = currentStatusRes.rows[0]?.status || 'pending';
              const newPriority = statusPriority[status] ?? 0;
              const currentPriority = statusPriority[dbStatus] ?? 0;

              let finalStatus = status;
              if (currentPriority > newPriority) finalStatus = dbStatus;

              await pool.query(
                  'UPDATE flow_runs SET status = $1, logs = $2, current_context = $3, result = $4, last_step_index = $5 WHERE id = $6',
                  [finalStatus, JSON.stringify(logsSnapshot), JSON.stringify(contextSnapshot), JSON.stringify(resultsSnapshot), currentIndex, runId]
              );
          } catch (err: any) {
              console.error(`[Executor] ⚠️ DB Persist Failed`, err.message);
          }
      });
      return updateQueue;
  }

  if (onEvent) onEvent('flow-start', { flowId, runId });

  // Re-hydrate emission
  if (context.completed_steps && onEvent) {
      Object.keys(context.completed_steps).forEach(stepName => {
          if (context.steps[stepName]?.data && stepName !== 'trigger') {
              onEvent('step-run-finish', { nodeId: stepName, status: 'success', output: context.steps[stepName].data, duration: 0 });
          }
      });
  }
  
  // Trigger Emission
  if (onEvent && definition.trigger?.nodeId) {
      onEvent('step-run-start', { nodeId: definition.trigger.nodeId, status: 'running' });
      await new Promise(r => setTimeout(r, 400));
      onEvent('step-run-finish', { nodeId: definition.trigger.nodeId, status: 'success', output: triggerData || {}, duration: 0 });
  }

  async function executeStepList(steps: FlowStep[], startIndex: number = 0): Promise<'success' | 'failed' | 'waiting' | 'rejected'> {
    for (let i = startIndex; i < steps.length; i++) {
      const step = steps[i];
      const stepStartTime = Date.now();
      
      if (context.completed_steps && context.completed_steps[step.name]) {
        continue;
      }

      console.log(`[Executor] ⚡ Executing Step: ${step.displayName || step.name}`);
      logs.push(`[${new Date().toISOString()}] Executing Step: ${step.displayName || step.name}`);
      
      if (onEvent) onEvent('step-run-start', { nodeId: step.name, status: 'running' });
      
      try {
        if (!step.type || step.type === 'action') {
            const resolvedParams = resolveVariables(step.params, context);
            const result = await runAction({ userId, service: step.piece!, actionName: step.action!, params: resolvedParams });
            context.steps[step.name] = { data: result };
        } 
        else if (step.type === 'parallel') {
            console.log(`[Executor] 🌪️ Starting Parallel Block: ${step.name}`);
            const branchPromises = (step.branches || []).map((branch: FlowStep[]) => executeStepList(branch, 0));
            const results = await Promise.all(branchPromises);
            
            // Store Results Structure
            const successCount = results.filter(r => r === 'success').length;
             const branchOutputs = (step.branches || []).map((branch: FlowStep[]) => {
                const lastStep = branch[branch.length - 1];
                return lastStep ? context.steps[lastStep.name]?.data : null;
            });
            
            context.steps[step.name] = { 
                data: { status: 'parallel-complete', branchCount: step.branches?.length, successCount, branchResults: branchOutputs } 
            };
            if (!context.completed_steps) context.completed_steps = {};
            context.completed_steps[step.name] = true;

            const currentTopIndex = steps === definition.steps ? i : lastStepIndex;
            await persistState('running', currentTopIndex);

            // Handle Failures AFTER processing results
            if (results.includes('waiting')) {
                if (onEvent) onEvent('step-run-finish', { nodeId: step.name, status: 'success', output: { status: 'waiting-on-branch' }, duration: Date.now() - stepStartTime });
                return 'waiting';
            }
            if (results.includes('rejected')) {
                 if (onEvent) onEvent('step-run-finish', { nodeId: step.name, status: 'error', output: { error: 'Branch rejected' }, duration: Date.now() - stepStartTime });
                 return 'rejected';
            }
            if (results.includes('failed')) {
                 if (onEvent) onEvent('step-run-finish', { nodeId: step.name, status: 'error', output: { error: 'Branch failed' }, duration: Date.now() - stepStartTime });
                 return 'failed';
            }
        }
        else if (step.type === 'condition') {
            const isTrue = evaluateCondition(step.condition || 'false', context);
            const branchToRun = isTrue ? step.onTrue : step.onFalse;
            if (branchToRun) {
                const bStatus = await executeStepList(branchToRun, 0);
                if (bStatus !== 'success') {
                     if (onEvent) {
                         const status = bStatus === 'failed' ? 'error' : 'success';
                         onEvent('step-run-finish', { nodeId: step.name, status: status === 'error' ? 'error' : 'success', output: { status: bStatus }, duration: Date.now() - stepStartTime });
                     }
                     return bStatus;
                }
            }
            context.steps[step.name] = { data: { result: isTrue } };
            if (!context.completed_steps) context.completed_steps = {};
            context.completed_steps[step.name] = true;
            
            const currentTopIndex = steps === definition.steps ? i : lastStepIndex;
            await persistState('running', currentTopIndex);
        }
        else if (step.type === 'loop') {
            const items = resolveVariables(step.params?.items, context);
            if (Array.isArray(items)) {
                for (let j = 0; j < items.length; j++) {
                    context.loop_index = j;
                    context.loop_item = items[j];
                    const lStatus = await executeStepList(step.branches?.[0] || [], 0);
                    if (lStatus !== 'success') return lStatus;
                }
            }
            context.steps[step.name] = { data: { iterations: items?.length || 0 } };
            if (!context.completed_steps) context.completed_steps = {};
            context.completed_steps[step.name] = true;
        }
        else if (step.type === 'wait') {
            if (context.waited_steps && context.waited_steps[step.name]) {
                const waitState = context.waited_steps[step.name];
                if (waitState === 'rejected') {
                    context.steps[step.name] = { data: { status: 'rejected' } };
                    if (onEvent) onEvent('step-run-finish', { nodeId: step.name, status: 'error', output: { error: 'Rejected' }, duration: 0 });
                    return 'rejected';
                }
                delete context.waited_steps[step.name];
                if (!context.completed_steps) context.completed_steps = {};
                    context.completed_steps[step.name] = true;
                context.steps[step.name] = { data: { status: 'resumed' } };
                await persistState('running', lastStepIndex);
                continue; 
            }
            if (!context.waited_steps) context.waited_steps = {};
            context.waited_steps[step.name] = true;
            await persistState('waiting', lastStepIndex);
            if (onEvent) onEvent('run-waiting', { runId, stepName: step.name });
            return 'waiting'; 
        }

        const duration = Date.now() - stepStartTime;
        if (steps === definition.steps) lastStepIndex = i;
        const currentTopIndex = steps === definition.steps ? i : lastStepIndex;
        await persistState('running', currentTopIndex);

        if (!context.completed_steps) context.completed_steps = {};
        context.completed_steps[step.name] = true;

        if (onEvent) onEvent('step-run-finish', { nodeId: step.name, status: 'success', output: context.steps[step.name]?.data || {}, duration });

      } catch (stepError: any) {
        const errorDetail = (stepError as any).response?.data ? JSON.stringify((stepError as any).response.data) : (stepError as any).message;
        console.error(`[Executor] ❌ FAILED Step: ${step.name}`, errorDetail);
        logs.push(`[${new Date().toISOString()}] ❌ FAILED at "${step.name}": ${errorDetail}`);
        
        const currentTopIndex = steps === definition.steps ? i - 1 : lastStepIndex;
        await persistState('failed', currentTopIndex);
        
        if (onEvent) onEvent('step-failure', { stepName: step.name, error: errorDetail });
        if (onEvent) onEvent('step-run-finish', { nodeId: step.name, status: 'error', output: { error: errorDetail }, duration: Date.now() - stepStartTime });
        return 'failed'; 
      }
    }
    return 'success';
  }

  try {
    const startIndex = (lastStepIndex === -1) ? 0 : lastStepIndex;
    const finalStatus = await executeStepList(definition.steps, startIndex);
    
    if (finalStatus === 'waiting') {
        return { success: true, status: 'waiting', runId };
    }
    if (finalStatus === 'rejected') {
        await persistState('rejected');
        if (onEvent) onEvent('run-complete', { flowId, runId, status: 'rejected' });
        return { success: true, runId, status: 'rejected' };
    }
    if (finalStatus === 'failed') {
        await persistState('failed');
        if (onEvent) onEvent('run-complete', { flowId, runId, status: 'failed' });
        return { success: false, runId };
    }

    await persistState('success', definition.steps.length - 1);
    if (onEvent) onEvent('run-complete', { flowId, runId, status: 'success' });
    return { success: true, runId };

  } catch (error: any) {
    console.error(`[Executor] 💀 CRITICAL ERROR`, error.message);
    logs.push(`[${new Date().toISOString()}] 💀 CRITICAL ERROR: ${error.message}`);
    await persistState('failed');
    if (onEvent) onEvent('run-complete', { flowId, runId, status: 'failed', error: error.message });
    return { success: false, error: error.message, runId };
  }
}
