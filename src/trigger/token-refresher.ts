import { schedules } from "@trigger.dev/sdk/v3";
import { performTokenRefresh } from "../refresh-worker.js";

export const tokenRefresher = schedules.task({
  id: "token-refresher",
  cron: "*/20 * * * *", // Run every 20 minutes
  run: async (payload) => {
    console.log(`[Trigger.dev] Starting Token Refresh Task... Scheduled Time: ${payload.timestamp.toISOString()}`);
    
    const result = await performTokenRefresh();

    return {
      refreshedCount: result.totalRefreshed,
      skipped: result.skipped || false
    };
  },
});
