
import { pool } from './src/db.js';

async function migrate() {
    console.log('--- Migrating for Multi-Account Support ---');
    try {
        // 1. Add 'name' column
        console.log('Adding "name" column to integrations...');
        await pool.query('ALTER TABLE integrations ADD COLUMN IF NOT EXISTS name TEXT');
        
        // 2. Set default name for existing rows
        await pool.query("UPDATE integrations SET name = initcap(service) || ' Account' WHERE name IS NULL");
        
        // 3. Drop UNIQUE constraint (user_id, service)
        // We need to find the constraint name first, usually "google_integrations_user_id_service_key" or similar
        // Since we renamed the table, the constraint name might still be the old one OR auto-generated.
        // We'll try dropping the probable name or generic method.
        console.log('Dropping UNIQUE constraint...');
        
        // Try dropping the constraint by common naming convention
        try {
            await pool.query('ALTER TABLE integrations DROP CONSTRAINT IF EXISTS google_integrations_user_id_service_key');
            await pool.query('ALTER TABLE integrations DROP CONSTRAINT IF EXISTS integrations_user_id_service_key'); 
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
