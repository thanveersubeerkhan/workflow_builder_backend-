import axios from 'axios';
import { Piece } from '../types.js';

export const outlookPiece: Piece = {
  name: 'outlook',
  actions: {
    sendEmail: async ({ auth, params }) => {
      const { to, subject, body } = params;
      const accessToken = typeof auth === 'string' ? auth : (await auth.getAccessToken()).token;

      await axios.post(
        'https://graph.microsoft.com/v1.0/me/sendMail',
        {
          message: {
            subject,
            body: {
              contentType: 'HTML',
              content: body
            },
            toRecipients: [
              {
                emailAddress: {
                  address: to
                }
              }
            ]
          }
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return { success: true };
    },

    listMessages: async ({ auth, params }) => {
      const { top = 10 } = params;
      const accessToken = typeof auth === 'string' ? auth : (await auth.getAccessToken()).token;

      const res = await axios.get(
        `https://graph.microsoft.com/v1.0/me/messages?$top=${top}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      );

      return res.data;
    },

    getProfile: async ({ auth }) => {
      const accessToken = typeof auth === 'string' ? auth : (await auth.getAccessToken()).token;
      const res = await axios.get('https://graph.microsoft.com/v1.0/me', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      return res.data;
    },

    listFolders: async ({ auth }) => {
      const accessToken = typeof auth === 'string' ? auth : (await auth.getAccessToken()).token;
      const res = await axios.get('https://graph.microsoft.com/v1.0/me/mailFolders', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      return {
        folders: (res.data.value || []).map((f: any) => ({
          id: f.id,
          name: f.displayName
        }))
      };
    }
  },
  triggers: {
    newEmail: async ({ auth, lastProcessedId, params }) => {
      const accessToken = typeof auth === 'string' ? auth : (await auth.getAccessToken()).token;
      const folder = params?.folder || 'Inbox';
      
      const res = await axios.get(
        `https://graph.microsoft.com/v1.0/me/mailFolders/${folder}/messages?$top=5&$select=id,subject,from,bodyPreview,receivedDateTime`,
        {
          headers: { Authorization: `Bearer ${accessToken}` }
        }
      );

      const messages = res.data.value || [];
      if (messages.length === 0) return null;

      // lastProcessedId can be string or { lastMessageId: string }
      const effectiveLastId = typeof lastProcessedId === 'string' 
        ? lastProcessedId 
        : lastProcessedId?.lastMessageId;

      if (effectiveLastId && messages[0].id === effectiveLastId) return null;

      let targetMessage = messages[0];
      if (effectiveLastId) {
        const lastIdx = messages.findIndex((m: any) => m.id === effectiveLastId);
        if (lastIdx > 0) {
          targetMessage = messages[lastIdx - 1]; // Process chronologically
        }
      }

      return {
        newLastId: { lastMessageId: targetMessage.id },
        data: {
          id: targetMessage.id,
          subject: targetMessage.subject,
          from: targetMessage.from?.emailAddress?.address,
          snippet: targetMessage.bodyPreview,
          receivedDateTime: targetMessage.receivedDateTime
        }
      };
    }
  },
  metadata: {
    actions: {
      sendEmail: {
        label: 'Send Email',
        description: 'Sends an email via Outlook.',
        parameters: [
          { name: 'to', label: 'To', type: 'string', required: true },
          { name: 'subject', label: 'Subject', type: 'string', required: true },
          { name: 'body', label: 'Body', type: 'string', required: true }
        ],
        outputSchema: [
          { name: 'success', type: 'boolean' }
        ]
      },
      listMessages: {
        label: 'List Messages',
        description: 'List recent emails.',
        parameters: [
          { name: 'top', label: 'Top', type: 'number', default: 10 }
        ],
        outputSchema: [
          { name: 'value', type: 'array' }
        ]
      },
      getProfile: {
        label: 'Get Profile',
        description: 'Get current user profile.',
        outputSchema: [
          { name: 'displayName', type: 'string' },
          { name: 'mail', type: 'string' }
        ]
      },
      listFolders: {
        label: 'List Folders',
        description: 'Lists all mail folders.',
        outputSchema: [
          { name: 'folders', type: 'array', items: { name: 'folder', type: 'object', properties: [
            { name: 'id', type: 'string' },
            { name: 'name', type: 'string' }
          ]}}
        ]
      }
    },
    triggers: {
      newEmail: {
        label: 'New Email',
        description: 'Triggers when a new email is received.',
        parameters: [
          { 
            name: 'folder', 
            label: 'Folder', 
            type: 'dynamic-select', 
            default: 'Inbox',
            required: true,
            dynamicOptions: { action: 'listFolders' }
          }
        ],
        outputSchema: [
          { name: 'id', type: 'string' },
          { name: 'subject', type: 'string' },
          { name: 'from', type: 'string' },
          { name: 'snippet', type: 'string' }
        ]
      }
    }
  }
};
