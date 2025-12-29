import { pool } from './db.js';

async function forceClean() {
    try {
        const userId = '7a1e333b-1a03-49ac-b310-704fd7f61304';
        console.log(`Checking for github integrations for user ${userId}...`);
        
        const before = await pool.query("SELECT * FROM integrations WHERE user_id = $1 AND service = 'github'", [userId]);
        console.log(`Found ${before.rowCount} records before delete.`);

        const del = await pool.query("DELETE FROM integrations WHERE user_id = $1 AND service = 'github' RETURNING *", [userId]);
        console.log(`Deleted ${del.rowCount} records.`);
        
        const after = await pool.query("SELECT * FROM integrations WHERE user_id = $1 AND service = 'github'", [userId]);
        console.log(`Records remaining: ${after.rowCount}`);

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

forceClean();
