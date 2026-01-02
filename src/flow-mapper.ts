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

  function traverseChain(startNodeId: string, stopNodeId?: string): any[] {
    const steps: any[] = [];
    let currentId: string | undefined = startNodeId;

    while (currentId && currentId !== stopNodeId) {
        if (visited.has(currentId)) break;
        
        const node = nodes.find(n => n.id === currentId);
        if (!node || node.type === 'end') break;

        visited.add(currentId);

        // --- MAP NODE ---
        const outbound = getOutbound(currentId);
        
        // 1. Condition Node
        const isCondition = node.data?.icon === 'condition' || node.type === 'condition' || node.data?.type === 'condition' || 
                            outbound.some(o => o.edge.data?.label === 'true' || o.edge.data?.label === 'false' || (o.edge as any).sourceHandle === 'true' || (o.edge as any).sourceHandle === 'false');

        if (isCondition) {
            const trueNode = outbound.find(o => o.edge.data?.label === 'true' || (o.edge as any).sourceHandle === 'true')?.node;
            const falseNode = outbound.find(o => o.edge.data?.label === 'false' || (o.edge as any).sourceHandle === 'false')?.node;
            
            let joinNodeId: string | undefined = undefined;
            if (trueNode && falseNode) {
                joinNodeId = findJoinNode([trueNode.id, falseNode.id]);
            }

            steps.push({
                name: node.id,
                type: 'condition',
                condition: node.data?.params?.condition || 'false',
                onTrue: trueNode ? traverseChain(trueNode.id, joinNodeId) : [],
                onFalse: falseNode ? traverseChain(falseNode.id, joinNodeId) : []
            });

            // Continue from Join Node if it exists
            if (joinNodeId) {
                currentId = joinNodeId;
                continue;
            } else {
                break; // End of this chain
            }
        }

        // 2. Parallel Node
        const isParallel = !isCondition && outbound.length > 1;
        if (isParallel) {
            const branchStartNodes = outbound.map(o => o.node);
            const joinNodeId = findJoinNode(branchStartNodes.map(n => n.id));

            steps.push({
                name: node.id,
                type: 'parallel',
                branches: branchStartNodes.map(n => traverseChain(n.id, joinNodeId))
            });

            if (joinNodeId) {
                currentId = joinNodeId;
                continue;
            } else {
                break; 
            }
        }

        // 3. Loop Node
        const isLoop = node.data?.type === 'loop' || node.data?.actionId === 'loop';
        if (isLoop) {
             const loopOutbound = getOutbound(node.id);
             steps.push({
                 name: node.id,
                 type: 'loop',
                 displayName: `${node.data?.appName || 'Loop'}`,
                 params: node.data?.params || {},
                 branches: loopOutbound.length > 0 ? [traverseChain(loopOutbound[0].node.id)] : []
             });
             break; // Loop usually ends or has specific exit logic not fully standard yet
        }

        // 4. Wait Node
        const isWait = node.data?.type === 'wait' || node.data?.icon === 'pause' || node.data?.actionId === 'wait';
        if (isWait) {
            steps.push({
                name: node.id,
                type: 'wait',
                displayName: 'Wait for Human',
                piece: 'wait',
                action: 'wait',
                params: node.data?.params || {}
            });
            // Continue to next linear node
            currentId = outbound.length > 0 ? outbound[0].node.id : undefined;
            continue;
        }

        // 5. Linear Action
        const stepPiece = mapPieceName(node.data?.icon || node.data?.appName);
        steps.push({
            name: node.id,
            type: 'action',
            displayName: `${node.data?.appName || 'Step'} ${node.data?.actionId || 'Action'}`,
            piece: stepPiece,
            action: mapActionName(stepPiece, node.data?.actionId || 'action'),
            params: node.data?.params || {}
        });

        currentId = outbound.length > 0 ? outbound[0].node.id : undefined;
    }

    return steps;
  }

  // Start traversal from the node AFTER the trigger
  const firstOutbound = getOutbound(triggerNode.id);
  const steps = firstOutbound.length > 0 ? traverseChain(firstOutbound[0].node.id) : [];

  return { trigger, steps };
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
