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
    }
  }
};
