import { google } from 'googleapis';
import { Piece } from '../types.js';

function decodeBase64(data: string) {
  try {
    return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString();
  } catch (err) {
    console.error(`[Gmail] Base64 Decode Error:`, err);
    return '';
  }
}

function extractBody(payload: any): string {
  if (payload.body?.data) {
    return decodeBase64(payload.body.data);
  }
  if (payload.parts) {
    // 1. Try to find text/plain
    const textPart = payload.parts.find((p: any) => p.mimeType === 'text/plain');
    if (textPart) {
      const res = extractBody(textPart);
      if (res) return res;
    }

    // 2. Try to find text/html
    const htmlPart = payload.parts.find((p: any) => p.mimeType === 'text/html');
    if (htmlPart) {
      const res = extractBody(htmlPart);
      if (res) return res;
    }

    // 3. Recurse into all parts (e.g. multipart/alternative, multipart/related)
    for (const part of payload.parts) {
      if (part.mimeType?.startsWith('multipart/')) {
        const res = extractBody(part);
        if (res) return res;
      }
    }
  }
  return '';
}

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
    },

    getMessage: async ({ auth, params }) => {
      const gmail = google.gmail({ version: 'v1', auth });
      const res = await gmail.users.messages.get({
        userId: 'me',
        id: params.id,
      });

      const message = res.data;
      const headers = message.payload?.headers || [];
      const subject = headers.find(h => h.name?.toLowerCase() === 'subject')?.value || '';
      const from = headers.find(h => h.name?.toLowerCase() === 'from')?.value || '';
      const body = extractBody(message.payload) || message.snippet || '';

      console.log(`[Gmail] Action getMessage result: subject="${subject}", bodyLength=${body.length}`);

      return {
        id: message.id,
        threadId: message.threadId,
        subject,
        from,
        body,
        ...message
      };
    },

    listLabels: async ({ auth }) => {
      const gmail = google.gmail({ version: 'v1', auth });
      const res = await gmail.users.labels.list({ userId: 'me' });
      return { 
        labels: res.data.labels?.map(l => ({
          id: l.name,
          name: l.name
        })) || []
      };
    }
  },

  triggers: {
    newEmail: async ({ auth, lastProcessedId, params }) => {
      const gmail = google.gmail({ version: 'v1', auth });
      
      const folder = params?.folder || 'INBOX';
      const userQuery = params?.q || '';
      const query = `label:${folder} ${userQuery}`.trim();
      
      console.log(`[Gmail Trigger] Checking for new emails. Query: "${query}", lastProcessedId:`, lastProcessedId);
      
      const res = await gmail.users.messages.list({
        userId: 'me',
        maxResults: 5,
        q: query,
      });

      const messages = res.data.messages || [];
      console.log(`[Gmail Trigger] Found ${messages.length} messages in ${folder}`);
      
      // Handle lastProcessedId as string (backward compatibility) or object
      let effectiveLastId: string | undefined;
      if (typeof lastProcessedId === 'string') {
        effectiveLastId = lastProcessedId;
      } else if (lastProcessedId && typeof lastProcessedId === 'object') {
        effectiveLastId = lastProcessedId.lastMessageId || lastProcessedId.runId; 
      }
      
      console.log(`[Gmail Trigger] Effective last ID: ${effectiveLastId || 'NONE (first run)'}`);

      // If no messages, nothing to do
      if (messages.length === 0) {
        console.log(`[Gmail Trigger] No messages found in ${folder}`);
        return null;
      }
      
      // If the latest message is already processed, nothing to do
      if (effectiveLastId && messages[0].id === effectiveLastId) {
        console.log(`[Gmail Trigger] Latest message (${messages[0].id}) already processed`);
        return null;
      }

      // Find the first message that IS our effectiveLastId
      // and take the one right AFTER it in the list (which is the next newest)
      // or if not found, just take the oldest in the 5-item window
      let targetMessage = messages[0];
      
      if (effectiveLastId) {
        const lastIdx = messages.findIndex(m => m.id === effectiveLastId);
        console.log(`[Gmail Trigger] Last processed message index in current batch: ${lastIdx}`);
        
        if (lastIdx > 0) {
            // There are messages between messages[0] and effectiveLastId
            // We pick the one right before effectiveLastId in the array (idx - 1)
            // so we process them in chronological order
            targetMessage = messages[lastIdx - 1];
            console.log(`[Gmail Trigger] Processing next unprocessed message at index ${lastIdx - 1}`);
        } else if (lastIdx === -1) {
            // effectiveLastId not in the 5-item window? 
            // Default to the most recent one to reset the marker
            targetMessage = messages[0];
            console.log(`[Gmail Trigger] Last processed ID not in current batch, processing latest message`);
        }
      } else {
        console.log(`[Gmail Trigger] First run - processing latest message`);
      }

      console.log(`[Gmail Trigger] Fetching details for message: ${targetMessage.id}`);
      const details = await gmail.users.messages.get({
        userId: 'me',
        id: targetMessage.id!
      });

      const message = details.data;
      const headers = message.payload?.headers || [];
      const subject = headers.find(h => h.name?.toLowerCase() === 'subject')?.value || '';
      const from = headers.find(h => h.name?.toLowerCase() === 'from')?.value || '';
      const body = extractBody(message.payload) || message.snippet || '';

      console.log(`[Gmail Trigger] ✅ NEW EMAIL DETECTED! Subject: "${subject}", From: ${from}`);

      return {
        newLastId: { lastMessageId: targetMessage.id },
        data: {
          id: message.id,
          threadId: message.threadId,
          subject,
          from,
          body,
          ...message
        }
      };
    }
  },
  metadata: {
    actions: {
      sendEmail: {
        outputSchema: [
          { name: 'id', type: 'string', description: 'The ID of the sent message.' },
          { name: 'threadId', type: 'string', description: 'The thread ID of the sent message.' }
        ]
      },
      listMessages: {
        outputSchema: [
          { name: 'messages', type: 'array', description: 'List of message summaries.' },
          { name: 'resultSizeEstimate', type: 'number', description: 'Estimated total number of results.' }
        ]
      },
      listLabels: {
        label: 'List Labels',
        description: 'Lists all Gmail labels.',
        outputSchema: [
          { name: 'labels', type: 'array', items: { name: 'label', type: 'object', properties: [
            { name: 'id', type: 'string' },
            { name: 'name', type: 'string' }
          ]}}
        ]
      },
      getMessage: {
        label: 'Get Message',
        description: 'Get a specific message by its ID.',
        parameters: [
          { name: 'id', label: 'Message ID', type: 'string', required: true, description: 'The ID of the message to retrieve.' }
        ],
        outputSchema: [
          { name: 'id', type: 'string', description: 'The unique ID of the message.' },
          { name: 'threadId', type: 'string', description: 'The ID of the thread which contains this message.' },
          { name: 'snippet', type: 'string', description: 'A short part of the message text.' },
          { name: 'subject', type: 'string', description: 'The message subject.' },
          { name: 'from', type: 'string', description: 'The sender email address.' },
          { name: 'body', type: 'string', description: 'The full message body.' }
        ]
      }
    },
    triggers: {
      newEmail: {
        label: 'New Email',
        description: 'Triggers when a new email arrives in a specific label.',
        parameters: [
          { 
            name: 'folder', 
            label: 'Label', 
            type: 'dynamic-select', 
            required: true, 
            default: 'INBOX',
            dynamicOptions: { action: 'listLabels' }
          },
          { name: 'q', label: 'Search Query', type: 'string', description: 'Additional search query (e.g. from:example.com)' }
        ],
        outputSchema: [
          { name: 'id', type: 'string', description: 'The unique ID of the message.' },
          { name: 'threadId', type: 'string', description: 'The ID of the thread which contains this message.' },
          { name: 'snippet', type: 'string', description: 'A short part of the message text.' },
          { name: 'subject', type: 'string', description: 'The message subject.' },
          { name: 'from', type: 'string', description: 'The sender email address.' },
          { name: 'body', type: 'string', description: 'The full message body.' }
        ]
      }
    }
  }
};
