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

  // 1. Identify Trigger Node (usually id: "1" or containing a trigger name)
  const triggerNode = nodes.find(n => n.id === "1" || n.data?.trigger || (n.data?.actionId && n.id !== 'end' && !edges.find(e => e.target === n.id)));
  
  if (!triggerNode || triggerNode.type === 'end') {
    console.warn('Mapper: No trigger node identified.');
    return { trigger: null, steps: [] };
  }

  const trigger = {
    piece: mapPieceName(triggerNode.data?.icon || triggerNode.data?.appName),
    name: triggerNode.data?.actionId || 'trigger',
    params: triggerNode.data?.params || {}
  };

  // 2. Traversal: Follow edges from the trigger
  const steps: any[] = [];
  let currentNodeId = triggerNode.id;
  const visited = new Set([currentNodeId]);

  // BFS/DFS to follow the linear path (or branching in future)
  // For now, we assume a single linear path to match current engine
  while (true) {
    const nextEdge = edges.find(e => e.source === currentNodeId && !visited.has(e.target));
    if (!nextEdge) break;

    const nextNode = nodes.find(n => n.id === nextEdge.target);
    if (!nextNode || nextNode.type === 'end') break;

    steps.push({
      name: `${nextNode.data?.appName || 'Step'}_${nextNode.data?.actionId || 'Action'}`,
      piece: mapPieceName(nextNode.data?.icon || nextNode.data?.appName),
      action: nextNode.data?.actionId,
      params: nextNode.data?.params || {}
    });

    currentNodeId = nextNode.id;
    visited.add(currentNodeId);
    
    // Safety break to prevent infinite loops
    if (visited.size > nodes.length) break;
  }

  return { trigger, steps };
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
  
  return name.replace('google_', '');
}
