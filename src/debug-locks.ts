
import { pool } from './db.js';

async function checkLocks() {
    try {
        console.log('[LockDebug] checkLocks started');
        const res = await pool.query(`
            SELECT pid, mode, granted, locktype, objid 
            FROM pg_locks 
            WHERE locktype = 'advisory'
        `);
        console.log(`[LockDebug] Found ${res.rowCount} advisory locks.`);
        console.table(res.rows);

        if (res.rowCount > 0) {
            console.log('[LockDebug] Attempting to identify sessions...');
            const pids = res.rows.map(r => r.pid).join(',');
            const sessions = await pool.query(`SELECT pid, usename, application_name, state, query_start FROM pg_stat_activity WHERE pid IN (${pids})`);
            console.table(sessions.rows);
        }

    } catch (err) {
        console.error('[LockDebug] Error:', err);
    } finally {
        await pool.end();
    }
}

checkLocks();
