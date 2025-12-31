export interface User {
  id: string;
  email: string;
  name?: string;
  picture_url?: string;
  created_at?: Date;
}

export interface GoogleIntegration {
  id?: string;
  user_id: string;
  service: string;
  external_id?: string;
  external_username?: string;
  external_avatar?: string;
  refresh_token: string;
  access_token?: string;
  expiry_date?: number;
  scopes?: string;
}

export interface PropertyMetadata {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description?: string;
  properties?: PropertyMetadata[]; // For objects
  items?: PropertyMetadata; // For arrays
}

export interface ActionParameterMetadata {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'connection' | 'select' | 'json' | 'dynamic-select';
  label: string;
  description?: string;
  required?: boolean;
  default?: any;
  options?: { label: string; value: string }[];
  dynamicOptions?: {
    action: string; // The action to call to fetch options (e.g., 'listFolders')
    dependsOn?: string[]; // Parameters that must be set first (e.g., ['connection'])
  };
}

export interface Piece {
  name: string;
  actions: Record<string, ActionFunction>;
  triggers?: Record<string, TriggerFunction>;
  metadata?: {
    actions?: Record<string, { 
      label?: string;
      description?: string;
      parameters?: ActionParameterMetadata[];
      outputSchema?: PropertyMetadata[] 
    }>;
    triggers?: Record<string, { 
      label?: string;
      description?: string;
      parameters?: ActionParameterMetadata[];
      outputSchema?: PropertyMetadata[] 
    }>;
  };
}

export type ActionFunction = (args: { auth: any; params: any }) => Promise<any>;
export type TriggerFunction = (args: { auth: any; lastProcessedId?: any; params?: any; epoch?: number }) => Promise<any>;

export type StepType = 'action' | 'parallel' | 'condition' | 'loop' | 'wait';

export interface FlowStep {
  name: string;
  type?: StepType; // defaults to 'action'
  displayName?: string;
  piece?: string; // required for 'action'
  action?: string; // required for 'action'
  params?: any;
  branches?: FlowStep[][]; // for 'parallel'
  condition?: string; // for 'condition'
  onTrue?: FlowStep[]; // for 'condition'
  onFalse?: FlowStep[]; // for 'condition'
}

export interface FlowTrigger {
  name: string;
  displayName?: string;
  nodeId?: string; // Critical for matching UI
  piece: string;
  params: any;
}

export interface FlowDefinition {
  trigger?: FlowTrigger;
  steps: FlowStep[];
}

export interface Flow {
  id: string;
  user_id: string;
  name: string;
  definition: FlowDefinition;
}

export interface FlowRun {
  id: string;
  flow_id: string;
  status: 'pending' | 'running' | 'success' | 'failed';
  logs: string[];
  result?: any;
  created_at: Date;
}
