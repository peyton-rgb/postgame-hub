// ============================================================
// Google Drive folder creation service
// Creates the standard campaign folder structure under a brand's
// parent folder when a brief is published.
//
// Requires: GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON env variable
// containing the full service account credentials JSON.
// ============================================================

import { google } from 'googleapis';

// The standard subfolder names for every campaign
const CAMPAIGN_SUBFOLDERS = [
  '00_BRIEF',
  '01_RAW',
  '02_BTS',
  '03_ATHLETE_CAPTURED',
  '04_EDITS',
  '05_BRAND_REVIEW',
  '06_FINALS',
  '07_POSTING_PACKAGE',
];

/**
 * Creates the full campaign folder structure in Google Drive.
 *
 * Structure created:
 *   [Brand Parent Folder]/
 *     [campaignFolderName]/
 *       00_BRIEF/
 *       01_RAW/
 *       02_BTS/
 *       03_ATHLETE_CAPTURED/
 *       04_EDITS/
 *       05_BRAND_REVIEW/
 *       06_FINALS/
 *       07_POSTING_PACKAGE/
 *
 * @param brandParentFolderId - The Google Drive folder ID of the brand's parent folder
 * @param campaignFolderName - The name for the campaign folder (e.g., "Adidas_EVO_SL_202605")
 * @returns The Google Drive folder ID of the created campaign parent folder
 */
export async function createDriveFolders(
  brandParentFolderId: string,
  campaignFolderName: string
): Promise<string> {
  // Load the service account credentials from env
  const credentialsJson = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON;
  if (!credentialsJson) {
    throw new Error(
      'GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON is not set. Add it to your .env.local and Vercel env vars.'
    );
  }

  const credentials = JSON.parse(credentialsJson);

  // Authenticate with Google using the service account
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });

  const drive = google.drive({ version: 'v3', auth });

  // Step 1: Create the campaign parent folder
  const campaignFolder = await drive.files.create({
    requestBody: {
      name: campaignFolderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [brandParentFolderId],
    },
    fields: 'id',
  });

  const campaignFolderId = campaignFolder.data.id;
  if (!campaignFolderId) {
    throw new Error('Failed to create campaign folder — no ID returned from Drive API');
  }

  // Step 2: Create each subfolder inside the campaign folder
  // We do these in parallel since they don't depend on each other
  await Promise.all(
    CAMPAIGN_SUBFOLDERS.map((subfolderName) =>
      drive.files.create({
        requestBody: {
          name: subfolderName,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [campaignFolderId],
        },
      })
    )
  );

  return campaignFolderId;
}
