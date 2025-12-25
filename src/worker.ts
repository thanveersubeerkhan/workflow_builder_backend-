import { runAction } from './engine.js';
import { resolveVariables } from './mapping-engine.js';
import { pool } from './db.js';
import { FlowDefinition } from './types.js';

interface ExecuteFlowArgs {
  flowId: string;
  userId: string;
  definition: FlowDefinition;
  triggerData?: any;
}

/**
 * Directly executes a flow step-by-step.
 * This is serverless-friendly as it doesn't rely on background workers.
 */
export async function executeFlow({ flowId, userId, definition, triggerData }: ExecuteFlowArgs) {
  console.log(`[Executor] Starting Flow: ${flowId} for User: ${userId}`);

  // 1. Create a run record
  const runRes = await pool.query(
    'INSERT INTO flow_runs (flow_id, status) VALUES ($1, $2) RETURNING id',
    [flowId, 'running']
  );
  const runId = runRes.rows[0].id;

  const context: any = { steps: { trigger: { data: triggerData } } };
  const logs: string[] = [];

  try {
    for (const step of definition.steps) {
      const stepStartTime = Date.now();
      logs.push(`[${new Date().toISOString()}] Executing Step: ${step.name} (${step.piece}.${step.action})`);
      
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
        
        console.error(`[Executor] Flow ${flowId} failed at step ${step.name}:`, errorDetail);
        return { success: false, error: failureLog, runId };
      }
    }

    // 2. Mark as success
    await pool.query(
      'UPDATE flow_runs SET status = $1, logs = $2, result = $3 WHERE id = $4',
      ['success', JSON.stringify(logs), JSON.stringify(context.steps), runId]
    );
    
    console.log(`[Executor] Flow ${flowId} finished successfully.`);
    return { success: true, runId };

  } catch (error: any) {
    console.error(`[Executor] Critical failure in flow ${flowId}:`, error.message);
    logs.push(`[${new Date().toISOString()}] CRITICAL ERROR: ${error.message}`);
    
    await pool.query(
      'UPDATE flow_runs SET status = $1, logs = $2 WHERE id = $3',
      ['failed', JSON.stringify(logs), runId]
    );
    return { success: false, error: error.message, runId };
  }
}
