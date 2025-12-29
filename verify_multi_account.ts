
import { pool, saveIntegration, getIntegrations, deleteIntegrationById } from './src/db.js';

async function verify() {
  console.log('--- Verifying Multi-Account Support ---');
  
  const TEST_USER_ID = '00000000-0000-0000-0000-000000000000'; // Ensure this user exists or use a real one? 
  // Better to create a temp user or rely on an existing one. 
  // Let's create a temp user first to be safe.
  
  try {
    console.log('1. Creating Test User...');
    const userRes = await pool.query(
      "INSERT INTO users (email, name) VALUES ('test_multi@example.com', 'Test Multi') ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name RETURNING id"
    );
    const userId = userRes.rows[0].id;

    console.log('2. Adding Account A (gmail)...');
    await saveIntegration({
      user_id: userId,
      service: 'gmail',
      external_id: '11111',
      external_username: 'account_a@gmail.com',
      refresh_token: 'rt_a',
      access_token: 'at_a',
      expiry_date: 1000,
      scopes: ['email'],
      name: 'Account A'
    });

    console.log('3. Adding Account B (gmail) - Different External ID...');
    await saveIntegration({
      user_id: userId,
      service: 'gmail',
      external_id: '22222',
      external_username: 'account_b@gmail.com',
      refresh_token: 'rt_b',
      access_token: 'at_b',
      expiry_date: 1000,
      scopes: ['email'],
      name: 'Account B'
    });

    console.log('4. Verifying both accounts exist...');
    const accounts = await getIntegrations(userId, 'gmail');
    console.table(accounts.map(a => ({ id: a.id, ext_id: a.external_id, name: a.name })));

    if (accounts.length !== 2) {
      throw new Error(`Expected 2 accounts, found ${accounts.length}`);
    }
    
    // Check if they are distinct
    const ids = new Set(accounts.map(a => a.external_id));
    if (!ids.has('11111') || !ids.has('22222')) {
        throw new Error('Missing expected external IDs');
    }

    console.log('5. Updating Account A (Verify Upsert)...');
    await saveIntegration({
      user_id: userId,
      service: 'gmail',
      external_id: '11111',
      external_username: 'account_a_updated@gmail.com',
      refresh_token: 'rt_a_new',
      access_token: 'at_a_new',
      expiry_date: 2000,
      scopes: ['email'],
      name: 'Account A Updated'
    });
    
    const accountsAfterUpdate = await getIntegrations(userId, 'gmail');
    if (accountsAfterUpdate.length !== 2) {
         throw new Error('Update should not create new record');
    }
    const updatedA = accountsAfterUpdate.find(a => a.external_id === '11111');
    if (updatedA?.name !== 'Account A Updated') {
        throw new Error('Update failed to change name');
    }
    console.log('✅ Update Verified.');

    console.log('6. Cleaning up...');
    for (const acc of accountsAfterUpdate) {
        await deleteIntegrationById(acc.id!);
    }
    await pool.query('DELETE FROM users WHERE id = $1', [userId]);

    console.log('✅ Verification Passed!');
    process.exit(0);

  } catch (err: any) {
    console.error('❌ Verification Failed:', err);
    process.exit(1);
  }
}

verify();
