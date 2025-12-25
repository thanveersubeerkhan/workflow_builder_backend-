import { Piece } from '../types.js';

export const schedulePiece: Piece = {
  name: 'schedule',
  actions: {},
  triggers: {
    schedule: async ({ lastProcessedId, params }) => {
      let intervalSeconds = 300; // Default 5 minutes

      console.log(`[Schedule Debug] Params: ${JSON.stringify(params)} | LastId: ${lastProcessedId}`);

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
      const now = Date.now();
      
      console.log(`[Schedule Debug] Interval: ${intervalSeconds}s | Required Wait: ${intervalMs}ms`);

      if (!lastProcessedId) {
        // First run: fire immediately and record timestamp
        return {
          newLastId: now.toString(),
          data: { firedAt: new Date(now).toISOString() }
        };
      }

      const lastRun = parseInt(lastProcessedId, 10);
      if (isNaN(lastRun)) {
        // Fallback for invalid lastProcessedId
        return {
          newLastId: now.toString(),
          data: { firedAt: new Date(now).toISOString() }
        };
      }

      if (now - lastRun >= intervalMs) {
        return {
          newLastId: now.toString(),
          data: { firedAt: new Date(now).toISOString() }
        };
      }

      return null;
    }
  }
};
