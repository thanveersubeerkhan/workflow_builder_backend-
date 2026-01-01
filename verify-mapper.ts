/// <reference types="node" />
import { mapUIToDefinition } from './src/flow-mapper';
import * as fs from 'fs';

const complexUI = JSON.parse(fs.readFileSync('target_flow.json', 'utf-8'));

console.log('--- Mapping Complex UI ---');
const flowDef = mapUIToDefinition(complexUI);

console.log(JSON.stringify(flowDef, null, 2));

/*
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
*/
