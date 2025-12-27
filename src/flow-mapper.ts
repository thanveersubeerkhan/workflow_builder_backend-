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

  function traverse(startNodeId: string): any[] {
    const steps: any[] = [];
    let currentId = startNodeId;

    while (true) {
        const outbound = getOutbound(currentId);
        if (outbound.length === 0) break;

        // Peak at the next node
        const { node, edge } = outbound[0];
        if (visited.has(node.id)) break;
        
        // Is the NEXT node a branching node?
        const isCondition = node.data?.icon === 'condition' || node.data?.type === 'condition' || getOutbound(node.id).some(o => o.edge.data?.label === 'true' || o.edge.data?.label === 'false');
        const nextOutbound = getOutbound(node.id);
        const isParallel = !isCondition && nextOutbound.length > 1;
        const isLoop = node.data?.type === 'loop' || node.data?.actionId === 'loop';
        const isWait = node.data?.type === 'wait' || node.data?.icon === 'pause' || node.data?.actionId === 'wait';

        visited.add(node.id);

        if (isCondition) {
            const conditionOutbound = getOutbound(node.id);
            const trueNode = conditionOutbound.find(o => o.edge.data?.label === 'true')?.node;
            const falseNode = conditionOutbound.find(o => o.edge.data?.label === 'false')?.node;
            
            steps.push({
                name: node.id,
                type: 'condition',
                condition: node.data?.params?.condition || 'false',
                onTrue: trueNode ? traverseBranch(trueNode.id) : [],
                onFalse: falseNode ? traverseBranch(falseNode.id) : []
            });
            break; 
        } else if (isParallel) {
            steps.push({
                name: node.id,
                type: 'parallel',
                branches: nextOutbound.map(o => traverseBranch(o.node.id))
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
            currentId = node.id; // Continue linear path after wait if any
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

  function traverseBranch(nodeId: string): any[] {
     // A branch traversal starts with the node itself if hasn't been visited as a primary path
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

     // Simple linear traversal for the rest of the branch
     return [step, ...traverse(nodeId)];
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
