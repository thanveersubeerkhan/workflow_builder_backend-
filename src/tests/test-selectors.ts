
import { getIntegration } from '../db.js';
import { runAction } from '../engine.js';
import { pool } from '../db.js';

async function testSelectors() {
    const userId = 'c0437184-24cd-4ca4-9516-a03a965bdc35'; // Test user ID with full integrations
    console.log(`[Test] 🧪 Testing Selector APIs for user: ${userId}\n`);

    const tests = [
        { service: 'gmail', action: 'listLabels', params: {} },
        { service: 'sheets', action: 'listSpreadsheets', params: {} },
        { service: 'drive', action: 'listFolders', params: {} },
        { service: 'outlook', action: 'listFolders', params: {} },
        { service: 'onedrive', action: 'listFolders', params: {} },
        { service: 'docs', action: 'listDocs', params: {} },
        { service: 'github', action: 'listRepos', params: {} },
    ];

    for (const test of tests) {
        console.log(`[Test] 🚀 Testing ${test.service}.${test.action}...`);
        try {
            const result = await runAction({
                userId,
                service: test.service,
                actionName: test.action,
                params: test.params
            });
            console.log(`[Test] ✅ ${test.service}.${test.action} SUCCEEDED!`);
            // Check if it's Sheets listSpreadsheets to test listSheets dependency
            if (test.service === 'sheets' && test.action === 'listSpreadsheets' && result.files?.length > 0) {
                const spreadsheetId = result.files[0].id;
                console.log(`[Test] 🚀 Testing sheets.listSheets for spreadsheetId: ${spreadsheetId}...`);
                const sheetsResult = await runAction({
                    userId,
                    service: 'sheets',
                    actionName: 'listSheets',
                    params: { spreadsheetId }
                });
                console.log(`[Test] ✅ sheets.listSheets SUCCEEDED! Found ${sheetsResult.sheets?.length || 0} sheets.`);
            }
        } catch (error: any) {
            console.error(`[Test] ❌ ${test.service}.${test.action} FAILED:`, error.message);
            if (error.response?.data) {
                console.error(`[Test] Error Data:`, JSON.stringify(error.response.data, null, 2));
            }
        }
        console.log('--------------------------------------------------\n');
    }

    await pool.end();
}

testSelectors().catch(err => {
    console.error('[Test] Fatal Error:', err);
    process.exit(1);
});
