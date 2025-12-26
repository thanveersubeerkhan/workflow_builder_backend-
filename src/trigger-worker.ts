import { pool, withAdvisoryLock } from './db.js';
import { runTrigger } from './engine.js';
import { tasks } from "@trigger.dev/sdk/v3";

interface ScanOptions {
  flowId?: string;
}

/**
 * Performs a high-scale parallel scan for active triggers.
 * Refactored for "Double-Loopback" architecture.
 */
export async function performTriggerScan(options: ScanOptions = {}) {
  const { flowId } = options;

  try {
    // 1. Fetch active flows
    let query = 'SELECT * FROM flows WHERE is_active = true';
    const params: any[] = [];
    if (flowId) {
      query += ' AND id = $1';
      params.push(flowId);
    }
    const flowsRes = await pool.query(query, params);
    const flows = flowsRes.rows;

    if (flows.length === 0) {
      console.log('[Scanner] No active flows to scan.');
      return { success: true, fireCount: 0 };
    }

    console.log(`[Scanner] ⏰ Scanning ${flows.length} flow(s)...`);

    // 2. Parallel Scanning with Concurrency Limit (Batching)
    const BATCH_SIZE = 10;
    let totalFired = 0;

    for (let i = 0; i < flows.length; i += BATCH_SIZE) {
      const batch = flows.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(batch.map(async (flow) => {
        return await withAdvisoryLock(`scan:flow:${flow.id}`, async () => {
          try {
            const definition = flow.definition;
            const trigger = definition.trigger;
            if (!trigger) return false;

            const result = await runTrigger({
              userId: flow.user_id,
              service: trigger.piece,
              triggerName: trigger.name,
              lastProcessedId: flow.last_trigger_data,
              params: trigger.params
            });

            if (result && result.newLastId) {
              console.log(`🎯 Trigger FIRE! [${trigger.name}] for flow ${flow.id}`);

              // Update DB immediately to prevent double-triggering in next scan
              await pool.query(
                'UPDATE flows SET last_trigger_data = $1 WHERE id = $2',
                [result.newLastId, flow.id]
              );

              // DISPATCH to Trigger.dev Queue (The Muscle)
              console.log(`[Scanner] 🚀 Dispatching workflow-executor for flow ${flow.id}...`);
              try {
                const triggerHandle = await tasks.trigger("workflow-executor", {
                  flowId: flow.id,
                  userId: flow.user_id,
                  definition: definition,
                  triggerData: result.data
                });
                console.log(`[Scanner] ✅ Dispatched successfully. Handle: ${triggerHandle.id}`);
              } catch (triggerErr: any) {
                console.error(`[Scanner] ❌ Failed to dispatch to Trigger.dev:`, triggerErr.message);
              }

              return true;
            }
          } catch (err: any) {
            console.error(`[Scanner] Error in flow ${flow.id}:`, err.message);
          }
          return false;
        });
      }));
      totalFired += results.filter(Boolean).length;
    }

    console.log(`[Scanner] Scan complete. Total items fired: ${totalFired}`);
    return { success: true, fireCount: totalFired };

  } catch (error: any) {
    console.error('[Scanner] Fatal Error:', error.message);
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
