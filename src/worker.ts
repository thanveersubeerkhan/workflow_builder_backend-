import { runAction } from './engine.js';
import { resolveVariables, evaluateCondition } from './mapping-engine.js';
import { pool } from './db.js';
import { FlowDefinition, FlowStep } from './types.js';

interface ExecuteFlowArgs {
  runId?: string; // Optional: if provided, we assume the run record already exists
  flowId: string;
  userId: string;
  definition: FlowDefinition;
  triggerData?: Record<string, any>; // Changed type to explicitly be an object
  onEvent?: (event: string, data: any) => void;
}

export async function executeFlow({ runId: initialRunId, flowId, userId, definition, triggerData, onEvent }: ExecuteFlowArgs) {
  const flowStartTime = Date.now();
  console.log(`[Executor] 🚀 Starting Flow: ${flowId} (RunId: ${initialRunId || 'new'})`);
  console.log(`[Executor] 🛡️  Logic Engine Path: Persistence Guard v2.0 (Synchronized Queue)`);
  if (triggerData) console.log(`[Executor] 📦 Trigger Data:`, JSON.stringify(triggerData, null, 2));
  
  let runId = initialRunId;
  let context: any = { steps: { trigger: { data: triggerData || {} } }, waited_steps: {}, completed_steps: {} };
  
  // Add trigger output under its nodeId if available for consistent addressing
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
        console.log(`[Executor] 🔄 Resuming existing run: ${runId} from index: ${existingRun.last_step_index}`);
        
        // Load Context & Safety Init
        context = existingRun.current_context || { steps: { trigger: { data: existingRun.trigger_data } }, waited_steps: {} };
        if (typeof context === 'string') try { context = JSON.parse(context); } catch(e) {}
        if (!context.waited_steps) context.waited_steps = {};
        if (!context.completed_steps) context.completed_steps = {};
        if (!context.steps) context.steps = { trigger: { data: existingRun.trigger_data || {} } };
        
        // Ensure nodeId mapping is restored on resume
        if (definition.trigger?.nodeId && !context.steps[definition.trigger.nodeId]) {
          context.steps[definition.trigger.nodeId] = { data: existingRun.trigger_data };
        }
        
        lastStepIndex = existingRun.last_step_index ?? -1;
        
        // Load Logs
        const dbLogs = existingRun.logs;
        if (dbLogs) {
            try {
                const parsed = typeof dbLogs === 'string' ? JSON.parse(dbLogs) : dbLogs;
                if (Array.isArray(parsed)) logs = [...parsed];
            } catch(e: any) {
                console.error("[Executor] Log parse error:", e.message);
            }
        }
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

  // 1.5. Safety Check: Is flow still active? (Crucial for immediate stop)
  const flowCheck = await pool.query('SELECT is_active FROM flows WHERE id = $1', [flowId]);
  if (!flowCheck.rows[0]?.is_active) {
    console.log(`[Executor] 🛑 Aborting: Flow ${flowId} is no longer active.`);
    const abortLogs = ["[Executor] 🛑 Execution aborted: Flow is deactivated."];
    await pool.query(
        'UPDATE flow_runs SET status = $1, logs = $2 WHERE id = $3',
        ['failed', JSON.stringify(abortLogs), runId]
    );
    if (onEvent) onEvent('flow-failed', { flowId, runId, error: 'Flow deactivated' });
    return;
  }

  // --- Synchronized Persistence Helper ---
  let updateQueue = Promise.resolve();
  
  const statusPriority: Record<string, number> = {
      'pending': 0,
      'running': 1,
      'waiting': 2,
      'rejected': 3,
      'failed': 3,
      'success': 3
  };


  async function persistState(status: string = 'running', overrideIndex?: number) {
      const currentIndex = overrideIndex ?? lastStepIndex;
      
      // 1. Capture snapshots IMMEDIATELY (Deep clone to prevent mutation during queue wait)
      const contextSnapshot = JSON.parse(JSON.stringify(context));
      const logsSnapshot = JSON.parse(JSON.stringify(logs));
      const resultsSnapshot = JSON.parse(JSON.stringify(context.steps));

      updateQueue = updateQueue.then(async () => {
          try {
              // 2. Status Guard: Fetch current DB status to check precedence
              const currentStatusRes = await pool.query('SELECT status FROM flow_runs WHERE id = $1', [runId]);
              const dbStatus = currentStatusRes.rows[0]?.status || 'pending';

              // 🛡️ Precedence Rule: Only update status if the new one has higher or equal priority.
              const newPriority = statusPriority[status] ?? 0;
              const currentPriority = statusPriority[dbStatus] ?? 0;

              let finalStatus = status;
              if (currentPriority > newPriority) {
                  finalStatus = dbStatus;
              }

              console.log(`[Executor] 💾 Persisting State: Status=${finalStatus} (from ${status}), StepsCount=${Object.keys(contextSnapshot.steps).length}, Priority=${newPriority} vs DB Priority=${currentPriority}`);

              await pool.query(
                  'UPDATE flow_runs SET status = $1, logs = $2, current_context = $3, result = $4, last_step_index = $5 WHERE id = $6',
                  [finalStatus, JSON.stringify(logsSnapshot), JSON.stringify(contextSnapshot), JSON.stringify(resultsSnapshot), currentIndex, runId]
              );
              console.log(`[Executor] ✅ State Persisted successfully for ${runId}`);
          } catch (err: any) {
              console.error(`[Executor] ⚠️ DB Persist Failed for ${runId}:`, err.message);
          }
      });
      return updateQueue;
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

  async function executeStepList(steps: FlowStep[], startIndex: number = 0): Promise<'success' | 'failed' | 'waiting' | 'rejected'> {
    for (let i = startIndex; i < steps.length; i++) {
      const step = steps[i];
      const stepStartTime = Date.now();
      
      // 🚀 SKIP LOGIC: If step is already completed, don't run it again
      if (context.completed_steps && context.completed_steps[step.name]) {
        console.log(`[Executor] ⏭️ Skipping Step: ${step.name}${steps !== definition.steps ? ' (nested)' : ''}`);
        continue;
      }

      console.log(`[Executor] ⚡ Executing Step: ${step.displayName || step.name} (${step.type || 'action'})`);
      logs.push(`[${new Date().toISOString()}] Executing Step: ${step.displayName || step.name}`);
      
      if (onEvent) {
          onEvent('step-run-start', { nodeId: step.name, status: 'running' });
      }
      
      try {
        if (!step.type || step.type === 'action') {
            console.log(`[Executor] Resolving variables for action "${step.name}". Context keys: ${Object.keys(context.steps || {}).join(', ')}`);
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
            if (results.includes('rejected')) return 'rejected';

            // Store summary and combined outputs in parallel step data
            const successCount = results.filter(r => r === 'success').length;
            const branchOutputs = (step.branches || []).map((branch: FlowStep[]) => {
                const lastStep = branch[branch.length - 1];
                return lastStep ? context.steps[lastStep.name]?.data : null;
            });

            console.log(`[Executor] 🌪️ Parallel Block "${step.name}" summary: ${successCount}/${step.branches?.length} succeeded.`);
            
            context.steps[step.name] = { 
                data: { 
                    status: 'parallel-complete',
                    branchCount: step.branches?.length || 0,
                    successCount: successCount,
                    branchResults: branchOutputs
                } 
            };
            
            // Mark structural step as completed
            if (!context.completed_steps) context.completed_steps = {};
            context.completed_steps[step.name] = true;

            // Checkpoint: save parallel block result immediately
            const currentTopIndex = steps === definition.steps ? i : lastStepIndex;
            console.log(`[Executor] 🌪️ Saving Parallel Block result for ${step.name}...`);
            await persistState('running', currentTopIndex);
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

            // Mark structural step as completed
            if (!context.completed_steps) context.completed_steps = {};
            context.completed_steps[step.name] = true;

            // Checkpoint: save condition result immediately
            const currentTopIndex = steps === definition.steps ? i : lastStepIndex;
            await persistState('running', currentTopIndex);
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
            
            // Mark structural step as completed
            if (!context.completed_steps) context.completed_steps = {};
            context.completed_steps[step.name] = true;

            console.log(`[Executor] 🔄 Loop "${step.name}" complete.`);
        }
        else if (step.type === 'wait') {
            // Check if we already waited on this step and are now resuming
            if (context.waited_steps && context.waited_steps[step.name]) {
                const waitState = context.waited_steps[step.name];
                
                if (waitState === 'rejected') {
                    console.log(`[Executor] 🛑 WAIT step "${step.name}" was REJECTED. Stopping flow.`);
                    logs.push(`[${new Date().toISOString()}] 🛑 Step "${step.name}" was REJECTED by user.`);
                    context.steps[step.name] = { data: { status: 'rejected' } };
                    
                    if (onEvent) {
                        onEvent('step-run-finish', {
                            nodeId: step.name,
                            status: 'error',
                            output: { error: 'Rejected by user', status: 'rejected' },
                            duration: 0
                        });
                    }
                    return 'rejected'; // Stop execution here with explicit rejected status
                }

                console.log(`[Executor] ⏭️ Resuming past WAIT step: ${step.name}`);
                delete context.waited_steps[step.name];
                
                // Ensure it stays completed so we skip it if we re-run the tree
                if (!context.completed_steps) context.completed_steps = {};
                context.completed_steps[step.name] = true;
                
                context.steps[step.name] = { data: { status: 'resumed' } };
                
                // CRITICAL: Save resumption state IMMEDIATELY so we don't forget it
                await persistState('running', lastStepIndex);
                
                console.log(`[Executor] ✅ Wait "${step.name}" resumed. Continuing.`);
                continue; 
            }

            console.log(`[Executor] ⏸️ Flow is WAITING at: ${step.name}`);
            logs.push(`[${new Date().toISOString()}] ⏸️ Step "${step.name}" triggered a WAIT.`);
            
            // Mark this step as waiting (true means pending approval)
            if (!context.waited_steps) context.waited_steps = {};
            context.waited_steps[step.name] = true;
            
            await persistState('waiting', lastStepIndex);
            
            if (onEvent) onEvent('run-waiting', { runId, stepName: step.name });
            return 'waiting'; 
        }

        const duration = Date.now() - stepStartTime;
        const currentTopIndex = steps === definition.steps ? i : lastStepIndex;
        
        // Update local lastStepIndex so nested steps use the latest top-level progress
        if (steps === definition.steps) lastStepIndex = i;

        await persistState('running', currentTopIndex);

        // Mark as completed so we skip it on future resumes
        if (!context.completed_steps) context.completed_steps = {};
        context.completed_steps[step.name] = true;



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
        await persistState('failed', currentTopIndex);

        
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
    // 🚀 BEGIN EXECUTION: Start from precisely where we left off
    const startIndex = (lastStepIndex === -1) ? 0 : lastStepIndex;
    const finalStatus = await executeStepList(definition.steps, startIndex);
    const totalDuration = Date.now() - flowStartTime;

    if (finalStatus === 'waiting') {
        console.log(`[Executor] 🏁 Flow paused (waiting). Duration: ${totalDuration}ms`);
        return { success: true, status: 'waiting', runId };
    }
    if (finalStatus === 'rejected') {
        console.warn(`[Executor] 🏁 Flow rejected and stopped. Duration: ${totalDuration}ms`);
        await persistState('rejected');
        if (onEvent) onEvent('run-complete', { flowId, runId, status: 'rejected' });
        return { success: true, runId, status: 'rejected' };
    }
    if (finalStatus === 'failed') {
        console.error(`[Executor] 🏁 Flow failed. Duration: ${totalDuration}ms`);
        await persistState('failed');
        if (onEvent) onEvent('run-complete', { flowId, runId, status: 'failed' });
        return { success: false, runId };
    }

    // Mark as success
    await persistState('success', definition.steps.length - 1);
    
    if (onEvent) onEvent('flow-success', { flowId, runId });
    if (onEvent) onEvent('run-complete', { flowId, runId, status: 'success' });
    
    console.log(`[Executor] 🏁 Flow finished successfully. Duration: ${totalDuration}ms`);
    return { success: true, runId };

  } catch (error: any) {
    console.error(`[Executor] 💀 CRITICAL ERROR in flow ${flowId}:`, error.message);
    logs.push(`[${new Date().toISOString()}] 💀 CRITICAL ERROR: ${error.message}`);
    
    await persistState('failed');



    if (onEvent) onEvent('run-complete', { flowId, runId, status: 'failed', error: error.message });
    return { success: false, error: error.message, runId };
  }
}
