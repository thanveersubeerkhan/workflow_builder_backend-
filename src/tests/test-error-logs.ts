import axios from 'axios';

const BASE_URL = 'http://localhost:3000';
const USER_ID = 'c866d8ee-5194-4605-8f8b-30f831604aa6';

async function testErrorLogging() {
  console.log('🧪 Testing Enhanced Error Logging...');

  try {
    // 1. Create a flow that will definitely fail
    // Using an invalid spreadsheet ID "invalid_id_123"
    console.log('\n1. Creating an intentionally broken flow...');
    const uiData = {
      nodes: [
        { id: '1', position: { x: 100, y: 100 }, data: { piece: 'schedule', actionId: 'every_x_minutes', appName: 'Schedule' }, type: 'custom' },
        { id: '2', position: { x: 100, y: 300 }, data: { piece: 'sheets', actionId: 'insert_row', appName: 'Google Sheets', params: { spreadsheetId: 'invalid_id_123', range: 'Sheet1!A1', values: ['Error Test'] } }, type: 'custom' },
        { id: 'end', position: { x: 100, y: 500 }, data: { label: 'End' }, type: 'end' }
      ],
      edges: [
        { id: 'e1-2', source: '1', target: '2' },
        { id: 'e2-end', source: '2', target: 'end' }
      ]
    };

    const createRes = await axios.post(`${BASE_URL}/api/flows`, {
      userId: USER_ID,
      name: 'Intentional Failure Test',
      ui_definition: uiData
    });

    const flowId = createRes.data.flowId;
    console.log('✅ Flow Created:', flowId);

    // 2. Trigger Manual Run
    console.log('\n2. Triggering Manual Run (expecting failure)...');
    await axios.post(`${BASE_URL}/api/flows/${flowId}/run`);
    
    // Wait for worker to fail
    console.log('⏳ Waiting for failure log...');
    await new Promise(r => setTimeout(r, 5000));

    // 3. Fetch Runs and verify Logs
    console.log('\n3. Fetching execution logs...');
    const runsRes = await axios.get(`${BASE_URL}/api/flows/${flowId}/runs`);
    const latestRun = runsRes.data.runs[0];

    console.log('--------------------------------------------------');
    console.log('🚦 Run Status:', latestRun.status);
    console.log('📝 Raw Logs:');
    latestRun.logs.forEach((log: string) => console.log('   ' + log));
    console.log('--------------------------------------------------');

    if (latestRun.status === 'failed' && latestRun.logs.some((l: string) => l.includes('❌ FAILED at Step'))) {
      console.log('\n✅ TEST PASSED: Full error context was captured correctly!');
    } else {
      console.log('\n❌ TEST FAILED: Error context was not detailed enough.');
    }

    // 4. Cleanup
    await axios.delete(`${BASE_URL}/api/flows/${flowId}`);

  } catch (error: any) {
    console.error('❌ Script Failed:', error.response?.data || error.message);
  }
}

testErrorLogging();
