import { gmailPiece } from './pieces/gmail.js';
import { sheetsPiece } from './pieces/sheets.js';
import { drivePiece } from './pieces/drive.js';
import { docsPiece } from './pieces/docs.js';
import { schedulePiece } from './pieces/schedule.js';
import { loggerPiece } from './pieces/logger.js';
import { githubPiece } from './pieces/github.js';
import { httpPiece } from './pieces/http.js';
import { getIntegration, getIntegrationById, saveIntegration } from './db.js';
import { createOAuthClient } from './google.js';
import { Piece } from './types.js';

const pieces: Record<string, Piece> = {
  gmail: gmailPiece,
  sheets: sheetsPiece,
  drive: drivePiece,
  docs: docsPiece,
  schedule: schedulePiece,
  logger: loggerPiece,
  github: githubPiece,
  http: httpPiece
};

export function getPiecesMetadata() {
  const metadata: Record<string, any> = {};
  for (const [key, piece] of Object.entries(pieces)) {
    metadata[key] = {
      name: piece.name,
      actions: Object.keys(piece.actions),
      triggers: Object.keys(piece.triggers || {}),
      metadata: piece.metadata
    };
  }
  return metadata;
}

interface RunActionArgs {
  userId: string;
  service: string;
  actionName: string;
  params: any;
}

export async function runAction({ userId, service, actionName, params }: RunActionArgs) {
  console.log(`[Engine] Running Action: ${service}.${actionName} for User: ${userId}`);
  
  const piece = pieces[service];
  if (!piece) throw new Error(`Service Piece "${service}" not found in engine pieces registrar.`);

  const action = piece.actions[actionName];
  if (!action) throw new Error(`Action "${actionName}" not found in piece "${service}". Available actions: ${Object.keys(piece.actions).join(', ')}`);

  // 1. Get Integration
  // 1. Get Integration
  let integration;
  if (params && params.authId) {
      integration = await getIntegrationById(params.authId);
  } else {
      integration = await getIntegration(userId, service);
  }
  
  let auth = null;
  if (integration) {
    if (service !== 'http') console.log(`[Engine] Found integration for ${service}. Preparing auth...`);
    
    if (service === 'github') {
      // GitHub uses a simple bearer token, no refresh logic for now as per previous implementation
      auth = integration.access_token;
      // console.log(`[Engine] Using GitHub access token directly`);
    } else {
      // 2. Prepare Google OAuth2 Auth
      const client = createOAuthClient();
      client.setCredentials({
        refresh_token: integration.refresh_token,
        access_token: integration.access_token,
        expiry_date: Number(integration.expiry_date)
      });

      // 3. Refresh token if needed
      const now = Date.now();
      if (integration.expiry_date && (integration.expiry_date < now + 5 * 60 * 1000)) {
        try {
          console.log(`[Engine] Token expired or expiring soon for ${service}. Refreshing...`);
          const { credentials } = await client.refreshAccessToken();
          
          await saveIntegration({
            id: integration.id, // CRITICAL: Update this specific integration
            user_id: userId,
            service,
            refresh_token: integration.refresh_token,
            access_token: credentials.access_token ?? undefined,
            expiry_date: credentials.expiry_date ?? undefined,
            scopes: integration.scopes
          });
          
          client.setCredentials(credentials);
          console.log(`[Engine] Successfully refreshed and saved token for ${service} (ID: ${integration.id})`);
        } catch (refreshError: any) {
          const errorMsg = `Failed to refresh Google token for ${service}: ${refreshError.message}`;
          console.error(`[Engine] ${errorMsg}`, refreshError);
          // throw new Error(errorMsg); // Don't throw, let action fail if auth is bad
        }
      }
      auth = client;
    }
  } else {
    // Only warn if it's NOT the http piece, which doesn't usually require storage-based auth
    if (service !== 'http') {
        console.warn(`[Engine] No integration found for ${service} and user ${userId}. Proceeding without auth (some pieces may fail).`);
    }
  }

  // 4. Run Action with detailed error wrapping
  try {
    return await action({ auth, params });
  } catch (error: any) {
    if (error.response?.data?.error === 'invalid_grant') {
        console.error(`[Engine] ❌ CRITICAL AUTH ERROR: Refresh Token Revoked/Invalid for ${service}. User must reconnect.`);
    }
    console.error(`[Engine] Error executing piece ${service}.${actionName}:`, error.message);
    if (error.response?.data) {
      console.error(`[Engine] Piece API Response Error Data:`, JSON.stringify(error.response.data, null, 2));
    }
    throw error;
  }
}

interface RunTriggerArgs {
  userId: string;
  service: string;
  triggerName: string;
  lastProcessedId?: any;
  params?: any;
  epoch?: number;
}

export async function runTrigger({ userId, service, triggerName, lastProcessedId, params = {}, epoch }: RunTriggerArgs) {
  const piece = pieces[service];
  if (!piece) throw new Error(`Service ${service} not found`);

  const trigger = piece.triggers?.[triggerName];
  if (!trigger) throw new Error(`Trigger ${triggerName} not found in ${service}`);

  // 1. Get Integration (Optional for some pieces)
  let integration;
  if (params && params.authId) {
      integration = await getIntegrationById(params.authId);
  } else {
      integration = await getIntegration(userId, service);
  }
  
  let auth = null;
  if (integration) {
    if (service === 'github') {
        auth = integration.access_token;
    } else {
        // 2. Prepare Auth
        const client = createOAuthClient();
        client.setCredentials({
            refresh_token: integration.refresh_token,
            access_token: integration.access_token,
            expiry_date: Number(integration.expiry_date)
        });

        // 3. Refresh token if needed
        const now = Date.now();
        if (integration.expiry_date && (integration.expiry_date < now + 5 * 60 * 1000)) {
            const { credentials } = await client.refreshAccessToken();
            await saveIntegration({
                id: integration.id, // CRITICAL: Update this specific integration
                user_id: userId,
                service,
                refresh_token: integration.refresh_token,
                access_token: credentials.access_token ?? undefined,
                expiry_date: credentials.expiry_date ?? undefined,
                scopes: integration.scopes
            });
            client.setCredentials(credentials);
        }
        auth = client;
    }
  }

  // 4. Run Trigger
  return await trigger({ auth, lastProcessedId, params, epoch });
}
