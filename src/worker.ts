import { Worker, Job } from 'bullmq';
import { redisConnection } from './queues.js';
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
      logs.push(`Executing Step: ${step.name} (${step.piece})`);
      
      const resolvedParams = resolveVariables(step.params, context);

      const result = await runAction({
        userId,
        service: step.piece,
        actionName: step.action,
        params: resolvedParams
      });

      context.steps[step.name] = { data: result };
      logs.push(`Successfully completed ${step.name}`);
    }

    await pool.query(
      'UPDATE flow_runs SET status = $1, logs = $2, result = $3 WHERE id = $4',
      ['success', JSON.stringify(logs), JSON.stringify(context.steps), runId]
    );
    
    return { success: true, runId };

  } catch (error: any) {
    console.error(`[Worker] Error in flow ${flowId}:`, error.message);
    logs.push(`ERROR in step: ${error.message}`);
    
    await pool.query(
      'UPDATE flow_runs SET status = $1, logs = $2 WHERE id = $3',
      ['failed', JSON.stringify(logs), runId]
    );
    throw error;
  }
}, { connection: redisConnection });

flowWorker.on('completed', job => {
  console.log(`Job ${job.id} completed!`);
});

flowWorker.on('failed', (job, err) => {
  console.log(`Job ${job?.id} failed: ${err.message}`);
});
