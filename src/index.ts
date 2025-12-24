import express from 'express';
import dotenv from 'dotenv';
import { authRouter } from './auth.js';
import { tokenRouter } from './tokens.js';
import { disconnectRouter } from './disconnect.js';
import { pool } from './db.js';
import { runAction } from './engine.js';
import { flowQueue } from './queues.js';
import './worker.js';
import { scheduleRefreshJob } from './refresh-worker.js';
import { scheduleTriggerJob } from './trigger-worker.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Routes
app.use('/auth', authRouter);
app.use('/api/tokens', tokenRouter);
app.use('/api/disconnect', disconnectRouter);

// Engine Execution Endpoint (Single Action)
app.post('/api/run', async (req: express.Request, res: express.Response) => {
  const { userId, service, actionName, params } = req.body;
  try {
    const result = await runAction({ userId, service, actionName, params });
    res.json({ success: true, result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create & Queue Flow Endpoint
app.post('/api/flows', async (req: express.Request, res: express.Response) => {
  const { userId, name, definition } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO flows (user_id, name, definition) VALUES ($1, $2, $3) RETURNING *',
      [userId, name, JSON.stringify(definition)]
    );
    const flow = result.rows[0];

    // Added to queue for immediate first run
    await flowQueue.add(`flow-init-${flow.id}`, {
      flowId: flow.id,
      userId,
      definition
    });

    res.json({ success: true, message: 'Flow created and queued', flowId: flow.id });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete Flow
app.delete('/api/flows/:flowId', async (req, res) => {
  const { flowId } = req.params;
  try {
    const result = await pool.query('DELETE FROM flows WHERE id = $1 RETURNING id', [flowId]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Flow not found' });
    res.json({ success: true, message: 'Flow deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Stop/Start Flow (Toggle Status)
app.patch('/api/flows/:flowId/status', async (req, res) => {
  const { flowId } = req.params;
  const { status } = req.body; // 'active' or 'inactive'

  if (!['active', 'inactive'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status. Use active or inactive.' });
  }

  try {
    const result = await pool.query(
      'UPDATE flows SET status = $1 WHERE id = $2 RETURNING id, status',
      [status, flowId]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Flow not found' });
    res.json({ success: true, flow: result.rows[0] });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Manual Run (Queue existing flow)
app.post('/api/flows/:flowId/run', async (req, res) => {
  const { flowId } = req.params;
  try {
    const result = await pool.query('SELECT * FROM flows WHERE id = $1', [flowId]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Flow not found' });

    const flow = result.rows[0];
    await flowQueue.add(`manual-run-${flow.id}-${Date.now()}`, {
      flowId: flow.id,
      userId: flow.user_id,
      definition: flow.definition
    });

    res.json({ success: true, message: 'Flow execution queued' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Connection Status API
app.get('/api/connections/:userId', async (req: express.Request, res: express.Response) => {
  const { userId } = req.params;
  try {
    const result = await pool.query(
      'SELECT service, created_at FROM google_integrations WHERE user_id = $1',
      [userId]
    );
    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/health', (req, res) => res.send('OK'));

app.listen(PORT, async () => {
  console.log(`
🚀 SaaS Google Integrations Backend (TypeScript) is running!
----------------------------------------------
Base URL: ${process.env.BASE_URL}
OAuth Connect: ${process.env.BASE_URL}/auth/connect/:service?userId=...
Token Provider: GET /api/tokens/:userId/:service
Disconnect: DELETE /api/disconnect/:userId/:service
----------------------------------------------
  `);
  
  // Starting Proactive background jobs
  await scheduleRefreshJob();
  await scheduleTriggerJob();
});
