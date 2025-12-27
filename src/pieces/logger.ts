import { Piece } from '../types.js';

export const loggerPiece: Piece = {
  name: 'logger',
  actions: {
    log: async ({ params }) => {
      console.log(`[Logger Piece] ${params.message}`);
      return { success: true, message: params.message, time: new Date().toISOString() };
    }
  },
  triggers: {}
};
