import { Worker, Job } from 'bullmq';
import { createWorkerConnection, flowQueue } from './queues.js';
import { runAction } from './engine.js';
import { resolveVariables } from './mapping-engine.js';
import { pool } from './db.js';
import { FlowDefinition } from './types.js';

interface FlowJobData {
  flowId: string;
  userId: string;
  definition: FlowDefinition;
}

export const flowWorker = new Worker<FlowJobData>('flow-execution', async (job: Job<FlowJobData>) => {
  const { flowId, userId, definition, triggerData } = job.data as any;
  console.log(`[Worker] Starting Flow: ${flowId} for User: ${userId}`);

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
      } catch (stepError: any) {
        const errorDetail = stepError.response?.data 
          ? JSON.stringify(stepError.response.data) 
          : stepError.message;
        
        const failureLog = `❌ FAILED at Step: "${step.name}". Error: ${errorDetail}`;
        logs.push(`[${new Date().toISOString()}] ${failureLog}`);
        
        await pool.query(
          'UPDATE flow_runs SET status = $1, logs = $2, result = $3 WHERE id = $4',
          ['failed', JSON.stringify(logs), JSON.stringify(context.steps), runId]
        );
        
        console.error(`[Worker] Flow ${flowId} failed at step ${step.name}:`, errorDetail);
        return { success: false, error: failureLog };
      }
    }

    await pool.query(
      'UPDATE flow_runs SET status = $1, logs = $2, result = $3 WHERE id = $4',
      ['success', JSON.stringify(logs), JSON.stringify(context.steps), runId]
    );
    
    return { success: true, runId };

  } catch (error: any) {
    console.error(`[Worker] Critical failure in flow ${flowId}:`, error.message);
    logs.push(`[${new Date().toISOString()}] CRITICAL ERROR: ${error.message}`);
    
    await pool.query(
      'UPDATE flow_runs SET status = $1, logs = $2 WHERE id = $3',
      ['failed', JSON.stringify(logs), runId]
    );
    throw error;
  }
}, { connection: createWorkerConnection() });

flowWorker.on('completed', job => {
  console.log(`Job ${job.id} completed!`);
});

flowWorker.on('failed', (job, err) => {
  console.log(`Job ${job?.id} failed: ${err.message}`);
});
