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
  refresh_token: string;
  access_token?: string;
  expiry_date?: number;
  scopes?: string;
}

export interface Piece {
  name: string;
  actions: Record<string, ActionFunction>;
  triggers?: Record<string, TriggerFunction>;
}

export type ActionFunction = (args: { auth: any; params: any }) => Promise<any>;
export type TriggerFunction = (args: { auth: any; lastProcessedId?: any; params?: any }) => Promise<any>;

export interface FlowStep {
  name: string;
  displayName?: string; // Human readable name (e.g. "Gmail Send Email")
  piece: string;
  action: string;
  params: any;
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
