import { runAction } from '../engine.js';

const USER_ID = '647b22af-1f52-4fb7-adbb-91d5c817b74e';

async function runTests() {
  console.log('🚀 Starting Full Suite Test for Pieces...\n');

  // 1. GMAIL TEST
  try {
    console.log('📧 Testing Gmail...');
    const gmailRes = await runAction({
      userId: USER_ID,
      service: 'gmail',
      actionName: 'sendEmail',
      params: {
        to: 'thanveer21cs52@gmail.com',
        subject: 'Full Suite Test: Gmail',
        body: 'This confirms Gmail piece is working correctly.'
      }
    });
    console.log('✅ Gmail: Email sent (ID: ' + gmailRes.id + ')');
  } catch (e: any) { console.error('❌ Gmail Failed:', e.message); }

  // 2. DRIVE TEST
  try {
    console.log('\n📂 Testing Drive...');
    const driveFiles = await runAction({
      userId: USER_ID,
      service: 'drive',
      actionName: 'listFiles',
      params: { pageSize: 5 }
    });
    console.log('✅ Drive: Found ' + driveFiles.length + ' files');
  } catch (e: any) { console.error('❌ Drive Failed:', e.message); }

  // 3. DOCS TEST
  let docId;
  try {
    console.log('\n📝 Testing Docs...');
    const doc = await runAction({
      userId: USER_ID,
      service: 'docs',
      actionName: 'createDocument',
      params: { title: 'Test Document ' + new Date().toLocaleTimeString() }
    });
    docId = doc.documentId;
    console.log('✅ Docs: Document created (ID: ' + docId + ')');

    await runAction({
      userId: USER_ID,
      service: 'docs',
      actionName: 'appendText',
      params: { documentId: docId, text: 'Adding some automated text!' }
    });
    console.log('✅ Docs: Text appended successfully.');
  } catch (e: any) { console.error('❌ Docs Failed:', e.message); }

  // 4. SHEETS TEST
  try {
    console.log('\n📊 Testing Sheets...');
    const sheet = await runAction({
      userId: USER_ID,
      service: 'sheets',
      actionName: 'createSpreadsheet',
      params: { title: 'Test Sheet ' + new Date().toLocaleTimeString() }
    });
    const spreadsheetId = sheet.spreadsheetId;
    console.log('✅ Sheets: Spreadsheet created (ID: ' + spreadsheetId + ')');

    await runAction({
      userId: USER_ID,
      service: 'sheets',
      actionName: 'appendRow',
      params: {
        spreadsheetId,
        range: 'Sheet1!A1',
        values: ['Test Time', new Date().toISOString()]
      }
    });
    console.log('✅ Sheets: Row appended successfully.');
  } catch (e: any) { console.error('❌ Sheets Failed:', e.message); }

  console.log('\n✨ All tests attempted.');
  process.exit(0);
}

runTests();
