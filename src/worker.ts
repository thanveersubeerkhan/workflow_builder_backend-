import { runAction } from './engine.js';
import { resolveVariables } from './mapping-engine.js';
import { pool } from './db.js';
import { FlowDefinition } from './types.js';

interface ExecuteFlowArgs {
  flowId: string;
  userId: string;
  definition: FlowDefinition;
  triggerData?: any;
  onEvent?: (event: string, data: any) => void;
}

/**
 * Directly executes a flow step-by-step.
 * This is serverless-friendly as it doesn't rely on background workers.
 */
export async function executeFlow({ flowId, userId, definition, triggerData, onEvent }: ExecuteFlowArgs) {
  console.log(`[Executor] Starting Flow: ${flowId} for User: ${userId}`);
  console.log(`[Executor] Definition Trigger:`, JSON.stringify(definition.trigger));

  if (onEvent) onEvent('flow-start', { flowId, runId: null });

  // 1. Create a run record
  const runRes = await pool.query(
    'INSERT INTO flow_runs (flow_id, status) VALUES ($1, $2) RETURNING id',
    [flowId, 'running']
  );
  const runId = runRes.rows[0].id;
  if (onEvent) onEvent('run-created', { runId });

  const context: any = { steps: { trigger: { data: triggerData } } };
  const logs: string[] = [];

  // Emit Trigger Events (Start -> Finish) for UI feedback
  if (onEvent && definition.trigger && definition.trigger.nodeId) {
      console.log(`[Executor] Emitting Trigger Start for ${definition.trigger.nodeId}`);
      onEvent('step-run-start', {
          nodeId: definition.trigger.nodeId,
          status: 'running'
      });

      // Small delay to let the UI show "Processing..." state (visual feedback)
      await new Promise(r => setTimeout(r, 800));

      console.log(`[Executor] Emitting Trigger Success for ${definition.trigger.nodeId}`);
      onEvent('step-run-finish', {
          nodeId: definition.trigger.nodeId,
          status: 'success',
          output: triggerData || {},
          duration: 0
      });
  } else {
      console.log(`[Executor] Skipping Trigger Event. Trigger: ${!!definition.trigger}, NodeId: ${definition.trigger?.nodeId}`);
  }

  try {
    for (const step of definition.steps) {
      const stepStartTime = Date.now();
      logs.push(`[${new Date().toISOString()}] Executing Step: ${step.displayName || step.name} (${step.piece}.${step.action})`);
      
      if (onEvent) {
          onEvent('step-run-start', {
              nodeId: step.name, // Assuming step.name maps to nodeId or we need to look it up? definition.steps usually has ids or we need to ensure mapping. 
              // Actually step.name in definition might be the label or ID. Let's assume ID for now or Label. 
              // If step definition comes from flow-mapper, let's verify mapUIToDefinition later.
              // For now, let's assume step.name is the ID used in Frontend nodes.
              status: 'running' 
          });
      }
      
      try {
        const resolvedParams = resolveVariables(step.params, context);
        
        const result = await runAction({
          userId,
          service: step.piece,
          actionName: step.action,
          params: resolvedParams
        });

        context.steps[step.name] = { data: result };
        const duration = Date.now() - stepStartTime;
        logs.push(`[${new Date().toISOString()}] ✅ Successfully completed ${step.name} in ${duration}ms`);

        // Update DB after EVERY step for real-time progress
        await pool.query(
          'UPDATE flow_runs SET logs = $1, result = $2 WHERE id = $3',
          [JSON.stringify(logs), JSON.stringify(context.steps), runId]
        );

        if (onEvent) {
            onEvent('step-run-finish', {
                nodeId: step.name,
                status: 'success',
                output: result,
                duration
            });
        }

      } catch (stepError: any) {
        const errorDetail = (stepError as any).response?.data 
          ? JSON.stringify((stepError as any).response.data) 
          : (stepError as any).message;
        
        const failureLog = `❌ FAILED at Step: "${step.name}". Error: ${errorDetail}`;
        logs.push(`[${new Date().toISOString()}] ${failureLog}`);
        
        await pool.query(
          'UPDATE flow_runs SET status = $1, logs = $2, result = $3 WHERE id = $4',
          ['failed', JSON.stringify(logs), JSON.stringify(context.steps), runId]
        );
        
        if (onEvent) onEvent('step-failure', { stepName: step.name, error: failureLog });
        
        console.error(`[Executor] Flow ${flowId} failed at step ${step.name}:`, errorDetail);
        
        if (onEvent) {
            onEvent('step-run-finish', {
                nodeId: step.name,
                status: 'error',
                output: { error: errorDetail },
                duration: Date.now() - stepStartTime
            });
        }

        if (onEvent) onEvent('run-complete', { flowId, runId, status: 'failed', error: failureLog });

        return { success: false, error: failureLog, runId };
      }
    }

    // 2. Mark as success
    await pool.query(
      'UPDATE flow_runs SET status = $1, logs = $2, result = $3 WHERE id = $4',
      ['success', JSON.stringify(logs), JSON.stringify(context.steps), runId]
    );
    
    if (onEvent) onEvent('flow-success', { flowId, runId });
    if (onEvent) onEvent('run-complete', { flowId, runId, status: 'success' });
    
    console.log(`[Executor] Flow ${flowId} finished successfully.`);
    return { success: true, runId };

  } catch (error: any) {
    console.error(`[Executor] Critical failure in flow ${flowId}:`, error.message);
    logs.push(`[${new Date().toISOString()}] CRITICAL ERROR: ${error.message}`);
    
    await pool.query(
      'UPDATE flow_runs SET status = $1, logs = $2 WHERE id = $3',
      ['failed', JSON.stringify(logs), runId]
    );

    if (onEvent) onEvent('run-complete', { flowId, runId, status: 'failed', error: error.message });

    return { success: false, error: error.message, runId };
  }
}
