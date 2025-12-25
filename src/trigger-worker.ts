import { pool, withAdvisoryLock } from './db.js';
import { runTrigger } from './engine.js';
import { executeFlow } from './worker.js';
import { io } from 'socket.io-client';

const socket = io(process.env.SOCKET_URL || 'http://localhost:3000');

interface ScanOptions {
  flowId?: string;
}

/**
 * Performs a scan for active triggers and executes flows directly.
 * Designed to be called by a Cron job or a manual trigger.
 */
export async function performTriggerScan(options: ScanOptions = {}, onTriggerFire?: (data: { flowId: string, userId: string, definition: any, triggerData: any }) => Promise<void>) {
  const { flowId } = options;

  if (flowId) {
    console.log(`[Trigger] ⚡ Scanning Specific Flow: ${flowId}`);
  } else {
    console.log('[Trigger] ⏰ Starting Global Trigger Scan...');
  }

  try {
    let query = 'SELECT * FROM flows WHERE is_active = true';
    const params: any[] = [];
    
    if (flowId) {
      query += ' AND id = $1';
      params.push(flowId);
    }

    const flowsRes = await pool.query(query, params);
    const flows = flowsRes.rows;

    if (flows.length === 0 && !flowId) {
      console.log('[Trigger] No active flows found to scan.');
      return { success: true, fireCount: 0 };
    }

    let fireCount = 0;

    for (const flow of flows) {
      // Use Postgres Advisory Lock instead of Redis
      await withAdvisoryLock(`scan:flow:${flow.id}`, async () => {
        try {
          const definition = flow.definition;
          const trigger = definition.trigger;

          if (!trigger) return;

          try {
            const result = await runTrigger({
              userId: flow.user_id,
              service: trigger.piece,
              triggerName: trigger.name,
              lastProcessedId: flow.last_trigger_data,
              params: trigger.params
            });

            if (result && result.newLastId) {
              console.log(`🎯 Trigger FIRE! [${trigger.name}] for flow ${flow.id}. New item: ${typeof result.newLastId === 'object' ? JSON.stringify(result.newLastId) : result.newLastId}`);

              // 1. Update the last processed ID in DB immediately
              await pool.query(
                'UPDATE flows SET last_trigger_data = $1 WHERE id = $2',
                [result.newLastId, flow.id]
              );

              fireCount++;

              // 2. Execute the flow (either via callback or directly)
              if (onTriggerFire) {
                await onTriggerFire({
                  flowId: flow.id,
                  userId: flow.user_id,
                  definition: definition,
                  triggerData: result.data
                });
              } else {
                await executeFlow({
                  flowId: flow.id,
                  userId: flow.user_id,
                  definition: definition,
                  triggerData: result.data,
                  onEvent: (event, data) => {
                      socket.emit('worker-relay', {
                          room: `flow:${flow.id}`,
                          event,
                          data
                      });
                  }
                });
              }
            }
          } catch (err: any) {
            console.error(`[Trigger] Error checking trigger for flow ${flow.id}:`, err.message);
          }
        } finally {
          // The withAdvisoryLock utility handles releasing the lock
        }
      });
    }

    if (!flowId) {
      console.log(`[Trigger] Scan complete. Items fired: ${fireCount}`);
    }
    return { success: true, fireCount };

  } catch (error: any) {
    console.error('[Trigger] Scan Error:', error.message);
    throw error;
  }
}

// If this file is run directly, perform a single scan
if (import.meta.url.endsWith(process.argv[1]?.replace(/\\/g, '/'))) {
  console.log('[Trigger-Worker] Manual execution detected. Running scan...');
  performTriggerScan()
    .then(() => {
      console.log('[Trigger-Worker] Scan finished.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[Trigger-Worker] Scan failed:', err);
      process.exit(1);
    });
}
