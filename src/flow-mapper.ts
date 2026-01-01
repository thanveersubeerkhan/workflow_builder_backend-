/**
 * Flow Mapper Utility
 * 
 * Maps React Flow UI definitions (nodes and edges) to
 * Backend Flow Definitions (trigger and steps).
 */

export interface UINode {
  id: string;
  type: string;
  data: any;
}

export interface UIEdge {
  id: string;
  source: string;
  target: string;
  data?: any;
}

export interface UIDefinition {
  nodes: UINode[];
  edges: UIEdge[];
}

export function mapUIToDefinition(ui: UIDefinition) {
  const { nodes, edges } = ui;
  
  if (!nodes || nodes.length === 0) {
    return { trigger: null, steps: [] };
  }

  // 1. Identify Trigger Node
  const triggerNode = nodes.find(n => n.id === "1" || n.data?.trigger || (n.data?.actionId && n.id !== 'end' && !edges.find(e => e.target === n.id)));
  
  if (!triggerNode || triggerNode.type === 'end') {
    return { trigger: null, steps: [] };
  }

  const pieceName = mapPieceName(triggerNode.data?.icon || triggerNode.data?.appName);
  const trigger = {
    piece: pieceName,
    name: mapTriggerName(pieceName, triggerNode.data?.actionId || 'trigger'),
    displayName: `${triggerNode.data?.appName || 'Trigger'} ${triggerNode.data?.actionId || 'Event'}`,
    nodeId: triggerNode.id,
    params: triggerNode.data?.params || {}
  };

  // 2. Recursive Traversal
  const visited = new Set<string>();
  
  function getOutbound(fromId: string) {
    return edges
      .filter(e => e.source === fromId)
      .map(e => ({ node: nodes.find(n => n.id === e.target)!, edge: e }))
      .filter(x => x.node && x.node.type !== 'end');
  }

  function isReachable(fromId: string, toId: string): boolean {
      if (fromId === toId) return true;
      const stack = [fromId];
      const seen = new Set<string>();
      while (stack.length > 0) {
          const curr = stack.pop()!;
          if (curr === toId) return true;
          if (seen.has(curr)) continue;
          seen.add(curr);
          const children = getOutbound(curr).map(x => x.node.id);
          stack.push(...children);
      }
      return false;
  }

  function findJoinNode(startNodeIds: string[]): string | undefined {
      if (startNodeIds.length < 2) return undefined;
      
      const getAllReachable = (startId: string) => {
          const s = new Set<string>();
          const q = [startId];
          while (q.length > 0) {
              const curr = q.shift()!;
              if (s.has(curr)) continue;
              s.add(curr);
              const children = getOutbound(curr).map(x => x.node.id);
              q.push(...children);
          }
          return s;
      };

      const sets = startNodeIds.map(getAllReachable);
      const [firstSet, ...restSets] = sets;
      const common = Array.from(firstSet).filter(id => restSets.every(s => s.has(id)));

      if (common.length === 0) return undefined;

      // Return the node that is not reachable from any other common node (the "root" of the common subgraph)
      // Optimisation: Just check against other common nodes
      const roots = common.filter(c => !common.some(other => other !== c && isReachable(other, c)));
      return roots[0];
  }

  function traverse(startNodeId: string, stopNodeId?: string): any[] {
    const steps: any[] = [];
    let currentId = startNodeId;

    while (true) {
        if (currentId === stopNodeId) break;

        const outbound = getOutbound(currentId);
        if (outbound.length === 0) break;

        // Peak at the next node
        const { node, edge } = outbound[0];
        if (visited.has(node.id)) break;
        if (node.id === stopNodeId) break;
        
        // Is the NEXT node a branching node?
        const isCondition = node.data?.icon === 'condition' || node.type === 'condition' || node.data?.type === 'condition' || getOutbound(node.id).some(o => o.edge.data?.label === 'true' || o.edge.data?.label === 'false' || o.edge.sourceHandle === 'true' || o.edge.sourceHandle === 'false');
        const nextOutbound = getOutbound(node.id);
        const isParallel = !isCondition && nextOutbound.length > 1;
        const isLoop = node.data?.type === 'loop' || node.data?.actionId === 'loop';
        const isWait = node.data?.type === 'wait' || node.data?.icon === 'pause' || node.data?.actionId === 'wait';

        visited.add(node.id);

        if (isCondition) {
            const conditionOutbound = getOutbound(node.id);
            const trueNode = conditionOutbound.find(o => o.edge.data?.label === 'true' || o.edge.sourceHandle === 'true')?.node;
            const falseNode = conditionOutbound.find(o => o.edge.data?.label === 'false' || o.edge.sourceHandle === 'false')?.node;
            
            let joinNodeId: string | undefined = undefined;
            if (trueNode && falseNode) {
                joinNodeId = findJoinNode([trueNode.id, falseNode.id]);
            }

            steps.push({
                name: node.id,
                type: 'condition',
                condition: node.data?.params?.condition || 'false',
                onTrue: trueNode ? traverseBranch(trueNode.id, joinNodeId) : [],
                onFalse: falseNode ? traverseBranch(falseNode.id, joinNodeId) : []
            });
            
            if (joinNodeId) {
                // Continue traversal from join node
                // We need to mark joinNode as NOT visited so it can be processed? 
                // Wait, traverse loop checks visited. We need to ensure logic flow continues.
                // We set currentId to joinNode's parent? No.
                // We want to process joinNode NEXT.
                // But the loop works by looking at OUTBOUND of currentId.
                // JoinNode is NOT outbound of ConditionNode directly (it's deeper).
                // So we can't simple set currentId = joinNode.
                
                // We need to RESTART the loop or JUMP to joinNode.
                // But `getOutbound(currentId)` expects `currentId` to be the "previous" node.
                // If we set `currentId = joinNodeId`? No, loop expects `currentId` to be the source of edge to next node.
                
                // We want to process `joinNode` as if it was the next node.
                // But `joinNode` might have multiple parents.
                // The structure of `steps` is flat.
                // We can just call `traverse(joinNodeId)` and append?
                // But we are INSIDE `traverse`.
                
                // We can't easily jump.
                // Hack: Recursively call traverse and append, then break.
                // steps.push(...traverse(joinNodeId));
                // break;
                
                // However, `traverse` marks `visited`.
                // `joinNode` is supposedly NOT visited yet (because stopped at `joinNodeId`).
                // But we need to handle the fact that we are "jumping" in the graph.
                
                // Wait, if we use `traverse(joinNodeId)`, `traverse` starts by looking for OUTBOUND of `joinNodeId`.
                // It SKIPS `joinNodeId` itself!
                // `traverse` logic: `outbound = getOutbound(currentId)`. `node = outbound[0]`.
                // It processes the CHILD of `currentId`.
                
                // So if we pass `joinNodeId`, it processes children of `joinNodeId`. 
                // It MISSES `joinNodeId` itself as a step.
                
                // We need to process `joinNodeId` itself.
                // Logic for processing a node is in `traverseBranch` mainly (creating the step object).
                // Or here in the loop (creating the step object).
                
                // We can treat `joinNodeId` as the next `currentId` but we need to process it first.
                // But the Loop logic is: 
                // 1. Get children of currentId.
                // 2. Process child (create step).
                // 3. Set currentId = child.
                
                // If we have a Join Node, we want to set `currentId` such that `joinNode` is the child?
                // No, `joinNode` comes from multiple parents.
                
                // We should explicitly Process `joinNode` here, add it to steps, and then set `currentId = joinNodeId`.
                // But `joinNode` processing logic (identifying type, etc) is inside the loop.
                
                // Refactor idea:
                // Extract `processNode(node)` logic.
                
                // Better:
                // Just use `visited` logic.
                // If `joinNode` exists. 
                // We remove it from `visited`? No.
                
                // We can simply call `traverseBranch(joinNodeId)`?
                // `traverseBranch` adds the node step, and then calls `traverse`.
                
                steps.push(...traverseBranch(joinNodeId));
                break;
            } else {
                break;
            }

        } else if (isParallel) {
             // Parallel logic also needs join detection potentially? 
             // For now assume parallel joins or ends.
             // If we want to be consistent, we should use same logic.
             // But let's stick to Condition for now.
             
            steps.push({
                name: node.id,
                type: 'parallel',
                branches: nextOutbound.map(o => traverseBranch(o.node.id)) // Todo: Add stopNode logic here too if needed
            });
            break;
        } else if (isLoop) {
            const loopOutbound = getOutbound(node.id);
            steps.push({
                name: node.id,
                type: 'loop',
                displayName: `${node.data?.appName || 'Loop'}`,
                params: node.data?.params || {},
                branches: loopOutbound.length > 0 ? [traverseBranch(loopOutbound[0].node.id)] : []
            });
            break;
        } else if (isWait) {
             steps.push({
                name: node.id,
                type: 'wait',
                displayName: 'Wait for Human',
                piece: 'wait',
                action: 'wait',
                params: node.data?.params || {}
            });
            currentId = node.id;
        } else {
            // Linear Action
            const stepPiece = mapPieceName(node.data?.icon || node.data?.appName);
            steps.push({
                name: node.id,
                type: 'action',
                displayName: `${node.data?.appName || 'Step'} ${node.data?.actionId || 'Action'}`,
                piece: stepPiece,
                action: mapActionName(stepPiece, node.data?.actionId || 'action'),
                params: node.data?.params || {}
            });
            currentId = node.id;
        }
    }

    return steps;
  }

  function traverseBranch(nodeId: string, stopNodeId?: string): any[] {
     if (nodeId === stopNodeId) return [];
     if (visited.has(nodeId)) return [];
     visited.add(nodeId);

     const node = nodes.find(n => n.id === nodeId);
     if (!node) return [];

     const stepPiece = mapPieceName(node.data?.icon || node.data?.appName);
     const step: any = {
         name: node.id,
         displayName: `${node.data?.appName || 'Step'} ${node.data?.actionId || 'Action'}`,
         piece: stepPiece,
         action: mapActionName(stepPiece, node.data?.actionId || 'action'),
         params: node.data?.params || {}
     };

     return [step, ...traverse(nodeId, stopNodeId)];
  }

  return { trigger, steps: traverse(triggerNode.id) };
}

