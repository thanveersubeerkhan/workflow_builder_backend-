import { Piece } from '../types.js';

export const schedulePiece: Piece = {
  name: 'schedule',
  actions: {},
  triggers: {
    schedule: async ({ lastProcessedId, params }) => {
      const intervalSeconds = params?.intervalSeconds || (params?.interval ? params.interval * 60 : 300);
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
