
import { executeFlow } from './src/worker';
import { mapUIToDefinition } from './src/flow-mapper';
import * as fs from 'fs';
import { pool } from './src/db';

// Mock DB queries to avoid actual DB writes/reads during verification
// We just want to test the logic flow
const mockPoolQuery = async (text: string, params: any[]) => {
    if (text.includes('INSERT INTO flow_runs')) {
        return { rows: [{ id: 'mock-run-id' }] };
    }
    if (text.includes('SELECT is_active')) {
        return { rows: [{ is_active: true }] };
    }
    if (text.includes('UPDATE flow_runs')) {
        return { rows: [] };
    }
    return { rows: [] };
};

// @ts-ignore
pool.query = mockPoolQuery;

async function runVerification() {
    console.log('--- Verifying Execution Logic ---');
    
    // 1. Load Definition
    const complexUI = JSON.parse(fs.readFileSync('target_flow.json', 'utf-8'));
    const definition = mapUIToDefinition(complexUI);

    console.log('Flow Definition Loaded');

    // 2. Mock Engine Execution (so we don't actually call Gmail)
    // We need to spy on runAction or mock it.
    // Since we import executeFlow from worker, and worker imports runAction from engine...
    // We can't easily mock execution without rewiring.
    // Instead, we can rely on the fact that if auth is missing, it might fail or warn.
    // Or we can just let it fail and check the flow structure.
    
    // Better: We can mock the pieces in the definition or the params to be "logger" potentially?
    // But we want to test the *structure*.
    
    // Let's rely on the engine's "runAction" behaviour.
    // If we want to safely test, we can override the `definition` steps pieces to be 'logger' temporarily?
    // Or just run it. If it fails on auth, that's fine, as long as it ATTEMPTED the right steps.
    
    // Let's modify the definition in-memory to use 'logger' for all steps to avoid side effects
    definition.steps.forEach((step: any) => {
        convertStepToLogger(step);
    });
    
    console.log('Step pieces converted to "logger" for safe execution simulation.');

    // 3. Execute
    const result = await executeFlow({
        flowId: 'test-flow',
        userId: 'test-user',
        definition: definition as any,
        triggerData: { firedAt: new Date().toISOString() },
        onEvent: (event, data) => {
            console.log(`[Event] ${event}:`, JSON.stringify(data));
        }
    });

    console.log('Execution Result:', result);
}

function convertStepToLogger(step: any) {
    step.piece = 'logger';
    step.action = 'log';
    step.params = { message: `Executed ${step.name} (${step.displayName})` };
    
    if (step.onTrue) step.onTrue.forEach(convertStepToLogger);
    if (step.onFalse) step.onFalse.forEach(convertStepToLogger);
    if (step.branches) step.branches.forEach((b: any) => b.forEach(convertStepToLogger));
}

runVerification();
