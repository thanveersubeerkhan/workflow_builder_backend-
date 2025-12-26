import { getAllIntegrations, getIntegration, saveIntegration, withAdvisoryLock } from './db.js';
import { createOAuthClient } from './google.js';
import { tasks } from "@trigger.dev/sdk/v3";

interface RefreshOptions {
  userId?: string;
  service?: string;
}

/**
 * Proactively refreshes Google OAuth tokens.
 * Refactored for "Double-Loopback" architecture.
 */
export async function performTokenRefresh(options: RefreshOptions = {}) {
  const { userId, service } = options;

  // CASE 1: Targeted Refresh (The Execution Muscle)
  if (userId && service) {
    console.log(`[Refresh] 🔄 Targeted Refresh: ${userId} - ${service}`);
    const integration = await getIntegration(userId, service);
    if (!integration) throw new Error(`Integration not found for ${userId}/${service}`);

    const client = createOAuthClient();
    client.setCredentials({ refresh_token: integration.refresh_token });
    const { credentials } = await client.refreshAccessToken();

    await saveIntegration({
      user_id: userId,
      service,
      refresh_token: integration.refresh_token,
      access_token: credentials.access_token ?? undefined,
      expiry_date: credentials.expiry_date ?? undefined,
      scopes: integration.scopes
    });
    console.log(`[Refresh] ✅ Successfully refreshed ${service} for ${userId}`);
    return { success: true };
  }

  // CASE 2: Global Scan (The Brain)
  console.log('[Refresh] ⏰ Starting Global Expiry Scan...');
  return await withAdvisoryLock('token-refresh:global', async () => {
    try {
      const integrations = await getAllIntegrations();
      const now = Date.now();
      const buffer = 15 * 60 * 1000; // 15 mins
      let dispatchCount = 0;

      for (const integration of integrations) {
        if (integration.expiry_date && (Number(integration.expiry_date) < now + buffer)) {
          console.log(`[Refresh] Found expiring token: ${integration.user_id} - ${integration.service}. Dispatching to queue...`);
          
          // DISPATCH to Trigger.dev Queue
          console.log(`[Refresh] 🚀 Dispatching token-refresh-executor for ${integration.user_id}...`);
          try {
            await tasks.trigger("token-refresh-executor", {
              userId: integration.user_id,
              service: integration.service
            });
            console.log(`[Refresh] ✅ Dispatch successful.`);
          } catch (triggerErr: any) {
            console.error(`[Refresh] ❌ Dispatch failed:`, triggerErr.message);
          }

          dispatchCount++;
        }
      }
      
      console.log(`[Refresh] Scan complete. Dispatched ${dispatchCount} refresh tasks.`);
      return { success: true, totalDispatched: dispatchCount };
    } catch (error: any) {
      console.error('[Refresh] Scan Error:', error.message);
      throw error;
    }
  });
}
