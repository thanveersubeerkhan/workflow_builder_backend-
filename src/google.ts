import { google } from 'googleapis';
import dotenv from 'dotenv';

dotenv.config();

export const SERVICE_SCOPES: Record<string, string[]> = {
  identity: [
    'openid',
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/userinfo.email'
  ],
  gmail: [
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.modify'
  ],
  drive: [
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/drive.metadata.readonly'
  ],
  sheets: [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/spreadsheets.readonly'
  ],
  docs: [
    'https://www.googleapis.com/auth/documents',
    'https://www.googleapis.com/auth/documents.readonly'
  ]
};

export function createOAuthClient(callbackPath: string | null = null) {
  const redirectUri = callbackPath 
    ? `${process.env.BASE_URL}${callbackPath}`
    : undefined;

  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri
  );
}
