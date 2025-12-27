import { task } from "@trigger.dev/sdk/v3";
import axios from "axios";

export const workflowExecutor = task({
  id: "workflow-executor",
  queue: {
    concurrencyLimit: 20,
  },
  run: async (payload: { flowId: string, userId: string, definition: any, triggerData: any }) => {
    const startTime = new Date();
    console.log(`[Queue] 🚀 Execution started for flow: ${payload.flowId} (User: ${payload.userId})`);
    console.log(`[Queue] 📡 Context:`, JSON.stringify({ flowId: payload.flowId, userId: payload.userId, triggerData: payload.triggerData }, null, 2));
    
    const RENDER_URL = process.env.RENDER_URL || "http://localhost:3000";
    
    try {
      const response = await axios.post(`${RENDER_URL}/api/internal/execute-flow`, payload);
      console.log(`[Queue] ✅ Render response:`, JSON.stringify(response.data, null, 2));
      
      const duration = new Date().getTime() - startTime.getTime();
      console.log(`[Queue] 🏁 Execution cycle complete. Duration: ${duration}ms`);
      return response.data;
    } catch (error: any) {
      console.error(`[Queue] ❌ Failed to call Render execution:`, error.message);
      if (error.response) {
        console.error(`[Queue] Error response data:`, JSON.stringify(error.response.data, null, 2));
      }
      throw error; // Trigger.dev will retry
    } finally {
      console.log(`\n______________________________________________________________________\n`);
    }
  },
});
