import { getAllIntegrations, saveIntegration, withAdvisoryLock } from './db.js';
import { createOAuthClient } from './google.js';

/**
 * Proactively refreshes Google OAuth tokens that are near expiry.
 * Designed to be called by a Cron job or a manual trigger.
 */
export async function performTokenRefresh() {
  console.log('[Refresh] Starting Proactive Token Refresh...');
  
  // Use Postgres Advisory Lock instead of Redis
  const result = await withAdvisoryLock('token-refresh:global', async () => {
    try {
      const integrations = await getAllIntegrations();
      const now = Date.now();
      let refreshCount = 0;

      for (const integration of integrations) {
        // Check if it's expiring in the next 15 minutes
        const buffer = 15 * 60 * 1000;
        if (integration.expiry_date && (Number(integration.expiry_date) < now + buffer)) {
          console.log(`[Refresh] Refreshing: ${integration.user_id} - ${integration.service}`);
          
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
            
            refreshCount++;
            console.log(`[Refresh] ✅ Successfully refreshed ${integration.service}`);
          } catch (err: any) {
            console.error(`[Refresh] ❌ Failed to refresh ${integration.service} for ${integration.user_id}:`, err.message);
          }
        }
      }
      
      return { success: true, totalRefreshed: refreshCount };
    } catch (error: any) {
      console.error('[Refresh] Error:', error.message);
      throw error;
    }
  });

  return result || { success: true, totalRefreshed: 0, skipped: true };
}
