import { getAllIntegrations, getIntegration, getIntegrationById, saveIntegration, withAdvisoryLock, getExpiringIntegrations } from './db.js';
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
    let currentUserId: string | undefined;
    let currentService: string | undefined;

    try {
      let integration;
      if (integrationId) {
          integration = await getIntegrationById(integrationId);
      } else if (userId && service) {
          integration = await getIntegration(userId, service);
      }

      if (!integration) throw new Error(`Integration not found`);

      currentUserId = integration.user_id;
      currentService = integration.service;

      // GitHub Refresh Logic
      if (currentService === 'github') {
         if (!integration.refresh_token) {
             console.log(`[Refresh] ⚠️ Skipping GitHub refresh: No refresh token available.`);
             return { success: false, reason: 'no_refresh_token' };
         }

         if (!integration.expiry_date) {
             console.log(`[Refresh] ℹ️ Skipping GitHub refresh: No expiry date found (Token likely does not expire).`);
             return { success: true, skipped: true };
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

      // Microsoft Refresh Logic
      if (['microsoft', 'outlook', 'excel', 'word', 'teams', 'onedrive'].includes(currentService)) {
          const { refreshMicrosoftAccessToken } = await import('./teams.js');
          const newData = await refreshMicrosoftAccessToken(integration.refresh_token, currentService);
          
          await saveIntegration({
            id: integration.id,
            user_id: currentUserId,
            service: currentService,
            refresh_token: newData.refresh_token || integration.refresh_token,
            access_token: newData.access_token,
            expiry_date: Date.now() + (newData.expires_in * 1000),
            scopes: integration.scopes
          });
          console.log(`[Refresh] ✅ Microsoft Token refreshed for ${integration.id}.`);
          return { success: true };
      }

      // Google OAuth
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
      const errorMsg = err.response?.data?.error_description || err.response?.data?.error || err.message;
      const context = currentService ? `${currentService} for User ${currentUserId}` : integrationId;
      console.error(`[Refresh] ❌ Failed to refresh ${context}:`, errorMsg);
      
      if (currentService === 'github' && (errorMsg.includes('incorrect or expired') || errorMsg.includes('revoked'))) {
          console.warn(`[Refresh] ⚠️ GitHub Token is likely invalid permanently. User needs to reconnect.`);
      }
      
      throw new Error(`${currentService || 'Service'} Refresh Failed: ${errorMsg}`);
    }
  } else {
    // CASE 2: Global Scan (The Brain)
    console.log('[Refresh] ⏰ Starting Optimized Global Expiry Scan...');
    return await withAdvisoryLock('token-refresh:global', async () => {
      try {
        const SCAN_WINDOW = 35 * 60 * 1000; // 35 minutes
        const IGNORE_THRESHOLD = 2 * 24 * 60 * 60 * 1000; // 2 days

        const integrations = await getExpiringIntegrations(SCAN_WINDOW, IGNORE_THRESHOLD);
        const now = Date.now();
        let dispatchCount = 0;

        for (const integration of integrations) {
          const expiresAt = Number(integration.expiry_date);
          const timeUntilExpiry = expiresAt - now;
          
          console.log(`[Refresh] 🚨 Token Expiring: ${integration.user_id} - ${integration.service} (Expires in ${Math.round(timeUntilExpiry/1000/60)}m)`);
          
          // DISPATCH to Trigger.dev Queue
          console.log(`[Refresh] 🚀 Dispatching loopback refresh for ${integration.id}...`);
          try {
            await tasks.trigger("token-refresh-executor", {
              integrationId: integration.id, 
              userId: integration.user_id,
              service: integration.service
            });
            console.log(`[Refresh] ✅ Dispatch successful.`);
          } catch (triggerErr: any) {
            console.error(`[Refresh] ❌ Dispatch failed:`, triggerErr.message);
          }

          dispatchCount++;
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
}
