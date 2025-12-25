import { Worker } from 'bullmq';
import { createWorkerConnection, flowQueue, triggerQueue } from './queues.js';
import { pool } from './db.js';
import { runTrigger } from './engine.js';

/**
 * Trigger Polling Worker
 * Scans all flows for triggers and starts flows if new data is detected.
 */
export const triggerWorker = new Worker('trigger-polling', async (job) => {
  const { flowId } = job.data as { flowId?: string };
  
  if (flowId) {
    console.log(`[TriggerWorker] ⚡ Immediate Scan for Flow: ${flowId}`);
  } else {
    console.log(`[TriggerWorker] ⏰ Periodic Scan [Job: ${job.id}]`);
  }

  try {
    let flows: any[] = [];
    
    if (flowId) {
      const res = await pool.query("SELECT * FROM flows WHERE id = $1 AND is_active = true", [flowId]);
      flows = res.rows;
    } else {
      const res = await pool.query("SELECT * FROM flows WHERE is_active = true");
      flows = res.rows;
    }

    if (flows.length === 0) {
      if (flowId) {
        console.log(`--- Flow ${flowId} not found or not active ---`);
      } else {
        console.log('--- No active flows found to scan ---');
      }
      return;
    }

    for (const flow of flows) {
      const definition = flow.definition;
      const trigger = definition.trigger;

      if (!trigger) continue;

      console.log(`Checking trigger [${trigger.name}] for flow: ${flow.name}`);

      try {
        const result = await runTrigger({
          userId: flow.user_id,
          service: trigger.piece,
          triggerName: trigger.name,
          lastProcessedId: flow.last_trigger_data,
          params: trigger.params
        });

        if (result && result.newLastId) {
          console.log(`🎯 Trigger FIRE! [${trigger.name}] for flow ${flow.id}. New item: ${result.newLastId}`);

          // 1. Update the last processed ID in DB immediately
          await pool.query(
            'UPDATE flows SET last_trigger_data = $1 WHERE id = $2',
            [result.newLastId, flow.id]
          );

          // 2. Add the flow execution to the queue
          await flowQueue.add(`${flow.name}-${Date.now()}`, {
            flowId: flow.id,
            userId: flow.user_id,
            definition: definition,
            triggerData: result.data
          });
        } else {
          // console.log(`[TriggerWorker] No new data for flow: ${flow.name}`);
        }
      } catch (err: any) {
        console.error(`[TriggerWorker] Error checking trigger for flow ${flow.id}:`, err.message);
      }
    }
  } catch (error: any) {
    console.error('Trigger Poll Job Error:', error.message);
  }
  
  console.log('--- Trigger Scan Completed ---');
}, { connection: createWorkerConnection() });

// Schedule polling every 30 seconds for responsive triggers
export async function scheduleTriggerJob() {
    console.log('[TriggerWorker] Scheduling repeatable polling job (30s interval)...');
    await triggerQueue.add('trigger-poll-repeatable', {}, {
        repeat: {
            every: 30000 // 30 seconds
        }
    });
}
