import axios from 'axios';

const BASE_URL = 'https://workflow-builder-backend-seven.vercel.app';
const USER_ID = 'c866d8ee-5194-4605-8f8b-30f831604aa6'; // Shared test user

async function testComplexUISave() {
  console.log('🧪 Testing Complex UI-to-Backend Mapping...');

  const complexUIDefinition = {
    "nodes": [
      {
        "id": "1",
        "position": { "x": 100, "y": 100 },
        "data": {
          "label": "Schedule",
          "subLabel": "Triggers the flow every X minutes.",
          "icon": "schedule",
          "appName": "Schedule",
          "name": "Schedule",
          "description": "Triggers the flow every X minutes.",
          "actionId": "every_x_minutes",
          "actionName": "Every X Minutes",
          "isPlaceholder": false,
          "params": { "intervalMinutes": 5 }
        },
        "type": "custom"
      },
      {
        "id": "end",
        "position": { "x": 100, "y": 700 },
        "data": { "label": "End" },
        "type": "end"
      },
      {
        "id": "d57zu054q",
        "position": { "x": 100, "y": 300 },
        "data": {
          "label": "Gmail",
          "subLabel": "Send an email through a Gmail account.",
          "icon": "gmail",
          "appName": "Gmail",
          "name": "Gmail",
          "description": "Send an email through a Gmail account.",
          "actionId": "send_email",
          "actionName": "Send Email",
          "isPlaceholder": false,
          "params": { "to": "thanveer21cs52@gmail.com", "subject": "Automated Flow", "body": "This is an automated email sent by a flow." }
        },
        "type": "custom"
      },
      {
        "id": "swbf0ecfl",
        "position": { "x": 100, "y": 500 },
        "data": {
          "label": "Google Sheets",
          "subLabel": "Add a new row to a spreadsheet.",
          "icon": "google_sheets",
          "appName": "Google Sheets",
          "name": "Google Sheets",
          "description": "Add a new row to a spreadsheet.",
          "actionId": "insert_row",
          "actionName": "Insert Row",
          "isPlaceholder": false,
          "params": { "spreadsheetId": "123", "sheetName": "Log" }
        },
        "type": "custom"
      }
    ],
    "edges": [
      { "id": "e-1-d57zu054q", "source": "1", "target": "d57zu054q", "type": "custom" },
      { "id": "e-d57zu054q-swbf0ecfl", "source": "d57zu054q", "target": "swbf0ecfl", "type": "custom" },
      { "id": "e-swbf0ecfl-end", "source": "swbf0ecfl", "target": "end", "type": "custom" }
    ]
  };

  try {
    // 1. Create Flow
    console.log('\n1. Sending UI Definition to Backend...');
    const createRes = await axios.post(`${BASE_URL}/api/flows`, {
      userId: USER_ID,
      name: 'Complex UI Sync Test',
      ui_definition: complexUIDefinition
    });

    const flow = createRes.data.flow;
    console.log('✅ Flow Created with ID:', flow.id);

    // 2. Verify Mapping
    console.log('\n2. Verifying Auto-Generated Execution Definition...');
    console.log('📡 Trigger Piece:', flow.definition.trigger.piece);
    console.log('📡 Steps Count:', flow.definition.steps.length);

    flow.definition.steps.forEach((step: any, index: number) => {
      console.log(`   🔸 Step ${index + 1}: ${step.piece} (${step.action})`);
    });

    // Validations
    if (flow.definition.trigger.piece !== 'schedule') throw new Error('Trigger mapping failed');
    if (flow.definition.steps[0].piece !== 'gmail') throw new Error('First step mapping failed');
    if (flow.definition.steps[1].piece !== 'sheets') throw new Error('Second step mapping failed');
    
    console.log('\n✅ Verification Successful: Backend correctly mapped UI to Execution Logic!');

    // 3. Trigger Manual Run
    console.log('\n3. Triggering Manual Run...');
    const runRes = await axios.post(`${BASE_URL}/api/flows/${flow.id}/run`);
    console.log('� Result:', runRes.data.message);
    console.log('\n✨ Flow is now running in the background. Check your email!');

  } catch (error: any) {
    console.error('❌ Test Failed:', error.response?.data || error.message);
    process.exit(1);
  }
}

testComplexUISave();
