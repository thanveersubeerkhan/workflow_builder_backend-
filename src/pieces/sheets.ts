import { google } from 'googleapis';
import { Piece } from '../types.js';

export const sheetsPiece: Piece = {
  name: 'sheets',
  actions: {
    appendRow: async ({ auth, params }) => {
      const sheets = google.sheets({ version: 'v4', auth });
      const { spreadsheetId, range, values } = params;

      const res = await sheets.spreadsheets.values.append({
        spreadsheetId,
        range,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [values],
        },
      });

      return res.data;
    },

    appendRowSmart: async ({ auth, params }) => {
      const sheets = google.sheets({ version: 'v4', auth });
      const { spreadsheetId, range, values } = params;

      // 1. Check if sheet exists
      try {
        const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
        const sheetName = range.split('!')[0];
        const exists = spreadsheet.data.sheets?.some(s => s.properties?.title === sheetName);

        if (!exists) {
          console.log(`[Sheets] Creating sheet: ${sheetName}`);
          await sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            requestBody: {
              requests: [
                {
                  addSheet: {
                    properties: {
                      title: sheetName,
                    },
                  },
                },
              ],
            },
          });
        }
      } catch (err: any) {
        console.error('[Sheets] Smart Append Error (Check/Create):', err.message);
        // Fallback to normal append (might fail if spreadsheet itself doesn't exist)
      }

      // 2. Append
      const res = await sheets.spreadsheets.values.append({
        spreadsheetId,
        range,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [values],
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
  }
};
