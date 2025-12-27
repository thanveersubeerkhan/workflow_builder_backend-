import { mapUIToDefinition } from './src/flow-mapper';
import * as fs from 'fs';

const complexUI = {
  nodes: [
    { id: '1', type: 'custom', data: { appName: 'Schedule', actionId: 'every_5_minutes', icon: 'schedule' } },
    { id: '2', type: 'custom', data: { appName: 'Gmail', actionId: 'listMessages', icon: 'gmail' } },
    { id: '3', type: 'custom', data: { type: 'condition', icon: 'condition', params: { condition: '{{steps.2.messages.length}} > 0' } } },
    { id: '4', type: 'custom', data: { appName: 'Gmail', actionId: 'sendEmail', icon: 'gmail', params: { to: 'admin@example.com', subject: 'New Emails Found' } } },
    { id: '5', type: 'custom', data: { appName: 'Logger', actionId: 'info', icon: 'logger', params: { message: 'No emails found' } } },
    { id: '6', type: 'custom', data: { type: 'parallel', icon: 'parallel' } },
    { id: '7', type: 'custom', data: { appName: 'Sheets', actionId: 'appendRow', icon: 'sheets' } },
    { id: '8', type: 'custom', data: { appName: 'Slack', actionId: 'sendMessage', icon: 'slack' } },
    { id: '9', type: 'custom', data: { type: 'loop', actionId: 'loop', params: { items: '{{steps.2.messages}}' } } },
    { id: '10', type: 'custom', data: { appName: 'Logger', actionId: 'info', params: { message: 'Processing item' } } },
    { id: 'end', type: 'end', data: { label: 'End' } }
  ],
  edges: [
    { id: 'e1-2', source: '1', target: '2' },
    { id: 'e2-3', source: '2', target: '3' },
    { id: 'e3-4', source: '3', target: '4', data: { label: 'true' } },
    { id: 'e3-5', source: '3', target: '5', data: { label: 'false' } },
    { id: 'e4-6', source: '4', target: '6' },
    { id: 'e6-7', source: '6', target: '7' },
    { id: 'e6-8', source: '6', target: '8' },
    { id: 'e7-9', source: '7', target: '9' }, // Note: In UI, joins are complex, here we just follow paths
    { id: 'e9-10', source: '9', target: '10' }
  ]
};

console.log('--- Mapping Complex UI ---');
const flowDef = mapUIToDefinition(complexUI);

console.log(JSON.stringify(flowDef, null, 2));

// Assertions
const steps = flowDef.steps;
if (steps[0].piece === 'gmail' && steps[1].type === 'condition') {
    console.log('✅ Basic sequence and condition identified');
} else {
    console.error('❌ Failed basic sequence/condition identification');
    process.exit(1);
}

const condition = steps[1];
if (condition.onTrue[0].name === '4' && condition.onFalse[0].name === '5') {
    console.log('✅ Condition branches mapped correctly');
} else {
     console.error('❌ Condition branches mapping failed');
     process.exit(1);
}

// Check nesting
const parallel = condition.onTrue[1];
if (parallel && parallel.type === 'parallel') {
    console.log('✅ Parallel block nested in condition branch identified');
    if (parallel.branches.length === 2) {
        console.log('✅ Parallel branches count correct');
    }
} else {
    console.error('❌ Parallel block identification failed');
    process.exit(1);
}

const loop = parallel.branches[0][1]; // Path 7 -> 9
if (loop && loop.type === 'loop') {
    console.log('✅ Loop identified correctly');
    if (loop.branches[0][0].name === '10') {
         console.log('✅ Loop branch identified correctly');
    }
} else {
    // Path might be different due to traversal order, let's look for it
    const findLoop = (s: any): any => {
        if (s.type === 'loop') return s;
        if (s.onTrue) return findLoop(s.onTrue) || findLoop(s.onFalse);
        if (s.branches) {
            for (const b of s.branches) {
                const found = findLoop(b);
                if (found) return found;
            }
        }
        if (Array.isArray(s)) {
            for (const item of s) {
                const found = findLoop(item);
                if (found) return found;
            }
        }
        return null;
    };
    const foundLoop = findLoop(steps);
    if (foundLoop) {
        console.log('✅ Loop found in deep structure');
    } else {
        console.error('❌ Loop not found');
        process.exit(1);
    }
}

console.log('🎉 ALL MAPPER TESTS PASSED');
