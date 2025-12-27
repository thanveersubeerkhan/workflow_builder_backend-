import { task } from "@trigger.dev/sdk/v3";
import axios from "axios";

export const tokenRefreshExecutor = task({
  id: "token-refresh-executor",
  queue: {
    concurrencyLimit: 20,
  },
  run: async (payload: { userId: string, service: string }) => {
    const startTime = new Date();
    console.log(`[Refresh Queue] 🚀 Refresh started for User: ${payload.userId} (Service: ${payload.service})`);
    
    const RENDER_URL = process.env.RENDER_URL || "http://localhost:3000";
    
    try {
      const response = await axios.post(`${RENDER_URL}/api/internal/perform-token-refresh`, payload);
      console.log(`[Refresh Queue] ✅ Render response:`, JSON.stringify(response.data, null, 2));
      
      const duration = new Date().getTime() - startTime.getTime();
      console.log(`[Refresh Queue] 🏁 Refresh cycle complete. Duration: ${duration}ms`);
      return response.data;
    } catch (error: any) {
      console.error(`[Refresh Queue] ❌ Failed to call Render refresh:`, error.message);
      if (error.response) {
         console.error(`[Refresh Queue] Error details:`, JSON.stringify(error.response.data, null, 2));
      }
      throw error; // Trigger.dev will retry
    } finally {
      console.log(`\n______________________________________________________________________\n`);
    }
  },
});
