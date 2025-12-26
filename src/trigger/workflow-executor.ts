import { task } from "@trigger.dev/sdk/v3";
import { executeFlow } from "../worker.js";
import { FlowDefinition } from "../types.js";
import axios from 'axios';

const SOCKET_SERVER_URL = process.env.SOCKET_URL || `http://localhost:${process.env.PORT || 3000}`;

interface WorkflowPayload {
  flowId: string;
  userId: string;
  definition: FlowDefinition;
  triggerData?: any;
}

export const workflowExecutor = task({
  id: "workflow-executor",
  run: async (payload: WorkflowPayload) => {
    console.log(`[Trigger.dev] Starting Workflow Executor for flow: ${payload.flowId}`);
    
    const result = await executeFlow({
      flowId: payload.flowId,
      userId: payload.userId,
      definition: payload.definition,
      triggerData: payload.triggerData,
      onEvent: (event, data) => {
          // HTTP relay to the socket server
          axios.post(`${SOCKET_SERVER_URL}/api/worker-relay`, {
              room: `flow:${payload.flowId}`,
              event,
              data
          }).catch(err => {
              console.error(`[Executor] Failed to relay event ${event} via HTTP:`, err.message);
          });
      }
    });

    if (!result.success) {
      throw new Error(`Workflow execution failed: ${result.error}`);
    }

    return result;
  },
});
