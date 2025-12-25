import { task } from "@trigger.dev/sdk/v3";
import { executeFlow } from "../worker.js";
import { FlowDefinition } from "../types.js";

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
    });

    if (!result.success) {
      throw new Error(`Workflow execution failed: ${result.error}`);
    }

    return result;
  },
});
