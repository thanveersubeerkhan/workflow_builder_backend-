import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import { authRouter } from './auth.js';
import { tokenRouter } from './tokens.js';
import { disconnectRouter } from './disconnect.js';
import { pool, getIntegration } from './db.js';
import { runAction } from './engine.js';
import { mapUIToDefinition } from './flow-mapper.js';
import { executeFlow } from './worker.js';
import { performTokenRefresh } from './refresh-worker.js';
import { performTriggerScan, dispatchWorkflowExecution } from './trigger-worker.js';
import { getUserRepos, getRepoIssues } from './github.js';


dotenv.config();

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 3000;

const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    credentials: true
  }
});

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

// Routes
app.use('/auth', authRouter);
app.use('/api/tokens', tokenRouter);
app.use('/api/disconnect', disconnectRouter);

// Socket.IO Logic
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('join-flow', (flowId) => {
    socket.join(`flow:${flowId}`);
    console.log(`Socket ${socket.id} joined flow:${flowId}`);
  });

  socket.on('update-flow', async (data, callback) => {
    const { flowId, name, ui_definition, is_active } = data;

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
        const active = is_active === true || is_active === 'true';
        values.push(active);
        
        // If activating, set next_run_time = NOW to trigger immediate run
        if (active) {
          updates.push(`next_run_time = $${paramIdx++}`);
          values.push(Date.now());
        }
      }

      if (updates.length === 0) {
        if (callback) callback({ error: 'No fields to update' });
        return;
      }

      values.push(flowId);
      const result = await pool.query(
        `UPDATE flows SET ${updates.join(', ')}, updated_at = now() WHERE id = $${paramIdx} RETURNING *`,
        values
      );

      if (result.rowCount === 0) {
        if (callback) callback({ error: 'Flow not found' });
        return;
      }
      const updatedFlow = result.rows[0];

      // Broadcast update to other clients in the flow room
      socket.to(`flow:${flowId}`).emit('flow-updated', updatedFlow);

      if (callback) callback({ success: true, flow: updatedFlow });

      // If just activated, trigger an instant scan bypass
      if (is_active === true || is_active === 'true') {
        console.log(`[Socket] ⚡ Instant scan triggered for newly activated flow: ${flowId}`);
        performTriggerScan({ flowId }).catch(err => {
          console.error(`[Socket] Error in initial scan for ${flowId}:`, err.message);
        });
      }
    } catch (error: any) {
      console.error('Error updating flow via socket:', error);
      if (callback) callback({ error: error.message });
    }
  });

  socket.on('create-flow', async (data, callback) => {
      const { userId, name, ui_definition } = data;
      const definition = mapUIToDefinition(ui_definition || { nodes: [], edges: [] });
      try {
        const result = await pool.query(
          'INSERT INTO flows (user_id, name, definition, ui_definition, is_active) VALUES ($1, $2, $3, $4, $5) RETURNING *',
          [userId, name, JSON.stringify(definition), JSON.stringify(ui_definition || { nodes: [], edges: [] }), false]
        );
        if (callback) callback({ success: true, flow: result.rows[0] });
      } catch (error: any) {
        if (callback) callback({ success: false, error: error.message });
      }
  });

  socket.on('list-flows', async (userId, callback) => {
      if (!userId) {
          if (callback) callback({ error: 'userId is required' });
          return;
      }
      try {
        const result = await pool.query(
          'SELECT id, name, is_active, created_at, updated_at FROM flows WHERE user_id = $1 ORDER BY created_at DESC',
          [userId]
        );
        if (callback) callback({ success: true, flows: result.rows });
      } catch (error: any) {
        if (callback) callback({ error: error.message });
      }
  });

  socket.on('get-flow', async (flowId, callback) => {
      try {
        const result = await pool.query('SELECT * FROM flows WHERE id = $1', [flowId]);
        if (result.rowCount === 0) {
             if (callback) callback({ error: 'Flow not found' });
             return;
        }
        if (callback) callback({ success: true, flow: result.rows[0] });
      } catch (error: any) {
        if (callback) callback({ error: error.message });
      }
  });

  socket.on('delete-flow', async (flowId, callback) => {
      try {
        const result = await pool.query('DELETE FROM flows WHERE id = $1 RETURNING id', [flowId]);
        if (result.rowCount === 0) {
            if (callback) callback({ error: 'Flow not found' });
            return;
        }
        // Broadcast delete? If needed.
        if (callback) callback({ success: true, message: 'Flow deleted' });
      } catch (error: any) {
        if (callback) callback({ error: error.message });
      }
  });

  socket.on('run-flow', async (flowId, callback) => {
      console.log(`Socket ${socket.id} requested run for flow ${flowId}`);
      try {
        const result = await pool.query('SELECT * FROM flows WHERE id = $1', [flowId]);
        if (result.rowCount === 0) {
             if (callback) callback({ error: 'Flow not found' });
             return;
        }
        const flow = result.rows[0];

        const runResult = await dispatchWorkflowExecution({
            flowId: flow.id,
            userId: flow.user_id,
            definition: flow.definition,
            triggerData: { manual: true, source: 'UI' }

        });


        if (callback) callback(runResult);

      } catch (error: any) {
          console.error("Socket run flow error:", error);
          if (callback) callback({ success: false, error: error.message });
      }
  });

  socket.on('run-resume', async (data, callback) => {
      const { runId, flowId } = data;
      console.log(`Socket ${socket.id} requested resume for run ${runId}`);
      try {
        const flowRes = await pool.query('SELECT * FROM flows WHERE id = $1', [flowId]);
        if (flowRes.rowCount === 0) return callback?.({ error: 'Flow not found' });

        const flow = flowRes.rows[0];

        await dispatchWorkflowExecution({
            runId,
            flowId: flow.id,
            userId: flow.user_id,
            definition: flow.definition
        });

        if (callback) callback({ success: true, message: 'Resume started' });
      } catch (error: any) {
          if (callback) callback({ error: error.message });
      }
  });

  // Relay event from Worker -> Server -> Client
  socket.on('worker-relay', (payload) => {
      const { room, event, data } = payload;
      console.log(`[Socket Relay] Received '${event}' for room '${room}' from worker`);
      if (room && event) {
          io.to(room).emit(event, data);
          console.log(`[Socket Relay] Broadcasted to room '${room}'`);
      }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

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
  const { userId, name, ui_definition, definition: explicitDef } = req.body;
  
  // Use explicit definition if provided (for curl tests), otherwise map from UI 
  const definition = explicitDef || mapUIToDefinition(ui_definition || { nodes: [], edges: [] });

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





app.post('/api/flows/:flowId/run', async (req, res) => {
  const { flowId } = req.params;
  const triggerData = req.body || {};
  
  try {
    const result = await pool.query('SELECT * FROM flows WHERE id = $1', [flowId]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Flow not found' });

    const flow = result.rows[0];
    
    const runResult = await dispatchWorkflowExecution({
      flowId: flow.id,
      userId: flow.user_id,
      definition: flow.definition,
      triggerData: req.body.triggerData || { manual: true, source: 'API' }
    });


    res.json(runResult);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/flows/:flowId/runs/:runId/resume', async (req, res) => {
  const { flowId, runId } = req.params;
  console.log(`[API] Manual resume requested for run ${runId} (Flow: ${flowId})`);
  
  try {
    const flowRes = await pool.query('SELECT * FROM flows WHERE id = $1', [flowId]);
    if (flowRes.rowCount === 0) return res.status(404).json({ error: 'Flow not found' });

    const flow = flowRes.rows[0];

    await dispatchWorkflowExecution({
        runId,
        flowId: flow.id,
        userId: flow.user_id,
        definition: flow.definition
    });

    res.json({ success: true, message: 'Resume started' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/flows/:flowId/runs/:runId/reject', async (req, res) => {
    const { flowId, runId } = req.params;
    console.log(`[API] Rejection requested for run ${runId} (Flow: ${flowId})`);

    try {
        const runRes = await pool.query('SELECT * FROM flow_runs WHERE id = $1', [runId]);
        if (runRes.rowCount === 0) return res.status(404).json({ error: 'Run not found' });

        const run = runRes.rows[0];
        let context = run.current_context || { waited_steps: {} };
        if (typeof context === 'string') context = JSON.parse(context);

        // Find the step that is currently waiting (value === true)
        const waitingStep = Object.keys(context.waited_steps || {}).find(k => context.waited_steps[k] === true);

        if (waitingStep) {
            context.waited_steps[waitingStep] = 'rejected';
            
            // Save updated context back to DB before resuming
            await pool.query('UPDATE flow_runs SET current_context = $1 WHERE id = $2', [JSON.stringify(context), runId]);

            const flowRes = await pool.query('SELECT * FROM flows WHERE id = $1', [flowId]);
            const flow = flowRes.rows[0];

            // Dispatch to queue so the engine processes the rejection and stops
            await dispatchWorkflowExecution({
                runId,
                flowId: flow.id,
                userId: flow.user_id,
                definition: flow.definition
            });

            res.json({ success: true, message: 'Flow rejected and terminated' });
        } else {
            res.status(400).json({ error: 'No waiting step found to reject' });
        }
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


// New HTTP Relay Endpoint for Workers
app.post('/api/worker-relay', (req, res) => {
  const { room, event, data } = req.body;
  
  if (!room || !event) {
    return res.status(400).json({ error: 'room and event are required' });
  }

  console.log(`[HTTP Relay] Received '${event}' for room '${room}'`);
  io.to(room).emit(event, data);
  
  res.json({ success: true });
});

// --- Internal Endpoints (Double-Loopback) ---

/**
 * Endpoint for Trigger.dev Scheduler (hits this every 5s)
 * Kicks off a parallel scan for fire conditions.
 */
app.post('/api/internal/scan-trigger', async (req, res) => {
  console.log('[Internal] ⏰ Incoming: scan-trigger from Trigger.dev');
  
  // Fire and forget (Non-blocking)
  performTriggerScan()
    .catch(err => console.error('[Internal] ❌ Scan Error:', err.message))
    .finally(() => console.log('______________________________________________________________________'));
  
  res.status(202).json({ success: true, message: 'Scan started asynchronously' });
});

/**
 * Endpoint for Trigger.dev Executor (The Muscle)
 * Runs the actual flow engine logic.
 */
app.post('/api/internal/execute-flow', async (req, res) => {
  const { runId, flowId, userId, definition, triggerData } = req.body;
  
  if (!flowId || !userId || !definition) {
    return res.status(400).json({ error: 'Missing required fields: flowId, userId, definition' });
  }

  console.log(`[Internal] 🚀 Incoming: execute-flow for Flow: ${flowId}`);
  console.log(`[Internal] 📡 Context:`, JSON.stringify({ runId, userId, triggerData }, null, 2));

  // Fire and forget (Non-blocking)
  executeFlow({
    runId,
    flowId,
    userId,
    definition,
    triggerData,
    onEvent: (event, data) => {
      // Broadcast to Socket.io room
      io.to(`flow:${flowId}`).emit(event, data);
    }
  }).catch(err => {
    console.error(`[Internal] ❌ Execution Error for ${flowId}:`, err.message);
  }).finally(() => {
    console.log('______________________________________________________________________');
  });

  res.status(202).json({ success: true, message: 'Execution started asynchronously' });
});

/**
 * Endpoint for Trigger.dev Refresh Scheduler (hits this every 20m)
 * Finds tokens expiring in < 15m and dispatches them to the queue.
 */
app.post('/api/internal/refresh-tokens-scan', async (req, res) => {
  console.log('[Internal] ⏰ Incoming: refresh-tokens-scan from Trigger.dev');
  
  // Fire and forget (Non-blocking)
  performTokenRefresh()
    .catch(err => console.error('[Internal] ❌ Refresh Scan Error:', err.message))
    .finally(() => console.log('______________________________________________________________________'));
  
  res.status(202).json({ success: true, message: 'Refresh scan started asynchronously' });
});

/**
 * Endpoint for Trigger.dev Refresh Executor
 * Performs the actual OAuth refresh for a specific integration.
 */
app.post('/api/internal/perform-token-refresh', async (req, res) => {
  const { userId, service } = req.body;
  
  if (!userId || !service) {
    return res.status(400).json({ error: 'Missing required fields: userId, service' });
  }

  console.log(`[Internal] 🔄 Incoming: perform-token-refresh for: ${userId} - ${service}`);

  // We will refactor performTokenRefresh to handle single target if passed
  performTokenRefresh({ userId, service })
    .catch(err => console.error(`[Internal] ❌ Refresh Execution Error for ${service}:`, err.message))
    .finally(() => console.log('______________________________________________________________________'));

  res.status(202).json({ success: true, message: 'Token refresh started asynchronously' });
});

app.get('/api/github/repos', async (req, res) => {
  const userId = req.query.userId as string;
  
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  try {
    const integration = await getIntegration(userId, 'github');
    
    if (!integration || !integration.access_token) {
      return res.status(404).json({ error: 'GitHub integration not found or missing access token' });
    }
    
    const repos = await getUserRepos(integration.access_token);
    res.json(repos);
  } catch (error: any) {
    console.error('Error fetching GitHub repos:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/github/issues', async (req, res) => {
  const userId = req.query.userId as string;
  const repository = req.query.repository as string; // Expects "owner/repo"
  
  if (!userId || !repository) {
    return res.status(400).json({ error: 'userId and repository are required' });
  }

  try {
    const integration = await getIntegration(userId, 'github');
    
    if (!integration || !integration.access_token) {
      return res.status(404).json({ error: 'GitHub integration not found or missing access token' });
    }
    
    const [owner, repo] = repository.split('/');
    if (!owner || !repo) {
       return res.status(400).json({ error: 'Repository must be in "owner/repo" format' });
    }

    const issues = await getRepoIssues(integration.access_token, owner, repo);
    res.json(issues);
  } catch (error: any) {
    console.error('Error fetching GitHub issues:', error);
    res.status(500).json({ error: error.message });
  }

});

app.get('/health', (req, res) => res.send('OK'));

httpServer.listen(PORT, () => {
  console.log(`🚀 API Server running on port ${PORT}`);
  console.log(`🔌 Socket.IO enabled`);
});

const shutdown = async (signal: string) => {
  console.log(`\n[Server] ${signal} received. Shutting down...`);
  await pool.end();
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
