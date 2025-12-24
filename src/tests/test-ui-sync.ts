import axios from 'axios';

const BASE_URL = 'http://localhost:3000';
const USER_ID = 'c866d8ee-5194-4605-8f8b-30f831604aa6';

async function testUISync() {
  console.log('🧪 Testing UI-Sync Flow CRUD...');

  try {
    // 1. Create with UI Definition
    console.log('\n1. Creating Flow with UI Data...');
    const uiData = {
      nodes: [
        { id: '1', position: { x: 100, y: 100 }, data: { label: 'Trigger' }, type: 'custom' },
        { id: 'end', position: { x: 100, y: 300 }, data: { label: 'End' }, type: 'end' }
      ],
      edges: [{ id: 'e1-end', source: '1', target: 'end', type: 'custom' }]
    };

    const createRes = await axios.post(`${BASE_URL}/api/flows`, {
      userId: USER_ID,
      name: 'React Flow Auto-Map Test',
      ui_definition: uiData
    });
    const flowId = createRes.data.flowId;
    console.log('✅ Created:', flowId);
    console.log('🧩 Backend mapped definition:', JSON.stringify(createRes.data.flow.definition).substring(0, 100) + '...');
    
    if (createRes.data.flow.definition.trigger?.piece === 'schedule') {
      console.log('🎯 Mapper correctly identified the Schedule trigger!');
    }

    // 2. Fetch and check UI Data
    console.log('\n2. Verifying UI Data Persistence...');
    const getRes = await axios.get(`${BASE_URL}/api/flows/${flowId}`);
    console.log('📦 UI Nodes stored:', getRes.data.flow.ui_definition.nodes.length);
    console.log('🚦 Boolean Status (is_active):', getRes.data.flow.is_active);

    // 3. Toggle Status (Boolean)
    console.log('\n3. Toggling Status to Inactive...');
    const patchRes = await axios.patch(`${BASE_URL}/api/flows/${flowId}`, {
      is_active: false
    });
    console.log('🚦 New Status:', patchRes.data.flow.is_active);

    // 4. Update UI Data (Move a node)
    console.log('\n4. Moving a node in UI definition...');
    uiData.nodes[0].position.x = 500;
    const patchUIRes = await axios.patch(`${BASE_URL}/api/flows/${flowId}`, {
      ui_definition: uiData
    });
    console.log('✅ New X position:', patchUIRes.data.flow.ui_definition.nodes[0].position.x);

    // 5. Cleanup
    await axios.delete(`${BASE_URL}/api/flows/${flowId}`);
    console.log('\x1b[32m%s\x1b[0m', '\n✅ UI-Sync Lifecycle Test Passed!');

  } catch (error: any) {
    console.error('❌ Test Failed:', error.response?.data || error.message);
  }
}

testUISync();
