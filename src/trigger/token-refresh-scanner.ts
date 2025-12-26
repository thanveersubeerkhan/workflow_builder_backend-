import { schedules } from "@trigger.dev/sdk/v3";
import axios from "axios";

export const tokenRefreshScanner = schedules.task({
  id: "token-refresh-scanner",
  cron: "*/25 * * * *", // Every 25 minutes
  run: async (payload) => {
    console.log(`[Refresh Scheduler] ⏰ Timer fired. Pinging Render Hub...`);
    
    const RENDER_URL = process.env.RENDER_URL || "http://localhost:3000";
    
    try {
      const response = await axios.post(`${RENDER_URL}/api/internal/refresh-tokens-scan`);
      console.log(`[Refresh Scheduler] ✅ Render Hub response:`, response.data);
    } catch (error: any) {
      console.error(`[Refresh Scheduler] ❌ Failed to ping Render Hub:`, error.message);
    }
  },
});
