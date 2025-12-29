import { google } from 'googleapis';
import { Piece } from '../types.js';

export const drivePiece: Piece = {
  name: 'drive',
  actions: {
    listFiles: async ({ auth, params }) => {
      const drive = google.drive({ version: 'v3', auth });
      const res = await drive.files.list({
        pageSize: params.pageSize || 10,
        fields: 'nextPageToken, files(id, name, mimeType)',
      });
      return res.data.files;
    },

    createFolder: async ({ auth, params }) => {
      const drive = google.drive({ version: 'v3', auth });
      const res = await drive.files.create({
        requestBody: {
          name: params.name,
          mimeType: 'application/vnd.google-apps.folder',
        },
      });
      return res.data;
    }
  },
  metadata: {
    actions: {
      listFiles: {
        outputSchema: [
          { name: 'files', type: 'array', items: { name: 'file', type: 'object', properties: [
            { name: 'id', type: 'string' },
            { name: 'name', type: 'string' },
            { name: 'mimeType', type: 'string' }
          ]}}
        ]
      },
      createFolder: {
        outputSchema: [
          { name: 'id', type: 'string' },
          { name: 'name', type: 'string' },
          { name: 'mimeType', type: 'string' }
        ]
      }
    }
  }
};
