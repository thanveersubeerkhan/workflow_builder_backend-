import { pool } from '../db.js';

async function checkSchema() {
    try {
        const res = await pool.query('SELECT * FROM flows LIMIT 1');
        if (res.rows.length > 0) {
            console.log("COLUMNS:", Object.keys(res.rows[0]));
        } else {
            console.log("No flows found to check schema.");
        }
    } catch (err: any) {
        console.error("Error:", err.message);
    } finally {
        await pool.end();
    }
}

checkSchema();
