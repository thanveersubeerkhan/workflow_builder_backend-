
import { pool, getIntegration, saveIntegration } from './src/db.js';
import { createOAuthClient } from './src/google.js';
import dotenv from 'dotenv';
dotenv.config();

async function check() {
  const userId = '8bebb0d3-c40e-4b48-9732-ff0694b71f9c'; // Flow owner
  const service = 'gmail';

  console.log(`Checking integration for ${userId}...`);
  try {
      const integration = await getIntegration(userId, service);
      if (!integration) {
          console.log('No integration found!');
          return;
      }

      console.log('Current Expiry:', new Date(Number(integration.expiry_date)));
      console.log('Access Token (first 10):', integration.access_token.substring(0, 10) + '...');
      console.log('Refresh Token (first 10):', integration.refresh_token.substring(0, 10) + '...');

      console.log('\nAttempting manual refresh...');
      const client = createOAuthClient();
      client.setCredentials({
        refresh_token: integration.refresh_token
      });

      const res = await client.refreshAccessToken();
      const credentials = res.credentials;
      
      console.log('Refresh SUCCESS!');
      console.log('New Access Token:', credentials.access_token?.substring(0, 10));
      console.log('New Expiry:', new Date(credentials.expiry_date!));

  } catch (err: any) {
      console.error('\n❌ REFRESH FAILED:');
      console.error(err.message);
      if (err.response) {
          console.error('Data:', err.response.data);
      }
  } finally {
      await pool.end();
  }
}

check();
