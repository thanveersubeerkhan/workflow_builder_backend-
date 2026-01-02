
import { pool } from './db.js';

const FLOW_ID = '2edd47e5-6853-4523-b5c7-c6ffe73cbcd4';

async function inspect() {
  const res = await pool.query('SELECT ui_definition FROM flows WHERE id = $1', [FLOW_ID]);
  const flow = res.rows[0];
  if (!flow) return console.log('Flow not found');

  const nodes = flow.ui_definition.nodes;
  const edges = flow.ui_definition.edges;

  console.log('--- START NODE (1) OUTBOUND ---');
  const startEdges = edges.filter((e: any) => e.source === '1');
  startEdges.forEach((e: any) => {
       const target = nodes.find((n: any) => n.id === e.target);
       console.log(`Node 1 -> [${e.target}] (${target?.type})`);
  });

  console.log('--- NODES WITH MERGE FLAGS ---');
  nodes.forEach((n: any) => {
      if (n.data?.isMergeNode || n.data?.isMergePlaceholder) {
          console.log(`[${n.id}] ${n.type} label="${n.data.label}" isMergeNode=${n.data.isMergeNode} isMergePlaceholder=${n.data.isMergePlaceholder}`);
      }
  });

  console.log('\n--- PARALLEL NODES & BRANCHES ---');
  const parallels = nodes.filter((n: any) => n.type === 'parallel');
  parallels.forEach((p: any) => {
      console.log(`PARALLEL [${p.id}]`);
      const outbound = edges.filter((e: any) => e.source === p.id);
      outbound.forEach((e: any) => {
          const target = nodes.find((n: any) => n.id === e.target);
          console.log(`  -> Branch Edge to [${e.target}] (${target?.type}, label="${target?.data?.label}")`);
          
          // Check if target has flags
          if (target && (target.data?.isMergeNode || target.data?.isMergePlaceholder)) {
              console.warn(`     WARNING: Target of parallel branch IS A MERGE NODE!`);
          }
      });
  });

  process.exit(0);
}

inspect();
