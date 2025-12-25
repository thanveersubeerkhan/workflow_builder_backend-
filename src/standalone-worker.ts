import { performTriggerScan } from './trigger-worker.js';
import { performTokenRefresh } from './refresh-worker.js';
import { closeRedisConnection } from './queues.js';
import { pool } from './db.js';

/**
 * Standalone Worker
 * This script runs 24/7 on a persistent server (Railway, Render, VPS)
 * It handles background polling without needing Vercel Cron.
 */

const SCAN_INTERVAL = 10 * 1000; // 5 seconds
const REFRESH_INTERVAL = 15 * 60 * 1000; // 15 minutes

async function startWorker() {
    console.log(`
🤖 Standalone Workflow Worker Started
------------------------------------
Trigger Polling: Every ${SCAN_INTERVAL / 1000}s
Token Refresh:   Every ${REFRESH_INTERVAL / 60000}m
------------------------------------
    `);

    // 1. Run the Trigger Scan loop
    setInterval(async () => {
        try {
            await performTriggerScan();
        } catch (err: any) {
            console.error('[Worker] Trigger Scan Loop Error:', err.message);
        }
    }, SCAN_INTERVAL);

    // 2. Run the Token Refresh loop
    setInterval(async () => {
        try {
            await performTokenRefresh();
        } catch (err: any) {
            console.error('[Worker] Token Refresh Loop Error:', err.message);
        }
    }, REFRESH_INTERVAL);

    // Run once immediately on startup
    performTriggerScan().catch(() => {});
    performTokenRefresh().catch(() => {});
}

// Graceful Shutdown
const shutdown = async (signal: string) => {
    console.log(`\n[Worker] ${signal} received. Shutting down...`);
    await closeRedisConnection();
    await pool.end();
    process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

startWorker();
