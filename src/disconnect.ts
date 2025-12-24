import express from 'express';
import { getIntegration, deleteIntegration } from './db.js';
import { createOAuthClient } from './google.js';

export const disconnectRouter = express.Router();

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
      // We continue anyway so the user can at least remove it from our DB
    }

    // Delete from DB (Guaranteed)
    await deleteIntegration(userId, service);
    console.log(`[Disconnect] Deleted ${service} integration from database for user ${userId}`);

    res.json({ message: `Successfully disconnected ${service}` });
  } catch (error: any) {
    console.error('Disconnect Error:', error);
    res.status(500).json({ error: 'Failed to disconnect', details: error.message });
  }
});
