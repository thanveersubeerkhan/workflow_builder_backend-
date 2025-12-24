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
