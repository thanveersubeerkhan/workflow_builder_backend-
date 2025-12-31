
import dotenv from 'dotenv';
import { runAction, runTrigger } from './src/engine.js';
import { getIntegration } from './src/db.js';

dotenv.config();

const userId = '8bebb0d3-c40e-4b48-9732-ff0694b71f9c';
const knownAuthId = 'b78a9c3d-f236-4074-a035-77983690d52e'; // Trying the second 'microsoft' integration

async function main() {
  console.log('=== Testing Outlook Integration ===');
  console.log(`Using Auth ID: ${knownAuthId}`);

  async function safeRun(name: string, fn: () => Promise<any>) {
    console.log(`\n--- STEP: ${name} ---`);
    try {
        await fn();
        console.log(`✅ ${name} SUCCESS`);
    } catch (e: any) {
        console.error(`❌ ${name} FAILED`);
        console.error('Error Message:', e.message);
        if (e.response?.data) {
            console.error('API Error:', JSON.stringify(e.response.data, null, 2));
        }
    }
  }

  // 1. Get Profile
  let userEmail = '';
  await safeRun('getProfile', async () => {
    const res = await runAction({
        userId,
        service: 'outlook',
        actionName: 'getProfile',
        params: { authId: knownAuthId }
    });
    console.log('Result:', JSON.stringify(res, null, 2));
    userEmail = res.mail || res.userPrincipalName;
  });

  if (!userEmail) {
    console.error('❌ Could not determine user email, skipping sendEmail test.');
    return;
  }

  // 2. Send Email (to self)
  const subject = `Workflow Test ${Date.now()}`;
  await safeRun('sendEmail', async () => {
    const res = await runAction({
        userId,
        service: 'outlook',
        actionName: 'sendEmail',
        params: { 
            authId: knownAuthId,
            to: userEmail,
            subject: subject,
            body: '<h1>Hello!</h1><p>This is a test email from the workflow engine.</p>'
        }
    });
    console.log('Result:', JSON.stringify(res, null, 2));
  });

  // 3. List Messages (Verify the sent email is there)
  // Wait a bit for delivery
  console.log('Waiting 5s for email delivery...');
  await new Promise(r => setTimeout(r, 5000));

  await safeRun('listMessages', async () => {
    const res = await runAction({
        userId,
        service: 'outlook',
        actionName: 'listMessages',
        params: { 
            authId: knownAuthId,
            top: 5 
        }
    });
    const found = res.value.find((m: any) => m.subject === subject);
    console.log(found ? `✅ Found sent email: ${found.subject}` : '❌ Email not immediately found in top 5');
  });

  // 4. Test Trigger (newEmail)
  await safeRun('trigger:newEmail', async () => {
    // Initial Run
    const triggerRes1 = await runTrigger({
        userId,
        service: 'outlook',
        triggerName: 'newEmail',
        params: { authId: knownAuthId, folder: 'Inbox' },
        lastProcessedId: null
    });
    console.log('Trigger Run 1 (Init):', triggerRes1?.newLastId);
    
    // We already sent an email, so we might detect it if we set lastProcessedId to something old, 
    // or if we send another one.
    // Let's send another one for the trigger test specifically if needed, 
    // or just rely on the fact that the previous 'sendEmail' is "new" relative to "now" if we hadn't polled yet?
    // Actually, `newEmail` implementation fetches top 5.
    // If we pass `lastProcessedId: null`, it usually returns the latest one.
    
    if (triggerRes1?.data?.subject === subject) {
        console.log('✅ Trigger detected the email we just sent!');
    } else {
        console.log('Trigger returned:', triggerRes1?.data?.subject);
        console.log('(This might be an older email if the new one hasn\'t arrived in the view yet)');
    }
  });

}

main();
