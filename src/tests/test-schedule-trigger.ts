import axios from 'axios';

const USER_ID = '647b22af-1f52-4fb7-adbb-91d5c817b74e';

async function setupScheduleFlow() {
  console.log('🤖 Setting up a Schedule Trigger Flow...');

  const flowDefinition = {
    trigger: {
      piece: 'schedule',
      name: 'schedule',
      params: {
        interval: 1 // Fire every 1 minute
      }
    },
    steps: [
      {
        name: 'log_fire',
        piece: 'gmail', // Just an example step
        action: 'listMessages',
        params: {
          maxResults: 1
        }
      }
    ]
  };

  try {
    const res = await axios.post('http://localhost:3000/api/flows', {
      userId: USER_ID,
      name: 'Schedule Trigger Test Flow',
      definition: flowDefinition
    });

    console.log('✅ Schedule Flow Created Successfully!');
    console.log('Flow ID:', res.data.flowId);
    console.log('\n--- HOW TO TEST ---');
    console.log('1. Make sure your server is running (npm start).');
    console.log('2. The trigger-worker will scan every 5 minutes by default.');
    console.log('3. You should see "🎯 Trigger FIRE!" in the server logs.');
  } catch (error: any) {
    console.error('❌ Failed to create flow:', error.response?.data || error.message);
  }
}

setupScheduleFlow();
