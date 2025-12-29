
import axios from 'axios';

async function run() {
  try {
    console.log('Triggering flow manually...');
    const res = await axios.post('http://localhost:3000/api/flows/35558a8c-8615-4fe6-8c6a-7f081dd0fed8/run', {
      triggerData: {
        subject: "Manual Test",
        body: "This is a test",
        from: "me@example.com"
      }
    });
    console.log('Response:', res.data);
  } catch (err: any) {
    console.error('Error:', err.message);
    if (err.response) {
        console.error('Data:', err.response.data);
    }
  }
}

run();
