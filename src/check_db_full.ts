import { pool } from './db.js';

async function check() {
    try {
        const users = await pool.query('SELECT id, email FROM users');
        console.log('--- Users ---');
        console.table(users.rows);

        const integrations = await pool.query('SELECT id, user_id, service, name FROM integrations');
        console.log('--- All Integrations ---');
        console.table(integrations.rows);
        
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

check();
