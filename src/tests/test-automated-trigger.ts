import axios from 'axios';

const USER_ID = '647b22af-1f52-4fb7-adbb-91d5c817b74e';

async function setupAutomatedFlow() {
  console.log('🤖 Setting up an Automated Gmail Trigger Flow...');

  const flowDefinition = {
    // The "AUTOMATED" trigger part
    trigger: {
      piece: 'gmail',
      name: 'newEmail',
      params: {} // Checks inbox every 5 mins
    },
    // The steps to run when the trigger fires
    steps: [
      {
        name: 'append_to_log',
        piece: 'sheets',
        action: 'appendRow',
        params: {
          spreadsheetId: '12qKU5fr87VJlID-MyklB3cj7vWITXxNmqUK6NoC5qJM',
          range: 'Sheet1',
          values: [
            'Trigger Fire!',
            '{{steps.trigger.data.id}}',
            'Subject: {{steps.trigger.data.payload.headers.0.value}}' // Example mapping
          ]
        }
      }
    ]
  };

  try {
    const res = await axios.post('http://localhost:3000/api/flows', {
      userId: USER_ID,
      name: 'Gmail to Sheets Auto Logger',
      definition: flowDefinition
    });

    console.log('✅ Automated Flow Created Successfully!');
    console.log('Flow ID:', res.data.flowId);
    console.log('\n--- HOW TO TEST ---');
    console.log('1. Make sure your server is running (npm start)');
    console.log('2. Send an email to yourself.');
    console.log('3. Wait up to 5 minutes.');
    console.log('4. Look at your server terminal - you will see "🎯 Trigger FIRE!"');
    console.log('5. Check your Google Sheet - a new row will appear automatically.');
  } catch (error: any) {
    console.error('❌ Failed to create flow:', error.response?.data || error.message);
  }
}

setupAutomatedFlow();
