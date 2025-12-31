import axios from 'axios';
import { Piece } from '../types.js';

export const wordPiece: Piece = {
  name: 'word',
  actions: {
    getContent: async ({ auth, params }) => {
      const { fileId } = params;
      const accessToken = typeof auth === 'string' ? auth : (await auth.getAccessToken()).token;
      
      const cleanId = fileId ? fileId.split('&')[0] : fileId;

      const res = await axios.get(
        `https://graph.microsoft.com/v1.0/me/drive/items/${cleanId}/content`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`
          },
          responseType: 'text'
        }
      );

      return { content: res.data };
    },

    updateContent: async ({ auth, params }) => {
      const { fileId, content } = params;
      const accessToken = typeof auth === 'string' ? auth : (await auth.getAccessToken()).token;
      
      const cleanId = fileId ? fileId.split('&')[0] : fileId;

      const res = await axios.put(
        `https://graph.microsoft.com/v1.0/me/drive/items/${cleanId}/content`,
        content,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'text/plain'
          }
        }
      );

      return res.data;
    },

    createDocument: async ({ auth, params }) => {
      const { name, driveId, folderId = 'root', content = '' } = params;
      const accessToken = typeof auth === 'string' ? auth : (await auth.getAccessToken()).token;
      
      const encName = encodeURIComponent(name);

      let url = `https://graph.microsoft.com/v1.0/me/drive/items/${folderId}:/${encName}:/content`;
      if (driveId) {
        url = `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${folderId}:/${encName}:/content`;
      }

      const res = await axios.put(
        url,
        content,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'text/plain'
          }
        }
      );

      return res.data;
    },

    listFolders: async ({ auth, params }) => {
      const { driveId, folderId = 'root' } = params;
      const accessToken = typeof auth === 'string' ? auth : (await auth.getAccessToken()).token;

      let url = `https://graph.microsoft.com/v1.0/me/drive/items/${folderId}/children?$filter=folder ne null`;
      if (driveId) {
        url = `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${folderId}/children?$filter=folder ne null`;
      }

      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      return {
        folders: (res.data.value || []).map((f: any) => ({
          id: f.id,
          name: f.name,
          driveId: f.parentReference?.driveId
        }))
      };
    },

    getProfile: async ({ auth }) => {
      const accessToken = typeof auth === 'string' ? auth : (await auth.getAccessToken()).token;
      const res = await axios.get('https://graph.microsoft.com/v1.0/me', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      return res.data;
    }
  },
  metadata: {
    actions: {
      getContent: {
        label: 'Get Content',
        description: 'Gets the text content of a Word document.',
        parameters: [
          { name: 'connection', label: 'Word Connection', type: 'connection', required: true },
          { name: 'fileId', label: 'File ID', type: 'string', required: true }
        ],
        outputSchema: [
          { name: 'content', type: 'string', description: 'The plain text content of the document' }
        ]
      },
      updateContent: {
        label: 'Update Content',
        description: 'Overwrites the content of a Word document.',
        parameters: [
          { name: 'connection', label: 'Word Connection', type: 'connection', required: true },
          { name: 'fileId', label: 'File ID', type: 'string', required: true },
          { name: 'content', label: 'Text Content', type: 'string', required: true }
        ],
        outputSchema: [
          { name: 'id', type: 'string' },
          { name: 'name', type: 'string' },
          { name: 'size', type: 'number' }
        ]
      },
      createDocument: {
        label: 'Create Document',
        description: 'Creates a new document in OneDrive.',
        parameters: [
          { name: 'connection', label: 'Word Connection', type: 'connection', required: true },
          { name: 'name', label: 'File Name (e.g. document.docx)', type: 'string', required: true },
          { name: 'driveId', label: 'Drive ID', type: 'string', required: false, description: 'Optional Drive ID. Defaults to personal drive.' },
          { name: 'folderId', label: 'Folder ID', type: 'string', required: false, description: 'Parent folder ID. Defaults to root.' },
          { name: 'content', label: 'Initial Content', type: 'string', required: false }
        ],
        outputSchema: [
          { name: 'id', type: 'string', description: 'Created File ID' },
          { name: 'name', type: 'string' },
          { name: 'webUrl', type: 'string', description: 'Link to document' }
        ]
      },
      listFolders: {
        label: 'List Folders',
        description: 'Lists folders in your OneDrive to help find a folder ID.',
        parameters: [
          { name: 'connection', label: 'Word Connection', type: 'connection', required: true },
          { name: 'driveId', label: 'Drive ID', type: 'string', required: false },
          { name: 'folderId', label: 'Folder ID (Parent)', type: 'string', required: false }
        ],
        outputSchema: [
          {
            name: 'folders',
            type: 'array',
            items: {
              name: 'folder',
              type: 'object',
              properties: [
                { name: 'id', type: 'string' },
                { name: 'name', type: 'string' },
                { name: 'driveId', type: 'string' },
                { name: 'webUrl', type: 'string' }
              ]
            }
          }
        ]
      },
      getProfile: {
        label: 'Get Profile',
        description: 'Get user profile.',
        outputSchema: [
          { name: 'displayName', type: 'string' },
          { name: 'mail', type: 'string' },
          { name: 'id', type: 'string' }
        ]
      }
    }
  }
};
