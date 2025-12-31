import { Piece } from '../types.js';
import axios from 'axios';

export const onedrivePiece: Piece = {
  name: 'onedrive',
  actions: {
    listFiles: async ({ auth, params }) => {
      const { folderId = 'root' } = params;
      const accessToken = typeof auth === 'string' ? auth : (await auth.getAccessToken()).token;

      const res = await axios.get(`https://graph.microsoft.com/v1.0/me/drive/items/${folderId}/children`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      return { files: res.data.value || [] };
    },

    uploadFile: async ({ auth, params }) => {
      const { folderId = 'root', fileName, content, contentType = 'text/plain' } = params;
      const accessToken = typeof auth === 'string' ? auth : (await auth.getAccessToken()).token;
      
      const encFileName = encodeURIComponent(fileName);

      const res = await axios.put(
        `https://graph.microsoft.com/v1.0/me/drive/items/${folderId}:/${encFileName}:/content`,
        content,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': contentType
          }
        }
      );

      return res.data;
    },

    downloadFile: async ({ auth, params }) => {
      const { fileId } = params;
      const accessToken = typeof auth === 'string' ? auth : (await auth.getAccessToken()).token;

      const cleanId = fileId ? fileId.split('&')[0] : fileId;

      const res = await axios.get(`https://graph.microsoft.com/v1.0/me/drive/items/${cleanId}/content`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        responseType: 'arraybuffer'
      });

      // Convert to base64 for safety in workflow data
      const base64 = Buffer.from(res.data, 'binary').toString('base64');
      return { 
        content: base64, 
        fileName: res.headers['content-disposition']?.split('filename=')[1]?.replace(/"/g, '') || 'file'
      };
    },

    deleteFile: async ({ auth, params }) => {
      const { fileId } = params;
      const accessToken = typeof auth === 'string' ? auth : (await auth.getAccessToken()).token;
      
      const cleanId = fileId ? fileId.split('&')[0] : fileId;

      await axios.delete(`https://graph.microsoft.com/v1.0/me/drive/items/${cleanId}`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      return { success: true };
    },

    listFolders: async ({ auth, params }) => {
      const { driveId, folderId = 'root' } = params;
      const accessToken = typeof auth === 'string' ? auth : (await auth.getAccessToken()).token;

      const endpoint = driveId 
        ? `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${folderId}/children?$filter=folder ne null`
        : `https://graph.microsoft.com/v1.0/me/drive/items/${folderId}/children?$filter=folder ne null`;

      const res = await axios.get(endpoint, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      return { 
        folders: (res.data.value || []).map((item: any) => ({
          id: item.id,
          name: item.name,
          webUrl: item.webUrl,
          createdDateTime: item.createdDateTime
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
  triggers: {
    newFile: async ({ auth, lastProcessedId, params }) => {
      const { folderId = 'root' } = params;
      const accessToken = typeof auth === 'string' ? auth : (await auth.getAccessToken()).token;

      const res = await axios.get(
        `https://graph.microsoft.com/v1.0/me/drive/items/${folderId}/children?$top=10&$orderby=createdDateTime desc`,
        {
          headers: { Authorization: `Bearer ${accessToken}` }
        }
      );

      const items = res.data.value || [];
      if (items.length === 0) return null;

      const newestItem = items[0];
      
      const effectiveLastId = typeof lastProcessedId === 'string' 
        ? lastProcessedId 
        : lastProcessedId?.lastFileId;

      if (effectiveLastId && newestItem.id === effectiveLastId) {
        return null;
      }

      const newItems = items.filter((item: any) => item.id !== effectiveLastId);

      return {
        newLastId: { lastFileId: newestItem.id },
        items: newItems.map((item: any) => ({
          id: item.id,
          name: item.name,
          size: item.size,
          webUrl: item.webUrl,
          createdDateTime: item.createdDateTime
        }))
      };
    }
  },
  metadata: {
    actions: {
      listFiles: {
        label: 'List Files',
        description: 'Lists files in a OneDrive folder.',
        parameters: [
          { name: 'connection', label: 'OneDrive Connection', type: 'connection', required: true },
          { name: 'folderId', label: 'Folder ID', type: 'string', required: false, description: 'Leave empty for root' }
        ],
        outputSchema: [
          { name: 'files', type: 'array' }
        ]
      },
      uploadFile: {
        label: 'Upload File',
        description: 'Uploads a file to OneDrive.',
        parameters: [
          { name: 'connection', label: 'OneDrive Connection', type: 'connection', required: true },
          { name: 'fileName', label: 'File Name', type: 'string', required: true },
          { name: 'content', label: 'File Content', type: 'string', required: true },
          { 
            name: 'folderId', 
            label: 'Folder', 
            type: 'dynamic-select', 
            required: false,
            dynamicOptions: { action: 'listFolders' }
          },
          { name: 'contentType', label: 'Content Type', type: 'string', required: false, default: 'text/plain' }
        ]
      },
      downloadFile: {
        label: 'Download File',
        description: 'Downloads a file from OneDrive as base64.',
        parameters: [
          { name: 'connection', label: 'OneDrive Connection', type: 'connection', required: true },
          { name: 'fileId', label: 'File ID', type: 'string', required: true }
        ],
        outputSchema: [
          { name: 'content', type: 'string' },
          { name: 'fileName', type: 'string' }
        ]
      },
      deleteFile: {
        label: 'Delete File',
        description: 'Deletes a file from OneDrive.',
        parameters: [
          { name: 'connection', label: 'OneDrive Connection', type: 'connection', required: true },
          { name: 'fileId', label: 'File ID', type: 'string', required: true }
        ]
      },
      listFolders: {
        label: 'List Folders',
        description: 'Lists folders in OneDrive to help find folder IDs.',
        parameters: [
          { name: 'connection', label: 'OneDrive Connection', type: 'connection', required: true },
          { name: 'driveId', label: 'Drive ID', type: 'string', required: false },
          { name: 'folderId', label: 'Parent Folder ID', type: 'string', required: false, description: 'Leave empty for root' }
        ],
        outputSchema: [
          { name: 'folders', type: 'array' }
        ]
      },
      getProfile: {
        label: 'Get Profile',
        description: 'Get user profile.',
        outputSchema: [
          { name: 'displayName', type: 'string' }
        ]
      }
    },
    triggers: {
      newFile: {
        label: 'New File',
        description: 'Triggers when a new file is added to a folder.',
        parameters: [
          { name: 'connection', label: 'OneDrive Connection', type: 'connection', required: true },
          { 
            name: 'folderId', 
            label: 'Folder', 
            type: 'dynamic-select', 
            required: false,
            dynamicOptions: { action: 'listFolders' }
          }
        ],
        outputSchema: [
          { name: 'id', type: 'string' },
          { name: 'name', type: 'string' },
          { name: 'webUrl', type: 'string' }
        ]
      }
    }
  }
};