/**
 * Maps UI triggers to backend names
 */
function mapTriggerName(piece: string, uiActionId: string): string {
  if (piece === 'schedule' && uiActionId === 'every_x_minutes') return 'schedule';
  if (piece === 'gmail' && (uiActionId === 'new_email' || uiActionId === 'newEmail')) return 'newEmail';
  if (piece === 'sheets' && (uiActionId === 'new_row' || uiActionId === 'newRow')) return 'newRow';
  return uiActionId;
}

/**
 * Maps UI actions to backend names
 */
function mapActionName(piece: string, uiActionId: string): string {
  if (piece === 'gmail' && (uiActionId === 'send_email' || uiActionId === 'sendEmail')) return 'sendEmail';
  if (piece === 'sheets') {
    if (uiActionId === 'insert_row' || uiActionId === 'append_row' || uiActionId === 'appendRow') return 'appendRowSmart';
  }
  
  // Standard camelCase conversion for others
  return uiActionId.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
}

/**
 * Maps UI app names/icons to backend internal piece names
 */
function mapPieceName(uiName: string | undefined): string {
  if (!uiName) return 'unknown';
  const name = uiName.toLowerCase().replace(/\s+/g, '_');
  
  if (name.includes('gmail')) return 'gmail';
  if (name.includes('sheet')) return 'sheets';
  if (name.includes('doc')) return 'docs';
  if (name.includes('drive')) return 'drive';
  if (name.includes('schedule')) return 'schedule';
  if (name.includes('logic')) return 'logic';
  if (name.includes('wait') || name.includes('pause')) return 'wait';
  
  return name.replace('google_', '');
}
