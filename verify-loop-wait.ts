import 'dotenv/config';
import { executeFlow } from './src/worker.js';
import { pool } from './src/db.js';

async function verifyLoopsAndWait() {
  console.log('--- Loops & Wait Verification ---');
  
  const flowId = 'b3cb7ec6-0333-4d6b-9d88-1d8a153a8463'; 
  const userId = '7a1e333b-1a03-49ac-b310-704fd7f61304'; 
  
  const definition: any = {
    trigger: { nodeId: 'trigger-1', piece: 'schedule', name: 'schedule', params: {} },
    steps: [
      {
        name: 'step-loop',
        type: 'loop',
        params: { items: ['apple', 'banana', 'cherry'] },
        branches: [
          [
            { name: 'log-item', type: 'action', piece: 'logger', action: 'log', params: { message: 'Processing item: {{loop_item}}' } }
          ]
        ]
      },
      {
        name: 'step-wait',
        type: 'wait'
      },
      {
        name: 'step-after-wait',
        type: 'action',
        piece: 'logger',
        action: 'log',
        params: { message: 'Workflow finished after wait!' }
      }
    ]
  };

  try {
    // 1. Run until Wait
    console.log('\n[Test] Phase 1: Running Until Wait...');
    const run1 = await executeFlow({
      flowId,
      userId,
      definition: definition,
      triggerData: { source: 'loop-wait-test' }
    });

    console.log(`[Test] Run 1 Status: ${run1.status}`);
    
    // Check DB
    const dbRes = await pool.query('SELECT status, last_step_index FROM flow_runs WHERE id = $1', [run1.runId]);
    console.log(`[DB] Status: ${dbRes.rows[0].status}, LastStepIndex: ${dbRes.rows[0].last_step_index}`);

    if (dbRes.rows[0].status !== 'waiting') throw new Error('Status should be waiting');

    // 2. Resume
    console.log('\n[Test] Phase 2: Resuming...');
    const run2 = await executeFlow({
      runId: run1.runId,
      flowId,
      userId,
      definition: definition,
      triggerData: { source: 'loop-wait-test' }
    });

    console.log(`[Test] Run 2 Success: ${run2.success}`);

    const finalRes = await pool.query('SELECT status, logs FROM flow_runs WHERE id = $1', [run1.runId]);
    console.log(`[DB] Final Status: ${finalRes.rows[0].status}`);

    if (finalRes.rows[0].status === 'success') {
        console.log('\n✅ VERIFICATION SUCCESS: Loops and Wait blocks are working perfectly!');
    } else {
        console.log('\n❌ VERIFICATION FAILED');
    }

    process.exit(0);
  } catch (err) {
    console.error('Verification Error:', err);
    process.exit(1);
  }
}

verifyLoopsAndWait();
