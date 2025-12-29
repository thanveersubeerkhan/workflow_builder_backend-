
import { pool } from './src/db.js';

async function migrate() {
  console.log('--- Migrating Database for Multi-Account Support ---');

  try {
    // 1. Drop the old constraint if it exists
    console.log('Dropping old constraint (if exists)...');
    await pool.query(`
      ALTER TABLE integrations 
      DROP CONSTRAINT IF EXISTS integrations_user_id_service_unique;
    `);

    // 2. Add the new constraint
    console.log('Adding new constraint (user_id, service, external_id)...');
    // Note: We use COALESCE(external_id, 'default') or similar if external_id is null?
    // Actually, checking db.ts logic, external_id might be null for old records.
    // If external_id is NULL, multiple NULLs are allowed by standard SQL unique constraints usually,
    // but we want to ensure we don't duplicate "unknown" accounts if possible.
    // However, the saving logic relies on external_id.
    // Let's first clean up or assign a random external_id to nulls if we want to be strict,
    // OR just rely on the fact that new integrations will have external_id.
    
    // For now, standard unique constraint including external_id.
    // CAUTION: If external_id is NULL for existing rows, this constraint won't block duplicates of them.
    // This is probably fine as we move towards requiring external_id.
    
    await pool.query(`
      ALTER TABLE integrations 
      DROP CONSTRAINT IF EXISTS integrations_user_id_service_external_id_unique;
    `);
    
    await pool.query(`
      ALTER TABLE integrations 
      ADD CONSTRAINT integrations_user_id_service_external_id_unique 
      UNIQUE (user_id, service, external_id);
    `);

    console.log('✅ Migration successful!');
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

migrate();
