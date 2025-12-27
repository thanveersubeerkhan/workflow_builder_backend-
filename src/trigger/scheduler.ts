import { schedules } from "@trigger.dev/sdk/v3";
import axios from "axios";

export const workflowScanner = schedules.task({
  id: "workflow-scanner",
  cron: "*/1 * * * *", // 1 minute interval for Scalable Look-ahead architecture
  run: async (payload) => {
    const startTime = new Date();
    console.log(`[Scheduler] ⏰ Timer fired at ${startTime.toISOString()}`);
    console.log(`[Scheduler] 🛰️ Pinging Render Hub for Trigger Scan...`);
    
    const RENDER_URL = process.env.RENDER_URL || "http://localhost:3000";
    
    try {
      const response = await axios.post(`${RENDER_URL}/api/internal/scan-trigger`);
      console.log(`[Scheduler] ✅ Render Hub response:`, JSON.stringify(response.data, null, 2));
      
      const duration = new Date().getTime() - startTime.getTime();
      console.log(`[Scheduler] 🏁 Scan cycle complete. Duration: ${duration}ms`);
    } catch (error: any) {
      console.error(`[Scheduler] ❌ Failed to ping Render Hub:`, error.message);
      if (error.response) {
        console.error(`[Scheduler] Error details:`, JSON.stringify(error.response.data, null, 2));
      }
    } finally {
      console.log(`\n______________________________________________________________________\n`);
    }
  },
});
