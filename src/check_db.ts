import { pool } from './db.js';

async function check() {
    try {
        const res = await pool.query('SELECT id, service, name, user_id FROM integrations');
        console.log('--- Integrations in DB ---');
        console.table(res.rows);
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

check();
