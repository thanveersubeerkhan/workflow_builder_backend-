import { schedules, wait } from "@trigger.dev/sdk/v3";
import { performTriggerScan } from "../trigger-worker.js";
import { workflowExecutor } from "./workflow-executor.js";

export const workflowScanner = schedules.task({
  id: "workflow-scanner",
  cron: "* * * * *", // Run every minute
  run: async (payload) => {
    console.log(`[Trigger.dev] Starting 5s polling loop for 1 minute...`);
    let totalFireCount = 0;

    // Run 12 times (12 * 5s = 60 seconds)
    for (let i = 0; i < 12; i++) {
      const result = await performTriggerScan({}, async (data) => {
        console.log(`[Trigger.dev] Enqueuing Executor for flow: ${data.flowId}`);
        await workflowExecutor.trigger(data);
      });

      totalFireCount += result.fireCount;

      // Wait 5 seconds before next scan, except on the last iteration
      if (i < 11) {
        await wait.for({ seconds: 5 });
      }
    }

    console.log(`[Trigger.dev] Loop finished. Total flows triggered in this minute: ${totalFireCount}`);
    
    return {
      totalFireCount,
    };
  },
});