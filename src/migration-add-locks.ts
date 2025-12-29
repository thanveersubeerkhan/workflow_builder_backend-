
import { pool } from './db.js';

async function migrate() {
    try {
        console.log('[Migration] Adding lock columns to flows table...');
        
        await pool.query(`
            ALTER TABLE flows 
            ADD COLUMN IF NOT EXISTS locked_until BIGINT,
            ADD COLUMN IF NOT EXISTS locked_by TEXT;
        `);
        
        // Create an index for faster lock lookups
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_flows_locked_until ON flows(locked_until);
        `);

        console.log('[Migration] ✅ Columns added successfully.');
    } catch (err) {
        console.error('[Migration] ❌ Error:', err);
    } finally {
        await pool.end();
    }
}

migrate();
