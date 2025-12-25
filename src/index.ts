import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { authRouter } from './auth.js';
import { tokenRouter } from './tokens.js';
import { disconnectRouter } from './disconnect.js';
import { pool } from './db.js';
import { runAction } from './engine.js';
import { mapUIToDefinition } from './flow-mapper.js';
import { executeFlow } from './worker.js';
import { performTokenRefresh } from './refresh-worker.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

// Routes
app.use('/auth', authRouter);
app.use('/api/tokens', tokenRouter);
app.use('/api/disconnect', disconnectRouter);

// --- Standard API Endpoints ---

app.get('/api/services', async (req: express.Request, res: express.Response) => {
  const userId = req.query.userId as string;
  if (!userId) return res.status(400).json({ success: false, error: 'userId is required' });

  try {
    const metadataRes = await pool.query('SELECT * FROM services_metadata');
    const servicesMetadata = metadataRes.rows;

    const dbRes = await pool.query(
      'SELECT service FROM google_integrations WHERE user_id = $1',
      [userId]
    );
    const connectedServices = new Set(dbRes.rows.map(row => row.service));

    const services = servicesMetadata.map(service => ({
      ...service,
      connected: connectedServices.has(service.id)
    }));

    res.json({ success: true, data: services });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/run', async (req: express.Request, res: express.Response) => {
  const { userId, service, actionName, params } = req.body;
  try {
    const result = await runAction({ userId, service, actionName, params });
    res.json({ success: true, result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/flows', async (req: express.Request, res: express.Response) => {
  const { userId, name, ui_definition } = req.body;
  const definition = mapUIToDefinition(ui_definition || { nodes: [], edges: [] });

  try {
    const result = await pool.query(
      'INSERT INTO flows (user_id, name, definition, ui_definition, is_active) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [userId, name, JSON.stringify(definition), JSON.stringify(ui_definition || { nodes: [], edges: [] }), false]
    );
    res.json({ success: true, flow: result.rows[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/flows', async (req: express.Request, res: express.Response) => {
  const userId = req.query.userId as string;
  if (!userId) return res.status(400).json({ error: 'userId is required' });

  try {
    const result = await pool.query(
      'SELECT id, name, is_active, created_at, updated_at FROM flows WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    res.json({ success: true, flows: result.rows });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/flows/:flowId', async (req: express.Request, res: express.Response) => {
  const { flowId } = req.params;
  try {
    const result = await pool.query('SELECT * FROM flows WHERE id = $1', [flowId]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Flow not found' });
    res.json({ success: true, flow: result.rows[0] });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/flows/:flowId/runs', async (req: express.Request, res: express.Response) => {
  const { flowId } = req.params;
  try {
    const result = await pool.query(
      'SELECT id, flow_id, status, logs, result, created_at FROM flow_runs WHERE flow_id = $1 ORDER BY created_at DESC LIMIT 50',
      [flowId]
    );
    res.json({ success: true, runs: result.rows });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/flows/:flowId', async (req: express.Request, res: express.Response) => {
  const { flowId } = req.params;
  const { name, ui_definition, is_active } = req.body;

  try {
    const updates = [];
    const values = [];
    let paramIdx = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramIdx++}`);
      values.push(name);
    }
    
    if (ui_definition !== undefined) {
      const definition = mapUIToDefinition(ui_definition);
      updates.push(`ui_definition = $${paramIdx++}`);
      values.push(JSON.stringify(ui_definition));
      updates.push(`definition = $${paramIdx++}`);
      values.push(JSON.stringify(definition));
    }
    
    if (is_active !== undefined) {
      updates.push(`is_active = $${paramIdx++}`);
      values.push(is_active === true || is_active === 'true');
    }

    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

    values.push(flowId);
    const result = await pool.query(
      `UPDATE flows SET ${updates.join(', ')}, updated_at = now() WHERE id = $${paramIdx} RETURNING *`,
      values
    );

    if (result.rowCount === 0) return res.status(404).json({ error: 'Flow not found' });
    const updatedFlow = result.rows[0];

    // Note: We no longer trigger a reactive scan here.
    // The standalone worker will pick up the change within 5 seconds.

    res.json({ success: true, flow: updatedFlow });
  } catch (error: any) {
    if (!res.headersSent) res.status(500).json({ error: error.message });
  }
});

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

app.post('/api/flows/:flowId/run', async (req, res) => {
  const { flowId } = req.params;
  try {
    const result = await pool.query('SELECT * FROM flows WHERE id = $1', [flowId]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Flow not found' });

    const flow = result.rows[0];
    
    const runResult = await executeFlow({
      flowId: flow.id,
      userId: flow.user_id,
      definition: flow.definition
    });

    res.json(runResult);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/connections/:userId', async (req, res) => {
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

app.listen(PORT, () => {
  console.log(`🚀 API Server running on port ${PORT}`);
});

const shutdown = async (signal: string) => {
  console.log(`\n[Server] ${signal} received. Shutting down...`);
  await pool.end();
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
