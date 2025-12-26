import { task } from "@trigger.dev/sdk/v3";
import axios from "axios";

export const tokenRefreshExecutor = task({
  id: "token-refresh-executor",
  queue: {
    concurrencyLimit: 20,
  },
  run: async (payload: { userId: string, service: string }) => {
    console.log(`[Refresh Queue] 🚀 Loopback refresh for: ${payload.userId} - ${payload.service}`);
    
    const RENDER_URL = process.env.RENDER_URL || "http://localhost:3000";
    
    try {
      const response = await axios.post(`${RENDER_URL}/api/internal/perform-token-refresh`, payload);
      console.log(`[Refresh Queue] ✅ Render response:`, response.data);
      return response.data;
    } catch (error: any) {
      console.error(`[Refresh Queue] ❌ Failed to call Render refresh:`, error.message);
      throw error; // Trigger.dev will retry
    }
  },
});
