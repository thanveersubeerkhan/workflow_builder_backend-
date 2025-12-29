
import { gmailPiece } from './pieces/gmail.js';
import { getIntegration } from './db.js';
import { createOAuthClient } from './google.js';
import { pool } from './db.js';

async function testGmailTrigger() {
    const userId = '8bebb0d3-c40e-4b48-9732-ff0694b71f9c'; // Retrieved from logs
    console.log(`[Test] 🧪 Testing Gmail Trigger for user: ${userId}`);

    try {
        // 1. Get Integration
        const integration = await getIntegration(userId, 'gmail');
        if (!integration) {
            console.error('[Test] ❌ No Gmail integration found for user!');
            return;
        }
        console.log('[Test] ✅ Found Gmail integration');

        // 2. Prepare Auth
        const client = createOAuthClient();
        client.setCredentials({
            refresh_token: integration.refresh_token,
            access_token: integration.access_token,
            expiry_date: Number(integration.expiry_date)
        });
        
        // Refresh if needed (simplified)
        // For test, assuming token is roughly valid or will fail with helpful error
        
        // 3. Run Trigger
        console.log('[Test] 🚀 Calling gmailPiece.triggers.newEmail...');
        const result = await gmailPiece.triggers!.newEmail({
            auth: client,
            lastProcessedId: undefined, // Simulate first run
            params: { folder: 'INBOX' }
        });

        if (result) {
            console.log('[Test] ✅ Trigger SUCCEEDED! Result:');
            console.log(JSON.stringify(result, null, 2));
        } else {
            console.log('[Test] ⚠️ Trigger returned NULL (no new emails found or logic skipped)');
        }

    } catch (error: any) {
        console.error('[Test] ❌ Trigger FAILED:', error);
    } finally {
        await pool.end();
    }
}

testGmailTrigger();
