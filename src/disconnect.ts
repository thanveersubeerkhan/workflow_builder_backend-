import express from 'express';
import { getIntegration, deleteIntegration, pool, decrypt } from './db.js';
import { refreshGitHubAccessToken, revokeGitHubToken } from './github.js';
import { createOAuthClient } from './google.js';
import { refreshMicrosoftAccessToken, revokeMicrosoftToken } from './teams.js';

export const disconnectRouter = express.Router();

disconnectRouter.delete('/connections/:id', async (req, res) => {
    const { id } = req.params;
    try {
      // 1. Get it first to revoke
      const resById = await pool.query('SELECT * FROM integrations WHERE id = $1', [id]);
      if (resById.rows.length === 0) return res.status(404).json({ error: 'Connection not found' });
      
      const integration = resById.rows[0];
  
      // 2. Revoke (Best effort)
      const isMicrosoft = ['microsoft', 'outlook', 'excel', 'word', 'teams', 'onedrive'].includes(integration.service);
      const isGitHub = integration.service === 'github';

      if (integration.service === 'github') {
        // GitHub specific revocation
        if (integration.access_token) {
           try {
             await revokeGitHubToken(integration.access_token); 
           } catch (e: any) {
             console.warn(`[Disconnect] GitHub token revoke failed for ${id}:`, e.message);
           }
        }
      } else if (isMicrosoft) {
        // Microsoft Revocation
        if (integration.access_token) {
          console.log(`[Disconnect] Revoking sessions for Microsoft connection ${id}`);
          await revokeMicrosoftToken(integration.access_token);
        }
      } else if (integration.refresh_token) {
        // Google / Others
        try {
          const client = createOAuthClient();
          await client.revokeToken(decrypt(integration.refresh_token));
          console.log(`[Disconnect] Revoked token for connection ${id}`);
        } catch (e: any) {
          console.warn(`[Disconnect] Token revoke failed for ${id}:`, e.message);
        }
      }
  
      await pool.query('DELETE FROM integrations WHERE id = $1', [id]);
      
      // Delay for stability
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const response: any = { success: true, message: 'Connection removed' };
      if (isMicrosoft) {
        // Force logout from Microsoft to clear session cookies
        response.logoutUrl = 'https://login.microsoftonline.com/common/oauth2/v2.0/logout';
      } else if (isGitHub) {
        // GitHub logout
        response.logoutUrl = 'https://github.com/logout';
      }
      
      res.json(response);
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to remove connection', details: error.message });
    }
});

disconnectRouter.delete('/:userId/:service', async (req, res) => {
  const { userId, service } = req.params;
  try {
    const integration = await getIntegration(userId, service);
    if (!integration) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    // Revoke with Google (Best effort)
    try {
      const client = createOAuthClient();
      await client.revokeToken(integration.refresh_token);
      console.log(`[Disconnect] Successfully revoked Google token for ${service}`);
    } catch (revokeError: any) {
      console.warn(`[Disconnect] Failed to revoke Google token for ${service} (it might already be invalid):`, revokeError.message);
    }

    // Delete from DB (Guaranteed)
    await deleteIntegration(userId, service);
    console.log(`[Disconnect] Deleted ${service} integration from database for user ${userId}`);

    res.json({ message: `Successfully disconnected all ${service} accounts` });
  } catch (error: any) {
    console.error('Disconnect Error:', error);
    res.status(500).json({ error: 'Failed to disconnect', details: error.message });
  }
});

