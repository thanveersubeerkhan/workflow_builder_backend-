import { google } from 'googleapis';
import { Piece } from '../types.js';

export const docsPiece: Piece = {
  name: 'docs',
  actions: {
    createDocument: async ({ auth, params }) => {
      const docs = google.docs({ version: 'v1', auth });
      const res = await docs.documents.create({
        requestBody: {
          title: params.title,
        },
      });
      return res.data;
    },

    appendText: async ({ auth, params }) => {
      const docs = google.docs({ version: 'v1', auth });
      const { documentId, text } = params;

      const res = await docs.documents.batchUpdate({
        documentId,
        requestBody: {
          requests: [
            {
              insertText: {
                location: { index: 1 },
                text: text + '\n',
              },
            },
          ],
        },
      });

      return res.data;
    },

    listDocs: async ({ auth }) => {
      const drive = google.drive({ version: 'v3', auth });
      try {
        const res = await drive.files.list({
          pageSize: 100,
          q: "mimeType='application/vnd.google-apps.document' and trashed=false"
        });
        return { files: res.data.files || [] };
      } catch (err: any) {
        console.error('[Docs] listDocs Error:', err.message);
        throw err;
      }
    }
  },
  metadata: {
    actions: {
      createDocument: {
        outputSchema: [
          { name: 'documentId', type: 'string' },
          { name: 'title', type: 'string' },
          { name: 'revisionId', type: 'string' }
        ]
      },
      appendText: {
        outputSchema: [
          { name: 'documentId', type: 'string' },
          { name: 'replies', type: 'array', items: { name: 'reply', type: 'object' } }
        ]
      },
      listDocs: {
        outputSchema: [
          { name: 'files', type: 'array', items: { name: 'file', type: 'object', properties: [
            { name: 'id', type: 'string' },
            { name: 'name', type: 'string' }
          ]}}
        ]
      }
    }
  }
};
