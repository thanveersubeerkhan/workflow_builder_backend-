
import { pool } from './src/db.js';

async function migrate() {
    console.log('--- Migrating for Multi-Account Support ---');
    try {
        // 1. Add 'name' column
        console.log('Adding "name" column to integrations...');
        await pool.query('ALTER TABLE integrations ADD COLUMN IF NOT EXISTS name TEXT');
        
        // 2. Set default name for existing rows
        await pool.query("UPDATE integrations SET name = initcap(service) || ' Account' WHERE name IS NULL");
        
        // 3. Convert 'microsoft' service to 'teams' (original default)
        console.log('Converting "microsoft" service to "teams"...');
        await pool.query("UPDATE integrations SET service = 'teams' WHERE service = 'microsoft'");

        // 4. Drop UNIQUE constraint (user_id, service)
        console.log('Dropping UNIQUE constraint...');
        try {
            // Drop old constraints to allow multiple integrations per user/service
            await pool.query('ALTER TABLE integrations DROP CONSTRAINT IF EXISTS google_integrations_user_id_service_key');
            await pool.query('ALTER TABLE integrations DROP CONSTRAINT IF EXISTS integrations_user_id_service_key'); 
            await pool.query('ALTER TABLE integrations DROP CONSTRAINT IF EXISTS integrations_user_id_service_unique');
        } catch (e) {
            console.log('Constraint drop error (ignorable if not found):', e);
        }

        console.log('✅ Migration Complete.');
        process.exit(0);

    } catch (e) {
        console.error('Fatal Error:', e);
        process.exit(1);
    }
}

migrate();
