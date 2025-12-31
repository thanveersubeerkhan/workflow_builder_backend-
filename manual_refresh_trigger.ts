import { performTokenRefresh } from './src/refresh-worker.js';

async function runManualRefresh() {
    console.log('[Manual Refresh] Starting one-time refresh scan...');
    try {
        const result = await performTokenRefresh();
        console.log('[Manual Refresh] Result:', result);
    } catch (err: any) {
        console.error('[Manual Refresh] Critical failure:', err.message);
    } finally {
        process.exit(0);
    }
}

runManualRefresh();
