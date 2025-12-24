import { google } from 'googleapis';
import { Piece } from '../types.js';

export const gmailPiece: Piece = {
  name: 'gmail',
  actions: {
    sendEmail: async ({ auth, params }) => {
      const gmail = google.gmail({ version: 'v1', auth });
      const { to, subject, body } = params;

      const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
      const messageParts = [
        `To: ${to}`,
        'Content-Type: text/html; charset=utf-8',
        'MIME-Version: 1.0',
        `Subject: ${utf8Subject}`,
        '',
        body,
      ];
      const message = messageParts.join('\n');

      const encodedMessage = Buffer.from(message)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      const res = await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedMessage,
        },
      });

      return res.data;
    },

    listMessages: async ({ auth, params }) => {
      const gmail = google.gmail({ version: 'v1', auth });
      const res = await gmail.users.messages.list({
        userId: 'me',
        maxResults: params.maxResults || 10,
        q: params.q || '',
      });
      return res.data;
    }
  },

  triggers: {
    newEmail: async ({ auth, lastProcessedId }) => {
      const gmail = google.gmail({ version: 'v1', auth });
      const res = await gmail.users.messages.list({
        userId: 'me',
        maxResults: 5,
      });

      const messages = res.data.messages || [];
      if (messages.length > 0 && messages[0].id !== lastProcessedId) {
        const details = await gmail.users.messages.get({
          userId: 'me',
          id: messages[0].id!
        });
        return {
          newLastId: messages[0].id,
          data: details.data
        };
      }
      return null;
    }
  }
};
