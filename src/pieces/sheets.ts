import { google } from 'googleapis';
import { Piece } from '../types.js';

export const sheetsPiece: Piece = {
  name: 'sheets',
  actions: {
    appendRow: async ({ auth, params }) => {
      const sheets = google.sheets({ version: 'v4', auth });
      let { spreadsheetId, range, values } = params;

      // 1. Robust values handling (Parse strings, handle nested arrays)
      if (typeof values === 'string' && values.trim().startsWith('[')) {
        try { values = JSON.parse(values); } catch (e) {}
      }
      const row = Array.isArray(values) 
        ? (Array.isArray(values[0]) ? values[0] : values) 
        : [values];

      const res = await sheets.spreadsheets.values.append({
        spreadsheetId,
        range,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [row],
        },
      });

      return res.data;
    },

    appendRowSmart: async ({ auth, params }) => {
      const sheets = google.sheets({ version: 'v4', auth });
      let { spreadsheetId, range, values } = params;

      // 1. Robust values handling
      if (typeof values === 'string' && values.trim().startsWith('[')) {
        try { values = JSON.parse(values); } catch (e) {}
      }
      const row = Array.isArray(values) 
        ? (Array.isArray(values[0]) ? values[0] : values) 
        : [values];

      // 2. Discover/Create sheet (Case-Insensitive)
      try {
        const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
        const targetSheetName = range.split('!')[0];
        const existingSheet = spreadsheet.data.sheets?.find(s => 
          s.properties?.title?.toLowerCase() === targetSheetName.toLowerCase()
        );

        if (!existingSheet) {
          console.log(`[Sheets] Creating missing sheet: ${targetSheetName}`);
          await sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            requestBody: {
              requests: [{ addSheet: { properties: { title: targetSheetName } } }],
            },
          });
        }
      } catch (err: any) {
        console.error('[Sheets] Smart Append Discovery Error:', err.message);
      }

      // 3. Append
      const res = await sheets.spreadsheets.values.append({
        spreadsheetId,
        range,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [row],
        },
      });

      // Return useful data instead of raw API response
      const output = {
        spreadsheetId,
        range: res.data.updates?.updatedRange || range,
        values: row,
        updatedCells: res.data.updates?.updatedCells || row.length,
        updatedRows: res.data.updates?.updatedRows || 1
      };
      console.log('[Sheets] appendRowSmart output:', JSON.stringify(output));
      return output;
    },

    getValues: async ({ auth, params }) => {
      const sheets = google.sheets({ version: 'v4', auth });
      const { spreadsheetId, range } = params;

      const res = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
      });

      // Return consistent structure with values property
      return {
        spreadsheetId,
        range: res.data.range || range,
        values: res.data.values || [],
        majorDimension: res.data.majorDimension || 'ROWS'
      };
    },

    createSpreadsheet: async ({ auth, params }) => {
      const sheets = google.sheets({ version: 'v4', auth });
      const res = await sheets.spreadsheets.create({
        requestBody: {
          properties: {
            title: params.title || 'Untitled Spreadsheet',
          },
        },
      });
      return res.data;
    },

    listSpreadsheets: async ({ auth }) => {
      const drive = google.drive({ version: 'v3', auth });
      const res = await drive.files.list({
        pageSize: 100,
        q: "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false",
        fields: 'files(id, name)',
      });
      return { files: res.data.files };
    },

    listSheets: async ({ auth, params }) => {
      const { spreadsheetId } = params;
      if (!spreadsheetId) throw new Error('spreadsheetId is required');
      console.log(`[Sheets] Listing sheets for spreadsheet: ${spreadsheetId}`);
      const sheets = google.sheets({ version: 'v4', auth });
      try {
        const res = await sheets.spreadsheets.get({
          spreadsheetId
        });
        return { 
          sheets: res.data.sheets?.map(s => ({
            name: s.properties?.title,
            id: s.properties?.title // We usually use title for range
          }))
        };
      } catch (err: any) {
        console.error('[Sheets] listSheets Error:', err.message);
        throw err;
      }
    }
  },
  metadata: {
    actions: {
      appendRow: {
        label: 'Append Row',
        description: 'Appends a row of values to the end of a sheet.',
        parameters: [
          { name: 'spreadsheetId', label: 'Spreadsheet', type: 'dynamic-select', required: true, dynamicOptions: { action: 'listSpreadsheets' } },
          { name: 'range', label: 'Sheet Name', type: 'dynamic-select', required: true, dynamicOptions: { action: 'listSheets', dependsOn: ['spreadsheetId'] } },
          { name: 'values', label: 'Values', type: 'array', required: true }
        ],
        outputSchema: [
          { name: 'spreadsheetId', type: 'string' },
          { name: 'tableRange', type: 'string' },
          { name: 'updates', type: 'object', properties: [
            { name: 'updatedRange', type: 'string' },
            { name: 'updatedRows', type: 'number' },
            { name: 'updatedColumns', type: 'number' },
            { name: 'updatedCells', type: 'number' }
          ]}
        ]
      },
      appendRowSmart: {
        label: 'Append Row Smart',
        description: 'Similar to appendRow, but automatically creates the worksheet if it doesn\'t exist.',
        parameters: [
          { name: 'spreadsheetId', label: 'Spreadsheet', type: 'dynamic-select', required: true, dynamicOptions: { action: 'listSpreadsheets' } },
          { name: 'range', label: 'Sheet Name', type: 'string', required: true },
          { name: 'values', label: 'Values', type: 'array', required: true }
        ],
        outputSchema: [
          { name: 'spreadsheetId', type: 'string' },
          { name: 'tableRange', type: 'string' },
          { name: 'updates', type: 'object', properties: [
            { name: 'updatedRange', type: 'string' },
            { name: 'updatedRows', type: 'number' },
            { name: 'updatedColumns', type: 'number' },
            { name: 'updatedCells', type: 'number' }
          ]}
        ]
      },
      getValues: {
        label: 'Get Values',
        description: 'Retrieves values from a specific range.',
        parameters: [
          { name: 'spreadsheetId', label: 'Spreadsheet', type: 'dynamic-select', required: true, dynamicOptions: { action: 'listSpreadsheets' } },
          { name: 'range', label: 'Sheet Name', type: 'dynamic-select', required: true, dynamicOptions: { action: 'listSheets', dependsOn: ['spreadsheetId'] } }
        ],
        outputSchema: [
          { name: 'values', type: 'array', items: { name: 'row', type: 'array', items: { name: 'cell', type: 'string' } } }
        ]
      },
      createSpreadsheet: {
        outputSchema: [
          { name: 'spreadsheetId', type: 'string' },
          { name: 'spreadsheetUrl', type: 'string' },
          { name: 'properties', type: 'object', properties: [
            { name: 'title', type: 'string' }
          ]}
        ]
      },
      listSpreadsheets: {
        outputSchema: [
          { name: 'files', type: 'array', items: { name: 'file', type: 'object', properties: [
            { name: 'id', type: 'string' },
            { name: 'name', type: 'string' }
          ]}}
        ]
      },
      listSheets: {
        outputSchema: [
          { name: 'sheets', type: 'array', items: { name: 'sheet', type: 'object', properties: [
            { name: 'id', type: 'string' },
            { name: 'name', type: 'string' }
          ]}}
        ]
      }
    }
  }
};
