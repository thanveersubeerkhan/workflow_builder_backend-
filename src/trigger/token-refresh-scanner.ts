import { schedules } from "@trigger.dev/sdk/v3";
import axios from "axios";

export const tokenRefreshScanner = schedules.task({
  id: "token-refresh-scanner",
  cron: "*/25 * * * *", // Every 25 minutes
  run: async (payload) => {
    const startTime = new Date();
    console.log(`[Refresh Scheduler] ⏰ Timer fired at ${startTime.toISOString()}`);
    console.log(`[Refresh Scheduler] 🛰️ Pinging Render Hub for Token Refresh Scan...`);
    
    const RENDER_URL = process.env.RENDER_URL || "http://localhost:3000";
    
    try {
      const response = await axios.post(`${RENDER_URL}/api/internal/refresh-tokens-scan`);
      console.log(`[Refresh Scheduler] ✅ Render Hub response:`, JSON.stringify(response.data, null, 2));
      
      const duration = new Date().getTime() - startTime.getTime();
      console.log(`[Refresh Scheduler] 🏁 Refresh scan cycle complete. Duration: ${duration}ms`);
    } catch (error: any) {
      console.error(`[Refresh Scheduler] ❌ Failed to ping Render Hub:`, error.message);
      if (error.response) {
        console.error(`[Refresh Scheduler] Error details:`, JSON.stringify(error.response.data, null, 2));
      }
    } finally {
      console.log(`\n______________________________________________________________________\n`);
    }
  },
});
