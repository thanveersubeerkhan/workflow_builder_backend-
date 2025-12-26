import { performTriggerScan } from '../trigger-worker.js';
import { pool } from '../db.js';

async function testTrigger() {
  console.log('--- Trigger Scanner Test ---');
  try {
    const result = await performTriggerScan();
    console.log('Result:', result);
    process.exit(0);
  } catch (error) {
    console.error('Test Failed:', error);
    process.exit(1);
  }
}

testTrigger();
