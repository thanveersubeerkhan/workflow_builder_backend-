import { task } from "@trigger.dev/sdk/v3";
import axios from "axios";

export const workflowExecutor = task({
  id: "workflow-executor",
  queue: {
    concurrencyLimit: 20,
  },
  run: async (payload: { flowId: string, userId: string, definition: any, triggerData: any }) => {
    console.log(`[Queue] 🚀 Loopback execution for flow: ${payload.flowId}`);
    
    const RENDER_URL = process.env.RENDER_URL || "http://localhost:3000";
    
    try {
      const response = await axios.post(`${RENDER_URL}/api/internal/execute-flow`, payload);
      console.log(`[Queue] ✅ Render response:`, response.data);
      return response.data;
    } catch (error: any) {
      console.error(`[Queue] ❌ Failed to call Render execution:`, error.message);
      if (error.response) {
        console.error(`[Queue] Error response data:`, error.response.data);
      }
      throw error; // Trigger.dev will retry
    }
  },
});
