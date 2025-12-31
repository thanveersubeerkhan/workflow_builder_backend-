import { google } from 'googleapis';
import { Piece } from '../types.js';

export const drivePiece: Piece = {
  name: 'drive',
  actions: {
    listFiles: async ({ auth, params }) => {
      const drive = google.drive({ version: 'v3', auth });
      const res = await drive.files.list({
        pageSize: params.pageSize || 10
      });
      return res.data.files;
    },

    createFolder: async ({ auth, params }) => {
      const drive = google.drive({ version: 'v3', auth });
      const requestBody: any = {
        name: params.name,
        mimeType: 'application/vnd.google-apps.folder',
      };
      
      // Add parent folder if specified
      if (params.parent) {
        requestBody.parents = [params.parent];
      }
      
      const res = await drive.files.create({
        requestBody,
      });
      return res.data;
    },

    listFolders: async ({ auth }) => {
      const drive = google.drive({ version: 'v3', auth });
      const res = await drive.files.list({
        q: "mimeType='application/vnd.google-apps.folder' and trashed=false"
      });
      return { 
        folders: res.data.files?.map(f => ({
          id: f.id,
          name: f.name
        })) || []
      };
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
        label: 'Create Folder',
        description: 'Creates a new folder.',
        parameters: [
          { name: 'name', label: 'Folder Name', type: 'string', required: true },
          { 
            name: 'parent', 
            label: 'Parent Folder', 
            type: 'dynamic-select', 
            description: 'Optional parent folder',
            dynamicOptions: { action: 'listFolders' }
          }
        ],
        outputSchema: [
          { name: 'id', type: 'string' },
          { name: 'name', type: 'string' },
          { name: 'mimeType', type: 'string' }
        ]
      },
      listFolders: {
        label: 'List Folders',
        description: 'Lists all folders in Drive.',
        outputSchema: [
          { name: 'folders', type: 'array', items: { name: 'folder', type: 'object', properties: [
            { name: 'id', type: 'string' },
            { name: 'name', type: 'string' }
          ]}}
        ]
      }
    }
  }
};
