
import { pool } from './src/db';
import { google } from 'googleapis';
import { createOAuthClient } from './src/google';
import dotenv from 'dotenv';
import { getIntegration, saveIntegration } from './src/db';

dotenv.config();

async function testGmail() {
  /* CHECK SINGLE USER */
  const userIds = ['8bebb0d3-c40e-4b48-9732-ff0694b71f9c'];

  for (const userId of userIds) {
      console.log(`\n---------------------------------------------------`);
      console.log(`Testing for user: ${userId}`);

      const service = 'gmail';
      const integration = await getIntegration(userId, service);
      if (!integration) {
          console.log('No integration found for this user.');
          continue;
      }

  const client = createOAuthClient();
  client.setCredentials({
    refresh_token: integration.refresh_token,
    access_token: integration.access_token,
    expiry_date: Number(integration.expiry_date)
  });

  // Refresh token
  try {
      const { credentials } = await client.refreshAccessToken();
      client.setCredentials(credentials);
      console.log('Token refreshed.');
  } catch (e) {
      console.log('Token refresh failed:', e.message);
  }

  const gmail = google.gmail({ version: 'v1', auth: client });
  
  // CHECK AUTHENTICATED USER
  const profile = await gmail.users.getProfile({ userId: 'me' });
  console.log(`\n!!! CONNECTED ACCOUNT IS: ${profile.data.emailAddress} !!!\n`);

  const query = 'testprojects0987'; // BROAD SEARCH

  console.log(`Querying: "${query}"`);

  const res = await gmail.users.messages.list({
    userId: 'me',
    maxResults: 5,
    q: query,
  });

  console.log(`Found ${res.data.messages?.length || 0} messages`);
  
  if (res.data.messages) {
      for (const m of res.data.messages) {
          const d = await gmail.users.messages.get({ userId: 'me', id: m.id! });
          const h = d.data.payload?.headers || [];
          const sub = h.find(x => x.name?.toLowerCase() === 'subject')?.value;
             console.log(` - [${m.id}] ${sub} | Labels: ${JSON.stringify(d.data.labelIds)}`);
      }
  }

  // Dump all inbox to compare
  console.log('\n--- Dumping explicit INBOX scan ---');
  const res2 = await gmail.users.messages.list({
      userId: 'me',
       maxResults: 10,
       q: 'label:INBOX'
  });
  if (res2.data.messages) {
       for (const m of res2.data.messages) {
          const d = await gmail.users.messages.get({ userId: 'me', id: m.id! });
          const h = d.data.payload?.headers || [];
          const sub = h.find(x => x.name?.toLowerCase() === 'subject')?.value;
          const from = h.find(x => x.name?.toLowerCase() === 'from')?.value;
          console.log(` - [${m.id}] From: ${from} | Subject: ${sub}`);
       }
  }

  } // End of loop

  await pool.end();
}

testGmail();
