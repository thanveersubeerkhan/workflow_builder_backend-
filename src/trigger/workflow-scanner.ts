// import { schedules } from "@trigger.dev/sdk/v3";
// import { performTriggerScan } from "../trigger-worker.js";
// import { workflowExecutor } from "./workflow-executor.js";

// export const workflowScanner = schedules.task({
//   id: "workflow-scanner",
//   cron: "* * * * *", // Run every minute
//   run: async (payload) => {
//     console.log(`[Trigger.dev] Starting Workflow Scanner... Scheduled Time: ${payload.timestamp.toISOString()}`);
    
//     const result = await performTriggerScan({}, async (data) => {
//       console.log(`[Trigger.dev] Enqueuing Executor for flow: ${data.flowId}`);
//       await workflowExecutor.trigger(data);
//     });

//     return {
//       fireCount: result.fireCount,
//     };
//   },
// });
import { schedules ,wait} from "@trigger.dev/sdk/v3";
import { performTriggerScan } from "../trigger-worker.js";
import { workflowExecutor } from "./workflow-executor.js";



export const workflowScanner = schedules.task({
  id: "workflow-scanner",
  cron: "* * * * *", // Run every minute
  run: async (payload) => {
    // Run 12 times (every 5 seconds for 1 minute)
    for (let i = 0; i < 12; i++) {
      const result = await performTriggerScan({}, async (data) => {
        await workflowExecutor.trigger(data);
      });
      
      if (i < 11) {
        await wait.for({ seconds: 5 });
      }
    }
  },
});