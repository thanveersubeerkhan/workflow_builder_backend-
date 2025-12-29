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

      return res.data;
    },

    getValues: async ({ auth, params }) => {
      const sheets = google.sheets({ version: 'v4', auth });
      const { spreadsheetId, range } = params;

      const res = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
      });

      return res.data.values;
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
    }
  },
  metadata: {
    actions: {
      appendRow: {
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
      }
    }
  }
};
