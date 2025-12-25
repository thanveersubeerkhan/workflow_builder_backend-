import { pool } from './db.js';
import { runTrigger } from './engine.js';
import { executeFlow } from './worker.js';

interface ScanOptions {
  flowId?: string;
}

/**
 * Performs a scan for active triggers and executes flows directly.
 * Designed to be called by a Cron job or a manual trigger.
 */
export async function performTriggerScan(options: ScanOptions = {}) {
  const { flowId } = options;

  if (flowId) {
    console.log(`[Trigger] ⚡ Scanning Specific Flow: ${flowId}`);
  } else {
    console.log('[Trigger] ⏰ Starting Global Trigger Scan...');
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
      console.log('[Trigger] No active flows found to scan.');
      return { success: true, flowsScanned: 0 };
    }

    let fireCount = 0;

    for (const flow of flows) {
      const definition = flow.definition;
      const trigger = definition.trigger;

      if (!trigger) continue;

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

          // 2. Execute the flow directly (synchronous in serverless context)
          fireCount++;
          await executeFlow({
            flowId: flow.id,
            userId: flow.user_id,
            definition: definition,
            triggerData: result.data
          });
        }
      } catch (err: any) {
        console.error(`[Trigger] Error checking trigger for flow ${flow.id}:`, err.message);
      }
    }

    return { success: true, flowsScanned: flows.length, fires: fireCount };

  } catch (error: any) {
    console.error('[Trigger] Scan Error:', error.message);
    throw error;
  }
}
