import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

async function testMe() {
  // Get token from arguments or generic placeholder
  const token = process.argv[2];

  if (!token) {
    console.error('❌ Error: No token provided.');
    console.log('\nUsage: npm run test:me -- YOUR_JWT_TOKEN');
    process.exit(1);
  }

  console.log('🧪 Testing GET /auth/me...');
  
  try {
    const res = await axios.get(`${BASE_URL}/auth/me`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    console.log('✅ Success! User Profile:');
    console.table(res.data);
  } catch (error: any) {
    console.error('❌ Failed retrieval:');
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error('Data:', error.response.data);
    } else {
      console.error('Message:', error.message);
      console.error('Code:', error.code);
    }
  }
}

testMe();
