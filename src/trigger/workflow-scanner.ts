import { schedules } from "@trigger.dev/sdk/v3";
import { performTriggerScan } from "../trigger-worker.js";
import { workflowExecutor } from "./workflow-executor.js";

export const workflowScanner = schedules.task({
  id: "workflow-scanner",
  cron: "* * * * *", // Run every minute
  run: async (payload) => {
    console.log(`[Trigger.dev] Starting Workflow Scanner... Scheduled Time: ${payload.timestamp.toISOString()}`);
    
    const result = await performTriggerScan({}, async (data) => {
      console.log(`[Trigger.dev] Enqueuing Executor for flow: ${data.flowId}`);
      await workflowExecutor.trigger(data);
    });

    return {
      fireCount: result.fireCount,
    };
  },
});
