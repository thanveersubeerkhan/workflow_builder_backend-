import axios from 'axios';
import { Piece } from '../types.js';
import * as XLSX from 'xlsx';

export const excelPiece: Piece = {
  name: 'excel',
  actions: {
    // --- New Actions ---
    createWorkbook: async ({ auth, params }) => {
      const { name, folderId = 'root' } = params;
      const accessToken = typeof auth === 'string' ? auth : (await auth.getAccessToken()).token;

      // Create a minimal valid workbook using xlsx
      const wb = XLSX.utils.book_new();
      // Add a blank sheet to ensure it's valid
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([[""]]), "Sheet1");
      
      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      
      const res = await axios.put(
        `https://graph.microsoft.com/v1.0/me/drive/items/${folderId}:/${name}:/content`,
        buffer,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          }
        }
      );

      return res.data;
    },

    createWorksheet: async ({ auth, params }) => {
        const { fileId, name } = params;
        const accessToken = typeof auth === 'string' ? auth : (await auth.getAccessToken()).token;
  
        const res = await axios.post(
          `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/workbook/worksheets`,
          { name },
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            }
          }
        );
  
        return res.data;
    },

    createTable: async ({ auth, params }) => {
        const { fileId, address, hasHeaders, name } = params;
        const accessToken = typeof auth === 'string' ? auth : (await auth.getAccessToken()).token;
  
        // POST /workbook/tables/add
        const res = await axios.post(
          `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/workbook/tables/add`,
          { address, hasHeaders },
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            }
          }
        );
        
        // Optionally rename if name provided
        if (name && res.data.id) {
             await axios.patch(
                `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/workbook/tables/${res.data.id}`,
                { name },
                {
                    headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                    }
                }
            );
            res.data.name = name;
        }
  
        return res.data;
    },

    // --- Existing Actions ---

    addRow: async ({ auth, params }) => {
      const { fileId, tableName, values } = params;
      const accessToken = typeof auth === 'string' ? auth : (await auth.getAccessToken()).token;

      // Ensure values is an array of arrays
      const rowValues = Array.isArray(values) ? (Array.isArray(values[0]) ? values : [values]) : [[values]];

      const res = await axios.post(
        `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/workbook/tables/${tableName}/rows/add`,
        {
          values: rowValues
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return res.data;
    },

    getRange: async ({ auth, params }) => {
      const { fileId, sheetName, range } = params;
      const accessToken = typeof auth === 'string' ? auth : (await auth.getAccessToken()).token;

      const res = await axios.get(
        `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/workbook/worksheets/${sheetName}/range(address='${range}')`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      );

      return res.data;
    },

    updateRange: async ({ auth, params }) => {
      const { fileId, sheetName, range, values } = params;
      const accessToken = typeof auth === 'string' ? auth : (await auth.getAccessToken()).token;

      const res = await axios.patch(
        `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/workbook/worksheets/${sheetName}/range(address='${range}')`,
        {
          values: Array.isArray(values[0]) ? values : [values]
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
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
    }
  },
  triggers: {
    // ... triggers same
    newRow: async ({ auth, lastProcessedId, params }) => {
      const { fileId, tableName } = params;
      const accessToken = typeof auth === 'string' ? auth : (await auth.getAccessToken()).token;

      const res = await axios.get(
        `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/workbook/tables/${tableName}/rows`,
        {
          headers: { Authorization: `Bearer ${accessToken}` }
        }
      );

      const rows = res.data.value || [];
      if (rows.length === 0) return null;

      // detect by row count or last value
      const latestIdx = rows.length - 1;
      const effectiveLastIdx = lastProcessedId?.lastIndex !== undefined ? lastProcessedId.lastIndex : -1;

      if (latestIdx <= effectiveLastIdx) return null;

      const targetIdx = effectiveLastIdx + 1;
      const targetRow = rows[targetIdx];

      return {
        newLastId: { lastIndex: targetIdx },
        data: {
          index: targetIdx,
          values: targetRow.values[0]
        }
      };
    }
  },
  metadata: {
    actions: {
      createWorkbook: {
        label: 'Create Workbook',
        description: 'Creates a new empty Excel workbook.',
        parameters: [
            { name: 'connection', label: 'Excel Connection', type: 'connection', required: true },
            { name: 'name', label: 'File Name (e.g. workbook.xlsx)', type: 'string', required: true },
            { name: 'folderId', label: 'Folder ID', type: 'string', required: false, description: 'ID of the parent folder. Defaults to root.' }
        ],
        outputSchema: [
            { name: 'id', type: 'string', description: 'The ID of the created file' },
            { name: 'name', type: 'string', description: 'The name of the created file' },
            { name: 'webUrl', type: 'string', description: 'Link to open the file' }
        ]
      },
      createWorksheet: {
        label: 'Create Worksheet',
        description: 'Adds a new worksheet to an existing workbook.',
        parameters: [
            { name: 'connection', label: 'Excel Connection', type: 'connection', required: true },
            { name: 'fileId', label: 'File ID', type: 'string', required: true },
            { name: 'name', label: 'Sheet Name', type: 'string', required: true }
        ],
        outputSchema: [
            { name: 'id', type: 'string', description: 'Sheet ID' },
            { name: 'name', type: 'string', description: 'Sheet Name' },
            { name: 'position', type: 'number', description: 'Position index' }
        ]
      },
      createTable: {
        label: 'Create Table',
        description: 'Creates a table in a worksheet.',
        parameters: [
            { name: 'connection', label: 'Excel Connection', type: 'connection', required: true },
            { name: 'fileId', label: 'File ID', type: 'string', required: true },
            { name: 'address', label: 'Range Address (e.g. Sheet1!A1:C5)', type: 'string', required: true },
            { name: 'hasHeaders', label: 'Has Headers', type: 'boolean', required: true, default: true }, 
            { name: 'name', label: 'Table Name', type: 'string', required: false }
        ],
        outputSchema: [
            { name: 'id', type: 'string' },
            { name: 'name', type: 'string' },
            { name: 'showHeaders', type: 'boolean' },
            { name: 'highlightLastColumn', type: 'boolean' }
        ]
      },
      addRow: {
        label: 'Add Row to Table',
        description: 'Adds a row to a specific Excel table.',
        parameters: [
          { name: 'connection', label: 'Excel Connection', type: 'connection', required: true },
          { name: 'fileId', label: 'File ID', type: 'string', required: true },
          { name: 'tableName', label: 'Table Name', type: 'string', required: true },
          { name: 'values', label: 'Row Values (Array)', type: 'array', required: true, description: 'Array of strings/numbers' }
        ],
        outputSchema: [
          { name: 'index', type: 'number', description: 'Index of the added row' },
          { name: 'values', type: 'array', description: 'Values added' }
        ]
      },
      getRange: {
        label: 'Get Range',
        description: 'Gets values from a range of cells.',
        parameters: [
          { name: 'connection', label: 'Excel Connection', type: 'connection', required: true },
          { name: 'fileId', label: 'File ID', type: 'string', required: true },
          { name: 'sheetName', label: 'Sheet Name', type: 'string', required: true },
          { name: 'range', label: 'Range (e.g. A1:B2)', type: 'string', required: true }
        ],
        outputSchema: [
          { name: 'values', type: 'array', description: '2D array of cell values' },
          { name: 'text', type: 'array', description: '2D array of cell text' },
          { name: 'rowCount', type: 'number' },
          { name: 'columnCount', type: 'number' }
        ]
      },
      updateRange: {
        label: 'Update Range',
        description: 'Updates values in a range of cells.',
        parameters: [
          { name: 'connection', label: 'Excel Connection', type: 'connection', required: true },
          { name: 'fileId', label: 'File ID', type: 'string', required: true },
          { name: 'sheetName', label: 'Sheet Name', type: 'string', required: true },
          { name: 'range', label: 'Range (e.g. A1:B2)', type: 'string', required: true },
          { name: 'values', label: 'Values (2D Array)', type: 'array', required: true }
        ],
        outputSchema: [
            { name: 'values', type: 'array' }
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
      newRow: {
        label: 'New Row in Table',
        description: 'Triggers when a new row is added to a table.',
        parameters: [
          { name: 'connection', label: 'Excel Connection', type: 'connection', required: true },
          { name: 'fileId', label: 'File ID', type: 'string', required: true },
          { name: 'tableName', label: 'Table Name', type: 'string', required: true }
        ],
        outputSchema: [
          { name: 'index', type: 'number' },
          { name: 'values', type: 'array' }
        ]
      }
    }
  }
};
