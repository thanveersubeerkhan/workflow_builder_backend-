import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { authRouter } from './auth.js';
import { tokenRouter } from './tokens.js';
import { disconnectRouter } from './disconnect.js';
import { pool } from './db.js';
import { runAction } from './engine.js';
import { flowQueue } from './queues.js';
import { mapUIToDefinition } from './flow-mapper.js';
import './worker.js';
import { scheduleRefreshJob } from './refresh-worker.js';
import { scheduleTriggerJob } from './trigger-worker.js';

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

// Service Information & Status Endpoint
app.get('/api/services', async (req: express.Request, res: express.Response) => {
  const userId = req.query.userId as string;

  if (!userId) {
    return res.status(400).json({ success: false, error: 'userId is required' });
  }

  try {
    // 1. Get all service definitions from DB
    const metadataRes = await pool.query('SELECT * FROM services_metadata');
    const servicesMetadata = metadataRes.rows;

    // 2. Get connected services for this user
    const dbRes = await pool.query(
      'SELECT service FROM google_integrations WHERE user_id = $1',
      [userId]
    );
    const connectedServices = new Set(dbRes.rows.map(row => row.service));

    // 3. Merge metadata with connection status
    const services = servicesMetadata.map(service => ({
      ...service,
      connected: connectedServices.has(service.id)
    }));

    res.json({ success: true, data: services });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

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

// 1. Create Flow
app.post('/api/flows', async (req: express.Request, res: express.Response) => {
  const { userId, name, ui_definition } = req.body;
  
  // Auto-map UI to Definition
  const definition = mapUIToDefinition(ui_definition || { nodes: [], edges: [] });

  try {
    const result = await pool.query(
      'INSERT INTO flows (user_id, name, definition, ui_definition) VALUES ($1, $2, $3, $4) RETURNING *',
      [userId, name, JSON.stringify(definition), JSON.stringify(ui_definition || { nodes: [], edges: [] })]
    );
    const flow = result.rows[0];

    // Added to queue for immediate first run if valid and active
    if (definition.trigger && flow.is_active) {
      await flowQueue.add(`flow-init-${flow.id}`, {
        flowId: flow.id,
        userId,
        definition
      });
    }

    res.json({ success: true, flowId: flow.id, flow });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 2. List User Flows
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

// 3. Get Single Flow Detail
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

// 4. Update Flow (Full Support with Auto-Mapping)
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
      // Auto-map UI to Definition
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

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(flowId);
    const query = `
      UPDATE flows 
      SET ${updates.join(', ')}, updated_at = now() 
      WHERE id = $${paramIdx} 
      RETURNING *
    `;

    const result = await pool.query(query, values);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Flow not found' });

    res.json({ success: true, flow: result.rows[0] });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
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
