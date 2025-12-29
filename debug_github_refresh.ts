
import { pool, getIntegration, saveIntegration } from './src/db.js';
import { refreshGitHubAccessToken } from './src/github.js';
import dotenv from 'dotenv';
dotenv.config();

async function check() {
  console.log('--- GitHub Refresh Verification ---');
  try {
      // Find a user with github integration
      const res = await pool.query("SELECT user_id, access_token, refresh_token, expiry_date FROM google_integrations WHERE service = 'github' LIMIT 1");
      
      if (res.rowCount === 0) {
          console.log('No GitHub integrations found in DB.');
          return;
      }

      const integration = res.rows[0];
      const userId = integration.user_id;
      
      console.log(`Found GitHub integration for User: ${userId}`);
      console.log('Current Access Token:', integration.access_token?.substring(0, 10) + '...');
      console.log('Current Refresh Token:', integration.refresh_token?.substring(0, 10) + '...');
      console.log('Current Expiry:', integration.expiry_date ? new Date(Number(integration.expiry_date)) : 'None');

      if (!integration.refresh_token) {
          console.log('❌ No refresh token available! Cannot test refresh.');
          // This is expected for PATs or old OAuth flows
          return;
      }

      console.log('\n🔄 Attempting Refresh...');
      const newTokens = await refreshGitHubAccessToken(integration.refresh_token);
      
      console.log('✅ Refresh Successful!');
      console.log('New Access Token:', newTokens.access_token.substring(0, 10) + '...');
      console.log('New Refresh Token:', newTokens.refresh_token ? newTokens.refresh_token.substring(0, 10) + '...' : 'Same');
      console.log('New Expiry:', newTokens.expiry_date ? new Date(newTokens.expiry_date) : 'None');

      // IMPORTANT: Save back to DB to keep the user's session valid!
      console.log('\n💾 Saving new tokens to DB...');
      await saveIntegration({
        user_id: userId,
        service: 'github',
        refresh_token: newTokens.refresh_token || integration.refresh_token,
        access_token: newTokens.access_token,
        expiry_date: newTokens.expiry_date,
        scopes: undefined // Keep existing or update if returned? Usually we keep existing unless re-requested
      });
      console.log('Saved.');

  } catch (err: any) {
      console.error('\n❌ VERIFICATION FAILED:');
      console.error(err.message);
      if (err.response) {
          console.error('Data:', err.response.data);
      }
  } finally {
      await pool.end();
  }
}

check();
