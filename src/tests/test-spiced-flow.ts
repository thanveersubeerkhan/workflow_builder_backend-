import { flowQueue } from '../queues.js';

const USER_ID = '647b22af-1f52-4fb7-adbb-91d5c817b74e';

// Imagine this JSON comes from your React Flow frontend
const workflowDefinition = {
  steps: [
    {
      name: 'get_docs',
      piece: 'docs',
      action: 'createDocument',
      params: { 
        title: 'New Automated Doc - ' + new Date().toLocaleTimeString() 
      }
    },
    {
      name: 'notify_me',
      piece: 'gmail',
      action: 'sendEmail',
      params: {
        to: 'thanveer21cs52@gmail.com',
        subject: 'Workflow Started: {{steps.get_docs.data.title}}',
        body: 'A new document has been created with ID: <b>{{steps.get_docs.data.documentId}}</b>'
      }
    },
    {
      name: 'log_to_sheets',
      piece: 'sheets',
      action: 'appendRow',
      params: {
        spreadsheetId: '12qKU5fr87VJlID-MyklB3cj7vWITXxNmqUK6NoC5qJM',
        range: 'Sheet1',
        values: [
          '{{steps.get_docs.data.title}}', 
          '{{steps.get_docs.data.documentId}}', 
          'Done'
        ]
      }
    }
  ]
};

async function testFullOrchestration() {
  console.log('🌶️ Testing "Spiced Up" Orchestration with Redis & BullMQ...');
  
  try {
    // Add to queue manually for testing
    const job = await flowQueue.add('test-flow-job', {
      flowId: 'manual-test-id',
      userId: USER_ID,
      definition: workflowDefinition
    });

    console.log(`✅ Flow Job added to BullMQ! Job ID: ${job.id}`);
    console.log('Check your email and the worker logs. Data mapping will resolve:');
    console.log(' - {{steps.get_docs.data.title}}');
    console.log(' - {{steps.get_docs.data.documentId}}');
    
    // In a few seconds, the worker.js (started via index.js) will pick this up.
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Failed to queue flow:', error.message);
    process.exit(1);
  }
}

testFullOrchestration();
