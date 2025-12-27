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
    const now = Date.now();
    const LOOK_AHEAD_MS = 65 * 1000; // 65 seconds
    const windowEnd = now + LOOK_AHEAD_MS;

    // 1. Fetch active flows that are due within the window
    let query = 'SELECT * FROM flows WHERE is_active = true';
    const params: any[] = [];
    
    if (flowId) {
      query += ' AND id = $1';
      params.push(flowId);
    } else {
      query += ' AND (next_run_time IS NULL OR next_run_time <= $1)';
      params.push(windowEnd);
    }
    
    const flowsRes = await pool.query(query, params);
    const flows = flowsRes.rows;

    if (flows.length === 0) {
      return { success: true, fireCount: 0 };
    }

    console.log(`[Scanner] ⏰ Found ${flows.length} flow(s) due by ${new Date(windowEnd).toLocaleTimeString()}`);

    // 2. Parallel Scanning with Batching
    const BATCH_SIZE = 10;
    let totalFired = 0;

    for (let i = 0; i < flows.length; i += BATCH_SIZE) {
      const batch = flows.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(batch.map(async (flow) => {
        return await withAdvisoryLock(`scan:flow:${flow.id}`, async () => {
          try {
            // 3. Re-fetch flow state INSIDE the lock to prevent race conditions
            const freshFlowRes = await pool.query('SELECT next_run_time, is_active, definition, last_trigger_data FROM flows WHERE id = $1', [flow.id]);
            const freshFlow = freshFlowRes.rows[0];

            if (!freshFlow || !freshFlow.is_active) return false;

            // Check if it was already handled by a concurrent scanner
            const currentNextRun = Number(freshFlow.next_run_time) || now;
            if (currentNextRun > windowEnd && !flowId) {
              return false; // Already advanced beyond our window
            }

            const definition = freshFlow.definition;
            const trigger = definition.trigger;
            if (!trigger) return false;

            // TRACK MULTIPLE OCCURRENCES
            let targetTime = currentNextRun;
            let fireCount = 0;
            let lastProcessedId = freshFlow.last_trigger_data;

            // Calculate Interval
            let nextRunMs = 60 * 1000;
            if (trigger.piece === 'schedule') {
              const p = trigger.params || {};
              if (p.intervalType === 'seconds') nextRunMs = (p.intervalSeconds || 60) * 1000;
              else if (p.intervalType === 'minutes') nextRunMs = (p.intervalMinutes || 1) * 60 * 1000;
              else if (p.intervalType === 'hours') nextRunMs = (p.intervalHours || 1) * 3600 * 1000;
              else if (p.intervalType === 'days') nextRunMs = (p.intervalDay || 1) * 86400 * 1000;
            }

            while (targetTime <= windowEnd || (flowId && fireCount === 0)) {
              // Trigger Check
              const result = await runTrigger({
                userId: flow.user_id,
                service: trigger.piece,
                triggerName: trigger.name,
                lastProcessedId: lastProcessedId,
                params: trigger.params,
                epoch: targetTime
              });

              if (result && result.newLastId) {
                const delaySeconds = Math.max(0, Math.floor((targetTime - Date.now()) / 1000));
                console.log(`🎯 Trigger FIRE! [${trigger.name}] for flow ${flow.id}. Target: ${new Date(targetTime).toLocaleTimeString()}, Delay: ${delaySeconds}s`);

                // DISPATCH
                try {
                  await tasks.trigger("workflow-executor", {
                    flowId: flow.id,
                    userId: flow.user_id,
                    definition: definition,
                    triggerData: result.data
                  }, { 
                    delay: `${delaySeconds}s`
                  });
                } catch (triggerErr: any) {
                  console.error(`[Scanner] ❌ Dispatch Error:`, triggerErr.message);
                }

                lastProcessedId = result.newLastId;
                fireCount++;
              }

              // Advance to next occurrence
              targetTime += nextRunMs;
              
              // Prevent infinite loops for 0 interval
              if (nextRunMs <= 0) break;
            }

            if (fireCount > 0) {
              // Update DB: last_trigger_data and next_run_time
              await pool.query(
                'UPDATE flows SET last_trigger_data = $1, next_run_time = $2 WHERE id = $3',
                [lastProcessedId, targetTime, flow.id]
              );
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
if (import.meta.url.includes(process.argv[1]?.replace(/\\/g, '/')) || process.argv[1]?.endsWith('trigger-worker.ts')) {
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
