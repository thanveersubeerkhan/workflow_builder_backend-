import axios from 'axios';

const BASE_URL = 'http://localhost:3000';
const USER_ID = '647b22af-1f52-4fb7-adbb-91d5c817b74e';
// Use your already connected Spreadsheet ID here
const TEST_SHEET_ID = '12qKU5fr87VJlID-MyklB3cj7vWITXxNmqUK6NoC5qJM';

async function runFullTest() {
  console.log('🏁 Starting Complete System Test Suite...\n');

  // --- Step 1: Health & Connection Check ---
  try {
    console.log('🔍 [1/4] Checking Connections...');
    const conn = await axios.get(`${BASE_URL}/api/connections/${USER_ID}`);
    const services = conn.data.map((c: any) => c.service);
    console.log(`✅ Connected Services: ${services.join(', ')}`);
    if (services.length < 3) {
      console.log('⚠️  Warning: Connect Gmail, Sheets, and Docs for the best test results.');
    }
  } catch (e: any) {
    console.error('❌ Connection Check Failed:', e.response?.data || e.message);
  }

  // --- Step 2: Instant Action Test (API -> Engine) ---
  try {
    console.log('\n⚡ [2/4] Testing Instant Gmail Action...');
    await axios.post(`${BASE_URL}/api/run`, {
      userId: USER_ID,
      service: 'gmail',
      actionName: 'sendEmail',
      params: {
        to: 'thanveer21cs52@gmail.com',
        subject: 'Full Test: Part 2 (Instant Action)',
        body: 'Part 2 of the full system test is successful.'
      }
    });
    console.log('✅ Instant Action: Email sent.');
  } catch (e: any) {
    console.error('❌ Instant Action Failed:', e.response?.data || e.message);
  }

  // --- Step 3: Multi-Step Flow Test (API -> Flow Queue -> Worker) ---
  try {
    console.log('\n⛓️ [3/4] Testing Multi-Step Queued Flow...');
    const flowRes = await axios.post(`${BASE_URL}/api/flows`, {
      userId: USER_ID,
      name: 'Full System Verification Flow',
      definition: {
        steps: [
          {
            name: 'create_doc',
            piece: 'docs',
            action: 'createDocument',
            params: { title: 'Test Doc ' + new Date().toLocaleTimeString() }
          },
          {
            name: 'log_to_sheets',
            piece: 'sheets',
            action: 'appendRow',
            params: {
              spreadsheetId: TEST_SHEET_ID,
              range: 'Sheet1',
              values: ['Queued Flow Created Doc', '{{steps.create_doc.data.documentId}}']
            }
          }
        ]
      }
    });
    console.log(`✅ Flow Job Queued: ${flowRes.data.flowId}`);
    console.log('ℹ️  The worker will now create a Doc and log it to Sheets in the background.');
  } catch (e: any) {
    console.error('❌ Queued Flow Failed:', e.response?.data || e.message);
  }

  // --- Step 4: Automated Trigger Setup (Polling Verification) ---
  try {
    console.log('\n🤖 [4/4] Registering Automated Trigger Flow...');
    await axios.post(`${BASE_URL}/api/flows`, {
      userId: USER_ID,
      name: 'Automated Gmail Logger',
      definition: {
        trigger: {
          piece: 'gmail',
          name: 'newEmail',
          params: {}
        },
        steps: [
          {
            name: 'auto_log',
            piece: 'sheets',
            action: 'appendRow',
            params: {
              spreadsheetId: TEST_SHEET_ID,
              range: 'Sheet1',
              values: ['AUTO TRIGGER FIRE', '{{steps.trigger.data.id}}', '{{steps.trigger.data.snippet}}']
            }
          }
        ]
      }
    });
    console.log('✅ Automated Trigger Registered!');
    console.log('\n--- FINAL VERIFICATION STEPS ---');
    console.log('1. Check your email (Gmail)');
    console.log('2. Check your Drive (new Doc)');
    console.log('3. Check your Google Sheet (new rows)');
    console.log('4. SEND AN EMAIL TO YOURSELF TO TEST THE AUTO-TRIGGER (Wait 5 mins)');
    console.log('\n✨ Single-file test suite completed.');
  } catch (e: any) {
    console.error('❌ Trigger Setup Failed:', e.response?.data || e.message);
  }
}

runFullTest();
