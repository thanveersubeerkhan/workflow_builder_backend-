import { Worker } from 'bullmq';
import { createWorkerConnection, refreshQueue } from './queues.js';
import { getAllIntegrations, saveIntegration } from './db.js';
import { createOAuthClient } from './google.js';

/**
 * Token Refresh Worker (BullMQ version)
 * This handles the periodic background refresh of all tokens
 */
export const refreshWorker = new Worker('token-refresh', async (job) => {
  console.log('--- Starting Proactive Token Refresh Job ---');
  
  try {
    const integrations = await getAllIntegrations();
    const now = Date.now();

    for (const integration of integrations) {
      // Check if it's expiring in the next 15 minutes
      const buffer = 15 * 60 * 1000;
      if (integration.expiry_date && (Number(integration.expiry_date) < now + buffer)) {
        console.log(`Refreshing: ${integration.user_id} - ${integration.service}`);
        
        const client = createOAuthClient();
        client.setCredentials({ refresh_token: integration.refresh_token });

        try {
          const { credentials } = await client.refreshAccessToken();

          await saveIntegration({
            user_id: integration.user_id,
            service: integration.service,
            refresh_token: integration.refresh_token,
            access_token: credentials.access_token ?? undefined,
            expiry_date: credentials.expiry_date ?? undefined,
            scopes: integration.scopes
          });
          
          console.log(`✅ Refreshed ${integration.service}`);
        } catch (err: any) {
          console.error(`❌ Failed to refresh ${integration.service} for ${integration.user_id}:`, err.message);
        }
      }
    }
  } catch (error: any) {
    console.error('Proactive Refresh Job Error:', error.message);
  }
  
  console.log('--- Proactive Refresh Job Completed ---');
}, { connection: createWorkerConnection() });

// Schedule the repeatable job if it doesn't exist
export async function scheduleRefreshJob() {
    await refreshQueue.add('token-refresh-repeatable', {}, {
        repeat: {
            pattern: '*/10 * * * *' // Every 10 minutes
        }
    });
}
