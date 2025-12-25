import { Piece } from '../types.js';

export const schedulePiece: Piece = {
  name: 'schedule',
  actions: {},
  triggers: {
    schedule: async ({ lastProcessedId, params }) => {
      let intervalSeconds = 300; // Default 5 minutes

      if (params) {
        if (params.intervalType === 'seconds' && params.intervalSeconds) {
          intervalSeconds = params.intervalSeconds;
        } else if (params.intervalType === 'minutes' && params.intervalMinutes) {
          intervalSeconds = params.intervalMinutes * 60;
        } else if (params.intervalType === 'hours' && params.intervalHours) {
          intervalSeconds = params.intervalHours * 3600;
        } else if (params.intervalType === 'days' && params.intervalDay) {
          intervalSeconds = params.intervalDay * 86400;
        } else if (params.interval) {
          // Legacy support
          intervalSeconds = params.interval * 60;
        }
      }
      const intervalMs = intervalSeconds * 1000;
      const now = Date.now();

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
