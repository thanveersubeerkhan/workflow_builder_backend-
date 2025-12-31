import dotenv from 'dotenv';
import { getIntegration } from './src/db.js';
import { runAction, runTrigger } from './src/engine.js';
import { excelPiece } from './src/pieces/excel.js'; // Import piece to access trigger directly if needed, or use runTrigger

dotenv.config();

const userId = '8bebb0d3-c40e-4b48-9732-ff0694b71f9c'; // Test User ID

async function testExcelIntegration() {
  console.log('=== Testing Excel Integration (Expanded) ===\n');

  try {
    // 1. Check for Excel/Microsoft Integration
    console.log('🔍 Checking for integration...');
    let integration = await getIntegration(userId, 'excel');
    let serviceName = 'excel';

    if (!integration) {
        integration = await getIntegration(userId, 'microsoft');
        serviceName = 'microsoft';
    }
    if (!integration) {
        integration = await getIntegration(userId, 'word'); // Fallback
        serviceName = 'word';
    }

    if (!integration) {
      console.error('❌ No valid integration found.');
      return;
    }

    console.log(`✅ Found integration: ${serviceName} (ID: ${integration.id})`);
    
    // 2. Create Workbook
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const workbookName = `Workflow_Test_${timestamp}.xlsx`;
    
    console.log(`\n--- Creating Workbook: ${workbookName} ---`);
    const createRes = await runAction({
        userId,
        service: 'excel', // Using excel service regardless of auth source mapping
        actionName: 'createWorkbook',
        params: {
            authId: integration.id,
            name: workbookName
        }
    });
    console.log('✅ createWorkbook Result:', JSON.stringify(createRes, null, 2));
    
    const fileId = createRes?.id;
    if (!fileId) throw new Error('Failed to create workbook');

    // 3. Create Worksheet
    console.log('\n--- Creating Worksheet: DataSheet ---');
    const sheetRes = await runAction({
        userId,
        service: 'excel',
        actionName: 'createWorksheet',
        params: {
            authId: integration.id,
            fileId: fileId,
            name: 'DataSheet'
        }
    });
    console.log('✅ createWorksheet Result:', JSON.stringify(sheetRes, null, 2));
    
    // 4. Create Table (Required for addRow)
    console.log('\n--- Creating Table: MyTable ---');
    const tableRes = await runAction({
        userId,
        service: 'excel',
        actionName: 'createTable',
        params: {
            authId: integration.id,
            fileId: fileId,
            address: 'DataSheet!A1:C5',
            hasHeaders: true,
            name: 'MyTable'
        }
    });
    console.log('✅ createTable Result:', JSON.stringify(tableRes, null, 2));
    
    // 5. Add Data (addRow)
    console.log('\n--- Adding Data (addRow) ---');
    const addRowRes = await runAction({
        userId,
        service: 'excel',
        actionName: 'addRow',
        params: {
            authId: integration.id,
            fileId: fileId,
            tableName: 'MyTable',
            values: [['John Doe', 'Engineer', 'Active']] // Array of values
        }
    });
    console.log('✅ addRow Result:', JSON.stringify(addRowRes, null, 2));
    
    // 6. Test Trigger (newRow)
    console.log('\n--- Testing Trigger (newRow) ---');
    // First run to establish state
    const triggerRes1 = await runTrigger({
        userId,
        service: 'excel',
        triggerName: 'newRow',
        params: {
            authId: integration.id,
            fileId: fileId,
            tableName: 'MyTable'
        },
        lastProcessedId: {} // Empty initial state
    });
    console.log('Trigger Run 1 (Init):', JSON.stringify(triggerRes1, null, 2));
    
    let lastId = triggerRes1?.newLastId || { lastIndex: 0 }; // If null (no rows found or consumed), 0. Actually addRow added one.
    // If addRow added one row (index 0), triggerRes1 should hopefully catch it if logic allows catchup, 
    // OR if logic is "new since X", and X is undefined, it might return all or latest.
    // Our excel.ts logic: if lastProcessedId is empty, it returns null?
    // Let's check excel.ts logic: "effectiveLastIdx = ... : -1". "if latestIdx <= effectiveLastIdx return null".
    // If we have 1 row (index 0). latestIdx = 0. effectiveLastIdx = -1. 0 > -1. So it should return index 0.
    
    if (triggerRes1) {
        lastId = triggerRes1.newLastId;
    }

    // Add another row
    await runAction({
        userId,
        service: 'excel',
        actionName: 'addRow',
        params: {
            authId: integration.id,
            fileId: fileId,
            tableName: 'MyTable',
            values: [['Jane Smith', 'Designer', 'Pending']]
        }
    });
    console.log('Added 2nd row.');

    // Second run
    const triggerRes2 = await runTrigger({
        userId,
        service: 'excel',
        triggerName: 'newRow',
        params: {
            authId: integration.id,
            fileId: fileId,
            tableName: 'MyTable'
        },
        lastProcessedId: lastId
    });
    console.log('✅ Trigger Run 2 (Detection):', JSON.stringify(triggerRes2, null, 2));

    // 7. Test getRange
    console.log('\n--- Testing getRange (DataSheet!A2:C2) ---');
    const getRangeRes = await runAction({
        userId,
        service: 'excel',
        actionName: 'getRange',
        params: {
            authId: integration.id,
            fileId: fileId,
            sheetName: 'DataSheet',
            range: 'A2:C2' // Should read the 'John Doe' row
        }
    });
    console.log('✅ getRange Result:', JSON.stringify(getRangeRes, null, 2));

    // 8. Test updateRange
    console.log('\n--- Testing updateRange (DataSheet!C2) ---');
    const updateRes = await runAction({
        userId,
        service: 'excel',
        actionName: 'updateRange',
        params: {
            authId: integration.id,
            fileId: fileId,
            sheetName: 'DataSheet',
            range: 'C2',
            values: [['Inactive']]
        }
    });
    console.log('✅ updateRange Result:', JSON.stringify(updateRes, null, 2));

    // 9. Verify Update
    const verifyRes = await runAction({
        userId,
        service: 'excel',
        actionName: 'getRange',
        params: {
            authId: integration.id,
            fileId: fileId,
            sheetName: 'DataSheet',
            range: 'C2'
        }
    });
    console.log('✅ Verification (getRange):', JSON.stringify(verifyRes, null, 2));

  } catch (error: any) {
    console.error('\n❌ ERROR:', error.message);
    if (error.response?.data) {
      console.error('API Response:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testExcelIntegration().then(() => {
    console.log('\n=== Test Complete ===');
    process.exit(0);
}).catch(err => {
    console.error('Fatal Error:', err);
    process.exit(1);
});
