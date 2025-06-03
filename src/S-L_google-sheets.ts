import { google } from "googleapis";
import { DuneClient } from "@duneanalytics/client-sdk";
import credentials from "./service-account.json";
import { JWT } from "google-auth-library";

// ---- Setup Dune Client ----
const dune = new DuneClient("ws43hEimsYCe8uPdQ7zjS3ITvgoElMe5");
const queryId = 5183571;

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];
const SPREADSHEET_ID = credentials.google_sheets_id;
const SHEET_NAME = "Sheet1";

const auth = new JWT({
  email: credentials.client_email,
  key: credentials.private_key,
  scopes: SCOPES,
});

const sheets = google.sheets({ version: "v4", auth });

interface DuneRow {
  [key: string]: string | number | null;
}
// ---- Fetch Data from Dune ----
const getShortLongOI = async (): Promise<DuneRow[]> => {
  const query_result = await dune.getLatestResult({ queryId });
  const rows = query_result.result?.rows || [];

  const convertedRows: DuneRow[] = rows.map((row) => {
    const convertedRow: DuneRow = {};
    for (const key in row) {
      const value = row[key];
      convertedRow[key] =
        typeof value === "string" || typeof value === "number" || value === null
          ? value
          : String(value);
    }
    return convertedRow;
  });

  return convertedRows;
};
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

// ---- Upload Data to Google Sheet ----
const uploadToGoogleSheet = async (data: DuneRow[]) => {
  const spreadsheetId = credentials.google_sheets_id;
  const sheetName = "Sheet1";
  if (data.length === 0) {
    console.log("No data returned from Dune.");
    return;
  }
  // Prepare headers: remove "token", move "symbol" to front
  const originalHeaders = Object.keys(data[0]).filter((key) => key !== "token");
  const headers = [
    "symbol",
    ...originalHeaders.filter((key) => key !== "symbol"),
  ];

  const values = [
    headers,
    ...data.map((row) => headers.map((key) => row[key] ?? "")),
  ];

  // --- Append Data ---
  const appendResponse = await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${sheetName}!A1`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values,
    },
  });

  const startRowIndex =
    parseInt(
      appendResponse.data.updates?.updatedRange?.match(/\d+/)?.[0] || "0"
    ) - 1;
  const sheetId = await getSheetIdByName(SHEET_NAME);

  // --- Format Header Row and Row Height ---
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          repeatCell: {
            range: {
              sheetId, // Assuming Sheet1 is the first sheet
              startRowIndex,
              endRowIndex: startRowIndex + 1,
            },
            cell: {
              userEnteredFormat: {
                backgroundColor: {
                  red: 0.7,
                  green: 0.7,
                  blue: 0.7,
                },
                horizontalAlignment: "CENTER",
                textFormat: {
                  bold: true,
                },
              },
            },
            fields:
              "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)",
          },
        },
        {
          updateDimensionProperties: {
            range: {
              sheetId: 0,
              dimension: "ROWS",
              startIndex: startRowIndex,
              endIndex: startRowIndex + values.length,
            },
            properties: {
              pixelSize: 50, // 1.5x standard row height (default ~20px)
            },
            fields: "pixelSize",
          },
        },
      ],
    },
  });

  console.log("✅ Data appended and formatted in Google Sheet successfully!");
};

// ---- Main ----
(async () => {
  const result = await getShortLongOI();
  await uploadToGoogleSheet(result);
})();
