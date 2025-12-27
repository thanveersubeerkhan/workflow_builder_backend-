import 'dotenv/config';
import { executeFlow } from './src/worker.js';
import { pool } from './src/db.js';

async function verifyResumability() {
  console.log('--- Resumability Verification ---');
  
  const flowId = 'b3cb7ec6-0333-4d6b-9d88-1d8a153a8463'; 
  const userId = '7a1e333b-1a03-49ac-b310-704fd7f61304'; 
  
  const definition = {
    trigger: { nodeId: 'trigger-1', piece: 'schedule', name: 'schedule', params: {} },
    steps: [
      { name: 'step-1', piece: 'logger', action: 'log', params: { message: 'Logging from Step 1' } },
      { name: 'step-2', piece: 'logger', action: 'log', params: { message: 'Logging from Step 2' } }
    ]
  };

  try {
    // 1. Start a fresh run but mock a failure after Step 1
    console.log('\n[Test] Phase 1: Running Step 1 only...');
    
    // We'll use a modified definition that only has 1 step for now to simulate a "stop"
    const partialDefinition = { ...definition, steps: [definition.steps[0]] };
    
    const run1 = await executeFlow({
      flowId,
      userId,
      definition: partialDefinition,
      triggerData: { source: 'unit-test' }
    });

    console.log(`[Test] Run 1 Finished. RunId: ${run1.runId}`);

    // 2. Check Database State
    const dbRes = await pool.query('SELECT * FROM flow_runs WHERE id = $1', [run1.runId]);
    const state = dbRes.rows[0];
    console.log(`[DB] last_step_index: ${state.last_step_index}`);
    console.log(`[DB] current_context keys: ${Object.keys(state.current_context.steps)}`);

    if (state.last_step_index !== 0) throw new Error('last_step_index should be 0');

    // 3. Resume the FULL flow using the SAME runId
    console.log('\n[Test] Phase 2: Resuming from checkpoint...');
    const run2 = await executeFlow({
      runId: run1.runId,
      flowId,
      userId,
      definition: definition, // Full definition now
      triggerData: { source: 'unit-test' }
    });

    console.log(`[Test] Run 2 Finished. Success: ${run2.success}`);

    // 4. Final Verification
    const finalRes = await pool.query('SELECT * FROM flow_runs WHERE id = $1', [run1.runId]);
    const finalState = finalRes.rows[0];
    console.log(`[DB] Final last_step_index: ${finalState.last_step_index}`);
    console.log(`[DB] Final status: ${finalState.status}`);

    if (finalState.last_step_index === 1 && finalState.status === 'success') {
      console.log('\n✅ VERIFICATION SUCCESS: Flow was checkpointed and resumed correctly!');
    } else {
      console.log('\n❌ VERIFICATION FAILED');
    }

    process.exit(0);
  } catch (err) {
    console.error('Verification Error:', err);
    process.exit(1);
  }
}

verifyResumability();
