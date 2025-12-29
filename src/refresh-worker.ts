import { getAllIntegrations, getIntegration, getIntegrationById, saveIntegration, withAdvisoryLock } from './db.js';
import { refreshGitHubAccessToken } from './github.js';
import { createOAuthClient } from './google.js';
import { tasks } from "@trigger.dev/sdk/v3";

interface RefreshOptions {
  userId?: string;
  service?: string;
  integrationId?: string;
}

/**
 * Proactively refreshes Google & GitHub OAuth tokens.
 * Refactored for "Double-Loopback" architecture.
 */
export async function performTokenRefresh(options: RefreshOptions = {}) {
  const { userId, service, integrationId } = options;
  const startTime = Date.now();

  // CASE 1: Targeted Refresh (The Execution Muscle)
  if ((userId && service) || (integrationId)) {
    console.log(`[Refresh] 🔄 Targeted Execution: ${integrationId || (userId + '-' + service)}`);
    try {
      let integration;
      if (integrationId) {
          integration = await getIntegrationById(integrationId);
      } else if (userId && service) {
          integration = await getIntegration(userId, service);
      }

      if (!integration) throw new Error(`Integration not found`);

      // Ensure we have the user_id and service from the fetched integration if we didn't start with it
      const currentUserId = integration.user_id;
      const currentService = integration.service;

      // GitHub Refresh Logic
      if (currentService === 'github') {
         // If no refresh token exists, we can't do anything (legacy PAT or old auth)
         if (!integration.refresh_token) {
             console.log(`[Refresh] ⚠️ Skipping GitHub refresh: No refresh token available.`);
             return { success: false, reason: 'no_refresh_token' };
         }

         const newTokens = await refreshGitHubAccessToken(integration.refresh_token);
         
         await saveIntegration({
            id: integration.id,
            user_id: currentUserId,
            service: currentService,
            refresh_token: newTokens.refresh_token || integration.refresh_token, 
            access_token: newTokens.access_token,
            expiry_date: newTokens.expiry_date,
            scopes: integration.scopes
         });
         console.log(`[Refresh] ✅ GitHub Token refreshed successfully for ${integration.id}.`);
         return { success: true };
      }

      const client = createOAuthClient();
      client.setCredentials({ refresh_token: integration.refresh_token });
      const { credentials } = await client.refreshAccessToken();

      await saveIntegration({
        id: integration.id,
        user_id: currentUserId,
        service: currentService,
        refresh_token: integration.refresh_token,
        access_token: credentials.access_token ?? undefined,
        expiry_date: credentials.expiry_date ?? undefined,
        scopes: integration.scopes
      });
      console.log(`[Refresh] ✅ Token refreshed successfully for ${currentService} (ID: ${integration.id}). Duration: ${Date.now() - startTime}ms`);
      return { success: true };
    } catch (err: any) {
      console.error(`[Refresh] ❌ Failed to refresh ${integrationId}:`, err.message);
      throw err;
    }
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
        const expiresAt = Number(integration.expiry_date);
        const timeUntilExpiry = expiresAt - now;
        
        if (integration.expiry_date && (expiresAt < now + buffer)) {
          console.log(`[Refresh] 🚨 Token Expiring: ${integration.user_id} - ${integration.service} (Expires in ${Math.round(timeUntilExpiry/1000/60)}m)`);
          
          // DISPATCH to Trigger.dev Queue
          console.log(`[Refresh] 🚀 Dispatching loopback refresh for ${integration.id}...`);
          try {
            await tasks.trigger("token-refresh-executor", {
              integrationId: integration.id, // Explicit ID
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
      
      const duration = Date.now() - startTime;
      console.log(`[Refresh] ✅ Global scan complete. Duration: ${duration}ms, Dispatched: ${dispatchCount}`);
      return { success: true, totalDispatched: dispatchCount };
    } catch (error: any) {
      console.error('[Refresh] ❌ Fatal Scan Error:', error.message);
      throw error;
    }
  });
}
