
import { pool } from './src/db.js';

async function migrate() {
    console.log('--- Migrating Table Names ---');
    try {
        // 1. Rename google_integrations -> integrations
        console.log('Renaming google_integrations -> integrations...');
        try {
            await pool.query('ALTER TABLE google_integrations RENAME TO integrations');
            console.log('✅ Renamed google_integrations.');
        } catch (e: any) {
            if (e.message.includes('does not exist')) {
                console.log('⚠️ google_integrations does not exist (maybe already renamed).');
            } else {
                console.error('❌ Failed:', e.message);
            }
        }

        // 2. Rename services_metadata -> connectors_metadata
        console.log('Renaming services_metadata -> connectors_metadata...');
        try {
            await pool.query('ALTER TABLE services_metadata RENAME TO connectors_metadata');
            console.log('✅ Renamed services_metadata.');
        } catch (e: any) {
             if (e.message.includes('does not exist')) {
                console.log('⚠️ services_metadata does not exist (maybe already renamed).');
            } else {
                console.error('❌ Failed:', e.message);
            }
        }

        process.exit(0);

    } catch (e) {
        console.error('Fatal Error:', e);
        process.exit(1);
    }
}

migrate();
