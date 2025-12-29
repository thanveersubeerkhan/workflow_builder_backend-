import axios from 'axios';
import { Piece } from '../types.js';

export const httpPiece: Piece = {
  name: 'http',
  actions: {
    request: async ({ params }) => {
      const { method, url, headers, body } = params;
      
      console.log(`[HTTP Piece] ${method} Request to: ${url}`);
      
      let parsedHeaders = headers;
      let parsedBody = body;

      try {
        if (typeof headers === 'string') {
          parsedHeaders = JSON.parse(headers);
        }
      } catch (e) {
        console.warn('[HTTP Piece] Failed to parse headers JSON, using raw string (this might fail if object expected)');
      }

      try {
        if (typeof body === 'string') {
          // Verify if it looks like JSON before parsing to avoid parsing simple strings unexpectedly, 
          // though for body it's usually safe if it starts with { or [
          const trimmed = body.trim();
          if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
             parsedBody = JSON.parse(body);
          }
        }
      } catch (e) {
         console.warn('[HTTP Piece] Failed to parse body JSON, using raw string');
      }

      try {
        const response = await axios({
          method: method || 'GET',
          url,
          headers: parsedHeaders || {},
          data: parsedBody,
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
