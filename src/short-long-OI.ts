import { google } from "googleapis";
import { JWT } from "google-auth-library";
import { DuneClient } from "@duneanalytics/client-sdk";
import credentials from "./service-account.json";
import path from "path";

// ---- Setup Dune Client ----
const dune = new DuneClient("ws43hEimsYCe8uPdQ7zjS3ITvgoElMe5");
const queryId = 5183571;

interface DuneRow {
  [key: string]: string | number | null;
}

// ---- Fetch Data from Dune ----
// const getShortLongOI = async (): Promise<DuneRow[]> => {
//   const query_result = await dune.getLatestResult({ queryId });
//   return query_result.result?.rows || ([] as DuneRow[]);
// };

const getShortLongOI = async () => {
  const query_result = await dune.getLatestResult({ queryId });
  // console.log(query_result.result?.rows);
  return query_result.result?.rows;
};

// ---- Authorize Google Sheets API ----
const authorizeGoogle = async () => {
  const auth = new google.auth.GoogleAuth({
    keyFile: path.join(__dirname, "credentials.json"), // Path to your service account credentials
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  return auth.getClient();
};

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];
const SPREADSHEET_ID = credentials.google_sheets_id;
const SHEET_NAME = "Sheet3"; 

//  ---- 1 ----
let auth = new JWT({
  email: credentials.client_email,
  key: credentials.private_key,
  scopes: SCOPES,
});


// async function getSheetIdByName(sheetName: string): Promise<number> {
//   const response = await sheets.spreadsheets.get({
//     spreadsheetId: SPREADSHEET_ID,
//   });

//   const sheet = response.data.sheets?.find(
//     (s) => s.properties?.title === sheetName
//   );

//   if (!sheet || sheet.properties?.sheetId === undefined) {
//     throw new Error(`Sheet with name "${sheetName}" not found.`);
//   }

//   return sheet.properties?.sheetId || 0;
// }



// ---- Upload Data to Google Sheet ----
const uploadToGoogleSheet = async (data: DuneRow[]) => {
  const authClient = await authorizeGoogle();
  const sheets = google.sheets({ version: "v4", auth });


  const spreadsheetId = credentials.google_sheets_id;
  const range = `${SHEET_NAME}!A1`;

  if (data.length === 0) {
    console.log("No data returned from Dune.");
    return;
  }

  const headers = Object.keys(data[0]);
  const values = [
    headers,
    ...data.map((row) => headers.map((key) => row[key] ?? "")),
  ];

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: "RAW",
    requestBody: {
      values,
    },
  });

  console.log("✅ Data uploaded to Google Sheet successfully!");
};

// ---- Main ----
(async () => {
  const result = await getShortLongOI();
  await uploadToGoogleSheet(result as DuneRow[]);
})();
