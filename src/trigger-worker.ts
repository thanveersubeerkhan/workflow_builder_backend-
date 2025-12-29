import { pool, withAdvisoryLock } from './db.js';
import { runTrigger } from './engine.js';
import { tasks } from "@trigger.dev/sdk/v3";

interface ScanOptions {
  flowId?: string;
}

interface DispatchOptions {
    flowId: string;
    userId: string;
    definition: any;
    triggerData?: any;
    runId?: string;
    delaySeconds?: number;
}

/**
 * Dispatches a workflow to the Trigger.dev queue for asynchronous execution.
 */
export async function dispatchWorkflowExecution({ flowId, userId, definition, triggerData, runId, delaySeconds = 0 }: DispatchOptions) {
    let finalRunId = runId;

    // 1. If no runId, pre-create the run for early tracking
    if (!finalRunId) {
        const runRes = await pool.query(
            'INSERT INTO flow_runs (flow_id, status, trigger_data, current_context, last_step_index) VALUES ($1, $2, $3, $4, $5) RETURNING id',
            [flowId, 'pending', JSON.stringify(triggerData || {}), JSON.stringify({ steps: { trigger: { data: triggerData || {} } } }), -1]
        );
        finalRunId = runRes.rows[0].id;
    }

    console.log(`[Dispatcher] 🚀 Dispatching Run: ${finalRunId} to Queue (Delay: ${delaySeconds}s)`);

    // 2. Push to Trigger.dev Task Queue
    try {
        await tasks.trigger("workflow-executor", {
            runId: finalRunId,
            flowId,
            userId,
            definition,
            triggerData: triggerData || {}
        }, { 
            delay: `${delaySeconds}s`
        });
        return { success: true, runId: finalRunId };
    } catch (err: any) {
        console.error(`[Dispatcher] ❌ Failed to dispatch to Trigger.dev:`, err.message);
        throw err;
    }
}

interface ExecuteOrDispatchOptions extends DispatchOptions {
    onEvent?: (event: string, data: any) => void;
}

/**
 * Smart execution router: Chooses between direct execution or queue-based execution
 * based on the USE_DIRECT_EXECUTION environment variable.
 */
export async function executeOrDispatch(options: ExecuteOrDispatchOptions) {
    const useDirectExecution = process.env.USE_DIRECT_EXECUTION === 'true';
    
    if (useDirectExecution) {
        console.log(`[ExecuteOrDispatch] 🏃 Direct execution mode enabled`);
        // Import executeFlow dynamically to avoid circular dependencies
        const { executeFlow } = await import('./worker.js');
        
        return await executeFlow({
            runId: options.runId,
            flowId: options.flowId,
            userId: options.userId,
            definition: options.definition,
            triggerData: options.triggerData,
            onEvent: options.onEvent
        });
    } else {
        console.log(`[ExecuteOrDispatch] 📬 Queue mode enabled - dispatching to Trigger.dev`);
        return await dispatchWorkflowExecution({
            flowId: options.flowId,
            userId: options.userId,
            definition: options.definition,
            triggerData: options.triggerData,
            runId: options.runId,
            delaySeconds: options.delaySeconds
        });
    }
}


/**
 * Performs a high-scale parallel scan for active triggers.
 * Refactored for "Double-Loopback" architecture.
 */
