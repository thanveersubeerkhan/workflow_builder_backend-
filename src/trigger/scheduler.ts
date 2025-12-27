import { schedules } from "@trigger.dev/sdk/v3";
import axios from "axios";

export const workflowScanner = schedules.task({
  id: "workflow-scanner",
  cron: "*/1 * * * *", // 1 minute interval for Scalable Look-ahead architecture
  run: async (payload) => {
    console.log(`[Scheduler] ⏰ Timer fired. Pinging Render Hub...`);
    
    const RENDER_URL = process.env.RENDER_URL || "http://localhost:3000";
    
    try {
      const response = await axios.post(`${RENDER_URL}/api/internal/scan-trigger`);
      console.log(`[Scheduler] ✅ Render Hub response:`, response.data);
    } catch (error: any) {
      console.error(`[Scheduler] ❌ Failed to ping Render Hub:`, error.message);
    }
  },
});
