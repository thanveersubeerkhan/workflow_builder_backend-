import axios from 'axios';

const BASE_URL = 'http://localhost:3000/api';
const USER_ID = '647b22af-1f52-4fb7-adbb-91d5c817b74e';

async function testManagementAPIs() {
  console.log('🧪 Testing Flow Management APIs...');

  try {
    // 1. Create a flow
    const createRes = await axios.post(`${BASE_URL}/flows`, {
      userId: USER_ID,
      name: 'API Test Flow',
      definition: { trigger: { piece: 'schedule', name: 'schedule', params: { intervalMinutes: 1 } }, steps: [] }
    });
    const flowId = createRes.data.flowId;
    console.log(`✅ Flow Created: ${flowId}`);

    // 2. Stop the flow
    const stopRes = await axios.patch(`${BASE_URL}/flows/${flowId}/status`, { status: 'inactive' });
    console.log(`✅ Flow Stopped (status: ${stopRes.data.flow.status})`);

    // 3. Start the flow
    const startRes = await axios.patch(`${BASE_URL}/flows/${flowId}/status`, { status: 'active' });
    console.log(`✅ Flow Started (status: ${startRes.data.flow.status})`);

    // 4. Manually run the flow
    const runRes = await axios.post(`${BASE_URL}/flows/${flowId}/run`);
    console.log(`✅ Flow Manual Run Queued: ${runRes.data.message}`);

    // 5. Delete the flow
    const delRes = await axios.delete(`${BASE_URL}/flows/${flowId}`);
    console.log(`✅ Flow Deleted: ${delRes.data.message}`);

  } catch (error: any) {
    console.error('❌ API Test Failed:', error.response?.data || error.message);
  }
}

testManagementAPIs();
