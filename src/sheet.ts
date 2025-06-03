import { google } from "googleapis";
import { JWT } from "google-auth-library";
import credentials from "./service-account.json";

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];
const SPREADSHEET_ID = credentials.google_sheets_id;
const SHEET_NAME = "Sheet9"; // chang the sheetName

const auth = new JWT({
  email: credentials.client_email,
  key: credentials.private_key,
  scopes: SCOPES,
});

const sheets = google.sheets({ version: "v4", auth });

async function getSheetIdByName(sheetName: string): Promise<number> {
  const response = await sheets.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID,
  });

  const sheet = response.data.sheets?.find(
    (s) => s.properties?.title === sheetName
  );

  if (!sheet || sheet.properties?.sheetId === undefined) {
    throw new Error(`Sheet with name "${sheetName}" not found.`);
  }

  return sheet.properties?.sheetId || 0;
}

function formatTimestamp(value: any): any {
  if (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/.test(value)
  ) {
    const date = new Date(value);
    return date.toISOString().replace("T", " ").substring(0, 19);
  }
  return value;
}

export async function appendToSheet(
  rows: any[][],
  headerRowIndexes: number[] = []
) {
  rows = rows.map((row) => row.map((cell) => formatTimestamp(cell)));
  const response = await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A1`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: rows },
  });

  const updatesRange = response.data.updates?.updatedRange;
  if (!updatesRange) return;

  const sheetId = await getSheetIdByName(SHEET_NAME);
  const startRow = parseInt(
    updatesRange.split("!")[1].match(/\d+/)?.[0] || "1"
  );
  const sheetStartRowIndex = startRow - 1;

  const requests: any[] = [];

  // 🟨 Align all inserted cells
  requests.push({
    repeatCell: {
      range: {
        sheetId,
        startRowIndex: sheetStartRowIndex,
        endRowIndex: sheetStartRowIndex + rows.length,
      },
      cell: {
        userEnteredFormat: {
          horizontalAlignment: "CENTER",
          verticalAlignment: "MIDDLE",
        },
      },
      fields: "userEnteredFormat(horizontalAlignment,verticalAlignment)",
    },
  });

  // 🟫 Style header/info rows
  for (const relIndex of headerRowIndexes) {
    const absRow = sheetStartRowIndex + relIndex;

    // 🔹 Style first 10 columns of this row
    requests.push({
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: absRow,
          endRowIndex: absRow + 1,
          startColumnIndex: 0,
          endColumnIndex: 10,
        },
        cell: {
          userEnteredFormat: {
            textFormat: {
              bold: true,
              foregroundColor: { red: 1, green: 1, blue: 1 }, // white
            },
            backgroundColor: { red: 0.3, green: 0.3, blue: 0.3 },
          },
        },
        fields:
          "userEnteredFormat.textFormat,userEnteredFormat.backgroundColor",
      },
    });

    // 🔹 Increase row height
    requests.push({
      updateDimensionProperties: {
        range: {
          sheetId,
          dimension: "ROWS",
          startIndex: absRow,
          endIndex: absRow + 1,
        },
        properties: { pixelSize: 30 },
        fields: "pixelSize",
      },
    });
    // 🔳 Resize columns (first 10 columns only)
    requests.push({
      updateDimensionProperties: {
        range: {
          sheetId,
          dimension: "COLUMNS",
          startIndex: 0,
          endIndex: 10,
        },
        properties: {
          pixelSize: 140,
        },
        fields: "pixelSize",
      },
    });
    // Set height of all non-header/info rows to 23px and background to light gray
    for (let i = 0; i < rows.length; i++) {
      if (headerRowIndexes.includes(i)) continue;

      const absRow = sheetStartRowIndex + i;

      // Set height
      requests.push({
        updateDimensionProperties: {
          range: {
            sheetId,
            dimension: "ROWS",
            startIndex: absRow,
            endIndex: absRow + 1,
          },
          properties: { pixelSize: 25 },
          fields: "pixelSize",
        },
      });

      // Set light gray background (first 10 columns only)
      requests.push({
        repeatCell: {
          range: {
            sheetId,
            startRowIndex: absRow,
            endRowIndex: absRow + 1,
            startColumnIndex: 0,
            endColumnIndex: 10,
          },
          cell: {
            userEnteredFormat: {
              backgroundColor: { red: 0.9, green: 0.9, blue: 0.9 },
            },
          },
          fields: "userEnteredFormat.backgroundColor",
        },
      });
    }
    // Resize columns (starting from index 2 to 10 to skip 'Type' and 'Symbol')
    requests.push({
      updateDimensionProperties: {
        range: {
          sheetId,
          dimension: "COLUMNS",
          startIndex: 2,
          endIndex: 10,
        },
        properties: { pixelSize: 130 },
        fields: "pixelSize",
      },
    });
  }
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { requests },
  });
}
