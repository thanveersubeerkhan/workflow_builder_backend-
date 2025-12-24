import axios from 'axios';

const USER_ID = 'c866d8ee-5194-4605-8f8b-30f831604aa6'; // Your verified test user
const BASE_URL = 'http://localhost:3000';

async function testServicesEndpoint() {
  console.log(`🧪 Testing GET /api/services for User: ${USER_ID}...`);

  try {
    const res = await axios.get(`${BASE_URL}/api/services`, {
      params: { userId: USER_ID }
    });

    console.log('✅ Success! Integrated Services Table:');
    console.table(res.data.data);
  } catch (error: any) {
    console.error('❌ Failed to fetch services:', error.response?.data || error.message);
  }
}

testServicesEndpoint();
