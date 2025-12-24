import express from 'express';
import { getIntegration, saveIntegration } from './db.js';
import { createOAuthClient } from './google.js';

export const tokenRouter = express.Router();

/**
 * Endpoint for the Workflow Engine to get a VALID Access Token.
 * It automatically refreshes if needed.
 */
tokenRouter.get('/:userId/:service', async (req, res) => {
  const { userId, service } = req.params;

  try {
    const integration = await getIntegration(userId, service);

    if (!integration) {
      return res.status(404).json({ error: 'No integration found' });
    }

    const now = Date.now();
    
    // Check if token is expired (or expires in the next 5 minutes)
    if (integration.expiry_date && (integration.expiry_date < now + 5 * 60 * 1000)) {
      console.log(`[TokenProvider] Refreshing expired token for ${userId}/${service}...`);
      
      const client = createOAuthClient();
      client.setCredentials({
        refresh_token: integration.refresh_token,
      });

      const { credentials } = await client.refreshAccessToken();

      // Update Database
      await saveIntegration({
        user_id: userId,
        service,
        refresh_token: integration.refresh_token, // Original refresh token persists
        access_token: credentials.access_token ?? undefined,
        expiry_date: credentials.expiry_date ?? undefined,
        scopes: integration.scopes
      });

      return res.json({
        access_token: credentials.access_token,
        expiry_date: credentials.expiry_date
      });
    }

    // Still valid
    res.json({
      access_token: integration.access_token,
      expiry_date: integration.expiry_date
    });

  } catch (error: any) {
    console.error('Token Retrieval Error:', error);
    res.status(500).json({ error: 'Failed to retrieve token', details: error.message });
  }
});
