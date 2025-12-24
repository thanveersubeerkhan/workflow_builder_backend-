import { runTrigger } from '../engine.js';

const USER_ID = '647b22af-1f52-4fb7-adbb-91d5c817b74e';

async function testGmailTrigger() {
  console.log('🕵️ Testing Gmail "New Email" Trigger...');
  console.log('Logic: Checking for emails newer than what we last saw.\n');

  let lastId: string | null = null;

  // Simulate a few polling cycles
  for (let i = 1; i <= 3; i++) {
    console.log(`[Cycle ${i}] Polling for new emails...`);
    
    try {
      const result = await runTrigger({
        userId: USER_ID,
        service: 'gmail',
        triggerName: 'newEmail',
        lastProcessedId: lastId
      });

      if (result) {
        console.log(`🆕 NEW EMAIL DETECTED!`);
        console.log(`Subject: ${result.data.payload.headers.find((h: any) => h.name === 'Subject')?.value}`);
        console.log(`ID: ${result.newLastId}`);
        lastId = result.newLastId; // Update our "state"
      } else {
        console.log('😴 No new messages found since last check.');
      }
    } catch (e: any) {
      console.error('❌ Trigger Error:', e.message);
    }

    if (i < 3) {
      console.log('Waiting 5 seconds before next poll...\n');
      await new Promise(r => setTimeout(r, 5000));
    }
  }

  console.log('\n✨ Trigger test sequence completed.');
}

testGmailTrigger();
