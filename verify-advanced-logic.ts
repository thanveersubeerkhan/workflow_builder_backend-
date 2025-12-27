import 'dotenv/config';
import { executeFlow } from './src/worker.js';
import { pool } from './src/db.js';

async function verifyAdvancedLogic() {
  console.log('--- Advanced Logic Verification (Parallel & Condition) ---');
  
  const flowId = 'b3cb7ec6-0333-4d6b-9d88-1d8a153a8463'; 
  const userId = '7a1e333b-1a03-49ac-b310-704fd7f61304'; 
  
  const definition: any = {
    trigger: { nodeId: 'trigger-1', piece: 'schedule', name: 'schedule', params: {} },
    steps: [
      { 
        name: 'step-init', 
        type: 'action', 
        piece: 'logger', 
        action: 'log', 
        params: { message: 'Initializing Workflow' } 
      },
      {
        name: 'step-parallel',
        type: 'parallel',
        branches: [
          [
            { name: 'b1-s1', type: 'action', piece: 'logger', action: 'log', params: { message: 'Branch 1 - A' } },
            { name: 'b1-s2', type: 'action', piece: 'logger', action: 'log', params: { message: 'Branch 1 - B' } }
          ],
          [
            { name: 'b2-s1', type: 'action', piece: 'logger', action: 'log', params: { message: 'Branch 2 - Alpha' } }
          ]
        ]
      },
      {
        name: 'step-cond',
        type: 'condition',
        condition: '{{steps.step-init.data.success}}', // Should be true
        onTrue: [
          { name: 'true-branch', type: 'action', piece: 'logger', action: 'log', params: { message: 'Condition path: TRUE' } }
        ],
        onFalse: [
          { name: 'false-branch', type: 'action', piece: 'logger', action: 'log', params: { message: 'Condition path: FALSE' } }
        ]
      },
      {
        name: 'step-final',
        type: 'action',
        piece: 'logger',
        action: 'log',
        params: { 
          message: 'Final result from parallel b2: {{steps.b2-s1.data.message}}' 
        }
      }
    ]
  };

  try {
    console.log('\n[Test] Running Advanced Workflow...');
    
    const run = await executeFlow({
      flowId,
      userId,
      definition: definition,
      triggerData: { source: 'advanced-test' }
    });

    console.log(`\n[Test] Execution Finished. Success: ${run.success}`);

    // Check Database Results
    const dbRes = await pool.query('SELECT * FROM flow_runs WHERE id = $1', [run.runId]);
    const state = dbRes.rows[0];
    
    console.log('\n--- Final Context Keys ---');
    console.log(Object.keys(state.current_context.steps));
    
    const context = state.current_context;
    
    const expectedKeys = ['step-init', 'b1-s1', 'b1-s2', 'b2-s1', 'step-parallel', 'true-branch', 'step-cond', 'step-final'];
    const missing = expectedKeys.filter(k => !context.steps[k]);

    if (missing.length === 0) {
      console.log('\n✅ VERIFICATION SUCCESS: All advanced logic blocks executed and merged context correctly!');
      
      const finalMsg = context.steps['step-final']?.data?.message;
      console.log(`[Result] Final Message: ${finalMsg}`);
      
      if (finalMsg.includes('Branch 2 - Alpha')) {
          console.log('✅ Variable mapping across parallel branches confirmed!');
      } else {
          console.log('❌ Variable mapping failed!');
      }
    } else {
      console.log(`\n❌ VERIFICATION FAILED. Missing steps in context: ${missing.join(', ')}`);
    }

    process.exit(0);
  } catch (err) {
    console.error('Verification Error:', err);
    process.exit(1);
  }
}

verifyAdvancedLogic();