export async function performTriggerScan(options: ScanOptions = {}) {
  const { flowId } = options;

  try {
    const now = Date.now();
    const LOOK_AHEAD_MS = 30 * 1000; // 15 seconds (Safe overlap for 5s scanner intervals)
    const windowEnd = now + LOOK_AHEAD_MS;
    const startTime = Date.now();
    console.log(`[Scanner] ⏰ Starting Scan. Window End: ${new Date(windowEnd).toLocaleTimeString()}`);

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
      console.log(`[Scanner] 💤 No flows due in this window.`);
      return { success: true, fireCount: 0 };
    }

    console.log(`[Scanner] 📂 Found ${flows.length} flow(s) to check.`);

    // 2. Parallel Scanning with Batching
    const BATCH_SIZE = 10;
    let totalFired = 0;

    for (let i = 0; i < flows.length; i += BATCH_SIZE) {
      const batch = flows.slice(i, i + BATCH_SIZE);
      console.log(`[Scanner] 📦 Processing Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(flows.length / BATCH_SIZE)} (${batch.length} flows)`);
      
      const results = await Promise.all(batch.map(async (flow) => {
        const workerId = `worker-${process.pid}-${crypto.randomUUID()}`;
        const lockDuration = 60 * 1000; // 1 minute lease
        const lockExpiry = Date.now() + lockDuration;

        // 1. Try to Acquire Lease
        // Only verify if locked_until is NULL (free) OR in the past (expired/zombie)
        try {
            const lockRes = await pool.query(
                `UPDATE flows 
                 SET locked_until = $1, locked_by = $2 
                 WHERE id = $3 
                 AND (locked_until IS NULL OR locked_until < $4)
                 RETURNING id`,
                [lockExpiry, workerId, flow.id, Date.now()]
            );

            if (lockRes.rowCount === 0) {
                // console.log(`[Scanner] 🔒 Busy: Flow ${flow.id} is locked by another worker.`);
                return false;
            }

            console.log(`[Scanner] 🔒 Acquired Lease for flow ${flow.id} until ${new Date(lockExpiry).toLocaleTimeString()}`);

            try {
                // 3. Re-fetch flow state (Standard logic)
                const freshFlowRes = await pool.query('SELECT next_run_time, is_active, definition, last_trigger_data FROM flows WHERE id = $1', [flow.id]);
                const freshFlow = freshFlowRes.rows[0];

                if (!freshFlow || !freshFlow.is_active) {
                    console.log(`[Scanner] ⏭️ Flow ${flow.id} is inactive or missing. Skipping.`);
                    return false;
                }

                // [SECURITY CHECK] Compare with initial memory state to detect overlap
                const dbNextRun = Number(freshFlow.next_run_time) || now;
                if (dbNextRun !== (Number(flow.next_run_time) || now) && !flowId) {
                    console.log(`[Scanner] 🛡️ Flow ${flow.id} was recently updated by another process. Aborting scan to prevent double-fire.`);
                    return false;
                }

                // Check if it was already handled by a concurrent scanner
                const currentNextRun = Number(freshFlow.next_run_time) || now;
                if (dbNextRun > windowEnd) {
                console.log(`[Scanner] ⏭️ Flow ${flow.id} already advanced (${new Date(dbNextRun).toLocaleTimeString()}) beyond window.`);
                return false; 
                }

                const definition = freshFlow.definition;
                const trigger = definition.trigger;
                if (!trigger) {
                    console.log(`[Scanner] ⚠️ Flow ${flow.id} has no trigger definition.`);
                    return false;
                }

                console.log(`[Scanner] Flow ${flow.id} trigger: ${trigger.piece}.${trigger.name}`);

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
                } else {
                    // For non-schedule triggers (polling), don't catch up on missed windows.
                    // Just run once now.
                    if (targetTime < now) {
                        console.log(`[Scanner] ⏭️ Polling trigger lagging. Fast-forwarding from ${new Date(targetTime).toLocaleTimeString()} to now.`);
                        targetTime = now;
                    }
                }

                console.log(`[Scanner] Entering loop for ${flow.id}. targetTime: ${targetTime}, now: ${now}, windowEnd: ${windowEnd}`);

                while (targetTime <= now || (fireCount === 0 && targetTime <= windowEnd)) {
                // Trigger Check
                console.log(`[Scanner] calling runTrigger for ${flow.id}`);
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
                    
                    await executeOrDispatch({
                    flowId: flow.id,
                    userId: flow.user_id,
                    definition: definition,
                    triggerData: result.data,
                    delaySeconds: delaySeconds
                    });

                    lastProcessedId = result.newLastId;
                    fireCount++;

                    // 🔥 ATOMIC UPDATE: Mark as handled in DB IMMEDIATELY before potentially looping
                    // Also renew lease to prevent expiry during long processing
                    const newExpiry = Date.now() + lockDuration; 
                    await pool.query(
                    'UPDATE flows SET last_trigger_data = $1, next_run_time = $2, locked_until = $3 WHERE id = $4',
                    [lastProcessedId, targetTime + nextRunMs, newExpiry, flow.id]
                    );
                }

                // Advance to next occurrence
                targetTime += nextRunMs;
                
                // Prevent infinite loops for 0 interval
                if (nextRunMs <= 0) break;
                }

                if (fireCount > 0) {
                return true;
                }

                return false;
            } finally {
                // RELEASE LEASE independently of success/fail
                // Only release if WE still own it (safe check)
                await pool.query(
                    'UPDATE flows SET locked_until = NULL, locked_by = NULL WHERE id = $1 AND locked_by = $2',
                    [flow.id, workerId]
                );
                // console.log(`[Scanner] 🔓 Released Lease for flow ${flow.id}`);
            }

        } catch (err: any) {
            console.error(`[Scanner] ❌ Error in flow ${flow.id}:`, err.message);
            return false;
        }
      }));
      totalFired += results.filter(Boolean).length;
    }

    const duration = Date.now() - startTime;
    console.log(`[Scanner] ✅ Scan cycle finished. Duration: ${duration}ms, Items fired: ${totalFired}`);
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
