import { pool } from './src/db.js';

async function fix() {
    console.log('--- Manually Fixing Database Schema ---');
    try {
        await pool.query("ALTER TABLE google_integrations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT now();");
        console.log('✅ Column updated_at added to google_integrations');
        process.exit(0);
    } catch (err: any) {
        console.error('❌ Failed:', err.message);
        process.exit(1);
    }
}

fix();
