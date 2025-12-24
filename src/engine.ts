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
  const piece = pieces[service];
  if (!piece) throw new Error(`Service ${service} not found`);

  const action = piece.actions[actionName];
  if (!action) throw new Error(`Action ${actionName} not found in ${service}`);

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
      console.log(`[Engine] Auto-refreshing token for ${service} - ${userId}`);
      const { credentials } = await client.refreshAccessToken();
      
      // Save to DB
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

  // 4. Run Action
  return await action({ auth, params });
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
