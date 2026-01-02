
import { pool } from './db.js';

const FLOW_ID = '2edd47e5-6853-4523-b5c7-c6ffe73cbcd4';

// Mock VisualStep type
interface VisualStep {
    id: string;
    type: 'step' | 'block';
    node?: any;
    branches?: { label: string, steps: VisualStep[] }[];
}

async function runSimulation() {
  const res = await pool.query('SELECT ui_definition FROM flows WHERE id = $1', [FLOW_ID]);
  const flow = res.rows[0];
  if (!flow) return console.log('Flow not found');

  const nodes = flow.ui_definition.nodes;
  const edges = flow.ui_definition.edges;
  
  console.log(`Loaded ${nodes.length} nodes and ${edges.length} edges.`);

  // --- COPIED LOGIC FROM RunSidebar.tsx ---
  const getOutbound = (nodeId: string) => edges.filter((e: any) => e.source === nodeId);
  
  const visited = new Set<string>();

  function buildChain(currId: string, stopId?: string): VisualStep[] {
      const chain: VisualStep[] = [];
      let current: string | undefined = currId;

      console.log(`[Sim] Building chain from ${currId} to ${stopId}`);

      while (current && current !== stopId) {
          if (visited.has(current)) {
              console.log(`[Sim] Already visited ${current}`);
              break;
          }

          const node = nodes.find((n: any) => n.id === current);
          if (!node) {
               console.log(`[Sim] Node ${current} not found`);
               break;
          }

          // Handle Placeholder skipping for cleaner tree
          if (node.data.isPlaceholder && !node.data.isMergeNode && !node.data.isMergePlaceholder) {
               visited.add(current);
               const out = getOutbound(current);
               console.log(`[Sim] Skipping placeholder ${current}, outbound: ${out.length}`);
               current = out.length > 0 ? out[0].target : undefined;
               continue;
          }

          visited.add(current);
          const outbound = getOutbound(current);
          const isCondition = node.type === 'condition';
          const isParallel = node.type === 'parallel';

          if (isCondition || isParallel) {
               console.log(`[Sim] Found Block ${node.type} (${current})`);
               const branches: { label: string, steps: VisualStep[] }[] = [];
               
               const findNearestMerge = (startIds: string[]): string | undefined => {
                   const q = [...startIds];
                   const seen = new Set<string>();
                   while(q.length > 0) {
                       const curr = q.shift()!;
                       if (seen.has(curr)) continue;
                       seen.add(curr);
                       const n = nodes.find((no: any) => no.id === curr);
                       if (n?.data?.isMergeNode || n?.data?.isMergePlaceholder) return curr;
                       getOutbound(curr).forEach((e: any) => q.push(e.target));
                   }
               };
               
               const branchTips = outbound.map((e: any) => e.target);
               const mergeId = findNearestMerge(branchTips);
               console.log(`[Sim] Merge ID for ${current}: ${mergeId}`);

               if (mergeId) {
                   if (isCondition) {
                       const trueEdge = outbound.find((e: any) => e.sourceHandle === 'true' || e.data?.label === 'true');
                       const falseEdge = outbound.find((e: any) => e.sourceHandle === 'false' || e.data?.label === 'false');
                       if (trueEdge) branches.push({ label: 'True', steps: buildChain(trueEdge.target, mergeId) });
                       if (falseEdge) branches.push({ label: 'False', steps: buildChain(falseEdge.target, mergeId) });
                   } else {
                       outbound.forEach((edge: any, idx: number) => {
                           const label = edge.data?.label as string || `Branch ${idx + 1}`;
                           console.log(`[Sim] Building Branch ${idx}: ${edge.target} -> ${mergeId}`);
                           branches.push({ label, steps: buildChain(edge.target, mergeId) });
                       });
                   }
                   current = mergeId;
                   continue;
               }
               current = undefined;
          } else {
              chain.push({ id: node.id, type: 'step', node });
              current = outbound.length > 0 ? outbound[0].target : undefined;
          }
      }
      return chain;
  }
  // --- END COPIED LOGIC ---

  // Find start node
  const startNode = nodes.find((n: any) => n.id === '1') || nodes.find((n: any) => edges.every((e: any) => e.target !== n.id));
  console.log(`Start Node: ${startNode?.id}`);
  
  if (startNode) {
      const tree = buildChain(startNode.id);
      console.log('Tree built. Length:', tree.length);
      
      const printTree = (steps: VisualStep[], indent: string = '') => {
          steps.forEach(s => {
              if (s.branches) {
                  console.log(`${indent}BLOCK [${s.id}] branches=${s.branches.length}`);
                  s.branches.forEach(b => {
                      console.log(`${indent}  BRANCH ${b.label} (Steps: ${b.steps.length})`);
                      printTree(b.steps, indent + '    ');
                  });
              } else {
                  console.log(`${indent}STEP [${s.id}]`);
              }
          });
      };
      
      printTree(tree);
  }

  process.exit(0);
}

runSimulation();
