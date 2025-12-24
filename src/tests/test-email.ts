import { runAction } from '../engine.js';

// The userId provided by the user
const USER_ID = '647b22af-1f52-4fb7-adbb-91d5c817b74e';

async function testGmail() {
  console.log('--- Testing Gmail Send Email Piece ---');
  
  try {
    const result = await runAction({
      userId: USER_ID,
      service: 'gmail',
      actionName: 'sendEmail',
      params: {
        to: 'thanveer21cs52@gmail.com', // Sending to yourself as a test
        subject: '🚀 Workflow Engine Test',
        body: `
          <h1>It works!</h1>
          <p>This email was sent using the <b>Gmail Piece</b> from your custom SaaS backend.</p>
          <hr />
          <p>User ID: ${USER_ID}</p>
          <p>Timestamp: ${new Date().toISOString()}</p>
        `
      }
    });

    console.log('✅ Email sent successfully!');
    console.log('Result:', JSON.stringify(result, null, 2));
  } catch (error: any) {
    console.error('❌ Failed to send email:', error.message);
    console.log('\nTip: Make sure you have connected Gmail for this user via:');
    console.log(`http://localhost:3000/auth/connect/gmail?userId=${USER_ID}`);
  }
}

testGmail();
