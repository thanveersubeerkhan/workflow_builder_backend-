
import { pool } from './db.js';

async function killZombie() {
    try {
        const pid = 11677; // Found from debug-locks
        console.log(`[Kill] Terminating backend PID ${pid}...`);
        const res = await pool.query('SELECT pg_terminate_backend($1)', [pid]);
        console.log(`[Kill] Result:`, res.rows[0]);
    } catch (err) {
        console.error('[Kill] Error:', err);
    } finally {
        await pool.end();
    }
}

killZombie();
