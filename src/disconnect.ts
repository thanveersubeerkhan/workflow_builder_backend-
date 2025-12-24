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

    // Revoke with Google
    const client = createOAuthClient();
    await client.revokeToken(integration.refresh_token);

    // Delete from DB
    await deleteIntegration(userId, service);

    res.json({ message: `Successfully disconnected ${service}` });
  } catch (error: any) {
    console.error('Disconnect Error:', error);
    res.status(500).json({ error: 'Failed to disconnect', details: error.message });
  }
});
