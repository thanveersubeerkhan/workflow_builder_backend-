import { gmailPiece } from './pieces/gmail.js';
import { sheetsPiece } from './pieces/sheets.js';
import { drivePiece } from './pieces/drive.js';
import { docsPiece } from './pieces/docs.js';
import { schedulePiece } from './pieces/schedule.js';
import { getIntegration, saveIntegration } from './db.js';
import { createOAuthClient } from './google.js';
import { Piece } from './types.js';

const pieces: Record<string, Piece> = {
  gmail: gmailPiece,
  sheets: sheetsPiece,
  drive: drivePiece,
  docs: docsPiece,
  schedule: schedulePiece
};

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
  const integration = await getIntegration(userId, service);
  
  let auth = null;
  if (integration) {
    console.log(`[Engine] Found integration for ${service}. Preparing OAuth client...`);
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
      try {
        console.log(`[Engine] Token expired or expiring soon for ${service}. Refreshing...`);
        const { credentials } = await client.refreshAccessToken();
        
        await saveIntegration({
          user_id: userId,
          service,
          refresh_token: integration.refresh_token,
          access_token: credentials.access_token ?? undefined,
          expiry_date: credentials.expiry_date ?? undefined,
          scopes: integration.scopes
        });
        
        client.setCredentials(credentials);
        console.log(`[Engine] Successfully refreshed and saved token for ${service}`);
      } catch (refreshError: any) {
        const errorMsg = `Failed to refresh Google token for ${service}: ${refreshError.message}`;
        console.error(`[Engine] ${errorMsg}`, refreshError);
        throw new Error(errorMsg);
      }
    }
    auth = client;
  } else {
    console.warn(`[Engine] No integration found for ${service} and user ${userId}. Proceeding without auth (some pieces may fail).`);
  }

  // 4. Run Action with detailed error wrapping
  try {
    return await action({ auth, params });
  } catch (error: any) {
    console.error(`[Engine] Error executing piece ${service}.${actionName}:`, error.message);
    if (error.response?.data) {
      console.error(`[Engine] Piece API Response Error Data:`, JSON.stringify(error.response.data));
    }
    throw error;
  }
}

interface RunTriggerArgs {
  userId: string;
  service: string;
  triggerName: string;
  lastProcessedId?: string | null;
  params?: any;
}

export async function runTrigger({ userId, service, triggerName, lastProcessedId, params = {} }: RunTriggerArgs) {
  const piece = pieces[service];
  if (!piece) throw new Error(`Service ${service} not found`);

  const trigger = piece.triggers?.[triggerName];
  if (!trigger) throw new Error(`Trigger ${triggerName} not found in ${service}`);

  // 1. Get Integration (Optional for some pieces)
  const integration = await getIntegration(userId, service);
  
  let auth = null;
  if (integration) {
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

  // 4. Run Trigger
  return await trigger({ auth, lastProcessedId, params });
}
