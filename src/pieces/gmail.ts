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
    newEmail: async ({ auth, lastProcessedId, params }) => {
      const gmail = google.gmail({ version: 'v1', auth });
      const res = await gmail.users.messages.list({
        userId: 'me',
        maxResults: 5,
        q: params?.q || '',
      });

      const messages = res.data.messages || [];
      
      // Handle lastProcessedId as string (backward compatibility) or object
      let effectiveLastId: string | undefined;
      if (typeof lastProcessedId === 'string') {
        effectiveLastId = lastProcessedId;
      } else if (lastProcessedId && typeof lastProcessedId === 'object') {
        effectiveLastId = lastProcessedId.lastMessageId || lastProcessedId.runId; // runId as fallback if users use that key
      }

      // If no messages or the latest is already processed, nothing to do
      if (messages.length === 0 || (effectiveLastId && messages[0].id === effectiveLastId)) {
        return null;
      }

      // Find the first message that IS our effectiveLastId
      // and take the one right AFTER it in the list (which is the next newest)
      // or if not found, just take the oldest in the 5-item window
      let targetMessage = messages[0];
      
      if (effectiveLastId) {
        const lastIdx = messages.findIndex(m => m.id === effectiveLastId);
        if (lastIdx > 0) {
            // There are messages between messages[0] and effectiveLastId
            // We pick the one right before effectiveLastId in the array (idx - 1)
            // so we process them in chronological order
            targetMessage = messages[lastIdx - 1];
        } else if (lastIdx === -1) {
            // effectiveLastId not in the 5-item window? 
            // Default to the most recent one to reset the marker
            targetMessage = messages[0];
        }
      }

      const details = await gmail.users.messages.get({
        userId: 'me',
        id: targetMessage.id!
      });

      return {
        newLastId: { lastMessageId: targetMessage.id },
        data: details.data
      };
    }
  }
};
