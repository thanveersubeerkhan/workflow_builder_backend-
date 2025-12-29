import axios from 'axios';
import { Piece } from '../types.js';

export const httpPiece: Piece = {
  name: 'http',
  actions: {
    request: async ({ params }) => {
      const { method, url, headers, body } = params;
      
      console.log(`[HTTP Piece] ${method} Request to: ${url}`);
      
      try {
        const response = await axios({
          method: method || 'GET',
          url,
          headers: headers || {},
          data: body,
          timeout: 10000 // 10s timeout
        });
        
        return {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
          data: response.data
        };
      } catch (error: any) {
        console.error(`[HTTP Piece] Request Failed:`, error.message);
        return {
          error: error.message,
          status: error.response?.status,
          data: error.response?.data
        };
      }
    }
  },
  metadata: {
    actions: {
      request: {
        outputSchema: [
          { name: 'status', type: 'number' },
          { name: 'statusText', type: 'string' },
          { name: 'headers', type: 'object' },
          { name: 'data', type: 'object' },
          { name: 'error', type: 'string' }
        ]
      }
    }
  }
};
