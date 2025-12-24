import axios from 'axios';

const USER_ID = '57d64ef3-aeb2-4428-9b04-e153f1febf37';
const SPREADSHEET_ID = '12qKU5fr87VJlID-MyklB3cj7vWITXxNmqUK6NoC5qJM'; // Example ID

async function setupScheduleToSheetsFlow() {
  console.log('🤖 Setting up Schedule to Sheets Logger...');

  const flowDefinition = {
    trigger: {
      piece: 'schedule',
      name: 'schedule',
      params: {
        intervalSeconds: 30 // Fire every 30 seconds
      }
    },
    steps: [
      {
        name: 'log_to_sheets',
        piece: 'sheets',
        action: 'appendRowSmart',
        params: {
          spreadsheetId: SPREADSHEET_ID,
          range: 'AutomatedLogs', // Use a specific name to test creation
          values: [
            'Schedule Fire',
            '{{steps.trigger.data.firedAt}}',
            'Automated Status Log'
          ]
        }
      }
    ]
  };

  try {
    const res = await axios.post('http://localhost:3000/api/flows', {
      userId: USER_ID,
      name: 'Schedule to Sheets Logger',
      definition: flowDefinition
    });

    console.log('✅ Flow Created Successfully!');
    console.log('Flow ID:', res.data.flowId);
    console.log('\n--- HOW TO TEST ---');
    console.log('1. Ensure your server is running (npm run dev).');
    console.log('2. Ensure you have connected Google Sheets for the user.');
    console.log('3. Wait for the trigger-worker to poll.');
    console.log('4. Check your Google Sheet for new rows every minute.');
  } catch (error: any) {
    console.error('❌ Failed to create flow:', error.response?.data || error.message);
  }
}

setupScheduleToSheetsFlow();
