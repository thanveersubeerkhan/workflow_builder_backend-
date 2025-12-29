import { Piece } from '../types.js';

export const schedulePiece: Piece = {
  name: 'schedule',
  actions: {},
  triggers: {
    schedule: async ({ lastProcessedId, params, epoch }) => {
      let intervalSeconds = 300; // Default 5 minutes

      console.log(`[Schedule Debug] Params: ${JSON.stringify(params)} | LastId: ${JSON.stringify(lastProcessedId)} | Epoch: ${epoch}`);

      if (params) {
        if (params.intervalType === 'seconds' && params.intervalSeconds) {
          intervalSeconds = Number(params.intervalSeconds);
        } else if (params.intervalType === 'minutes' && params.intervalMinutes) {
          intervalSeconds = Number(params.intervalMinutes) * 60;
        } else if (params.intervalType === 'hours' && params.intervalHours) {
          intervalSeconds = Number(params.intervalHours) * 3600;
        } else if (params.intervalType === 'days' && params.intervalDay) {
          intervalSeconds = Number(params.intervalDay) * 86400;
        } else if (params.interval) {
          intervalSeconds = Number(params.interval) * 60;
        }
      }
      
      const intervalMs = intervalSeconds * 1000;
      const now = epoch || Date.now();
      
      console.log(`[Schedule Debug] Interval: ${intervalSeconds}s | Using Time: ${new Date(now).toLocaleTimeString()}`);

      let lastRun: number | null = null;
      if (typeof lastProcessedId === 'string' && lastProcessedId) {
        lastRun = parseInt(lastProcessedId, 10);
      } else if (lastProcessedId && typeof lastProcessedId === 'object' && lastProcessedId.time) {
        lastRun = parseInt(lastProcessedId.time, 10);
      }

      if (lastRun === null || isNaN(lastRun)) {
        // First run or invalid data: fire immediately and record timestamp
        return {
          newLastId: { time: now.toString(), runId: "" },
          data: { firedAt: new Date(now).toISOString() }
        };
      }

      if (now - lastRun >= intervalMs) {
        return {
          newLastId: { time: now.toString(), runId: "" },
          data: { firedAt: new Date(now).toISOString() }
        };
      }

      return null;
    }
  },
  metadata: {
    triggers: {
      schedule: {
        outputSchema: [
          { name: 'firedAt', type: 'string', description: 'The ISO timestamp when the schedule fired.' }
        ]
      }
    }
  }
};
