import dotenv from 'dotenv';
import { getIntegration } from './src/db.js';
import { runAction } from './src/engine.js';

dotenv.config();

const userId = '8bebb0d3-c40e-4b48-9732-ff0694b71f9c'; // Test User ID

async function testWordIntegration() {
  console.log('=== Testing Word Integration ===\n');

  try {
    // 1. Check for Word (Microsoft) Integration
    // The previous plan mentioned 'word', but the engine might look for 'microsoft' or 'word' depending on how it was saved.
    // Based on engine.ts imports, there is a wordPiece.
    // However, recent chats suggest a move to 'microsoft' as the service name for all things.
    // Let's try 'word' first as per the piece name.
    console.log('🔍 Checking for Word/Microsoft integration...');
    let integration = await getIntegration(userId, 'word');
    let serviceName = 'word';

    if (!integration) {
        console.log('   No "word" integration found. Checking for "microsoft"...');
        integration = await getIntegration(userId, 'microsoft');
        serviceName = 'microsoft';
    }

    if (!integration) {
      console.error('❌ No Word or Microsoft integration found for user');
      console.log('Please connect your Microsoft account in the Integrations page.');
      return;
    }

    console.log(`✅ Found integration: ${serviceName}`);
    console.log(`   ID: ${integration.id}`);
    
    // 2. Test List Folders
    console.log('\n--- Testing listFolders ---');
    const foldersRes = await runAction({
      userId,
      service: 'word', // The piece name is 'word' in engine.ts pieces map
      actionName: 'listFolders',
      params: {
          authId: integration.id
      }
    });
    console.log('✅ listFolders Result:', JSON.stringify(foldersRes, null, 2));

    // 3. Test Create Document
    console.log('\n--- Testing createDocument ---');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `Test Doc ${timestamp}.txt`; // Word piece currently sets Content-Type text/plain for some reason in createDocument
    // wait, looking at word.ts:
    // createDocument sends 'Content-Type': 'text/plain' and uses /content endpoint. 
    // It creates a file. 
    
    const createRes = await runAction({
        userId,
        service: 'word',
        actionName: 'createDocument',
        params: {
            authId: integration.id,
            name: fileName,
            content: 'Hello World! This is a test document created by the Workflow Engine.'
        }
    });
    console.log('✅ createDocument Result:', JSON.stringify(createRes, null, 2));
    
    const fileId = createRes?.id;

    if (fileId) {
        // 4. Test Get Content
        console.log(`\n--- Testing getContent for fileId: ${fileId} ---`);
        const getRes = await runAction({
            userId,
            service: 'word',
            actionName: 'getContent',
            params: {
                authId: integration.id,
                fileId: fileId
            }
        });
        console.log('✅ getContent Result:', JSON.stringify(getRes, null, 2));

        // 5. Test Update Content
        console.log(`\n--- Testing updateContent for fileId: ${fileId} ---`);
        const updateRes = await runAction({
            userId,
            service: 'word',
            actionName: 'updateContent',
            params: {
                authId: integration.id,
                fileId: fileId,
                content: 'Updated content! The test was successful.'
            }
        });
        console.log('✅ updateContent Result:', JSON.stringify(updateRes, null, 2));
        
        // Verify update
        console.log(`\n--- Verifying Update (getContent) ---`);
        const verifyRes = await runAction({
            userId,
            service: 'word',
            actionName: 'getContent',
            params: {
                authId: integration.id,
                fileId: fileId
            }
        });
        console.log('✅ Verification Result:', JSON.stringify(verifyRes, null, 2));

    } else {
        console.error('❌ Failed to get file ID from create response, skipping get/update tests.');
    }

    // 6. Test Get Profile
    console.log('\n--- Testing getProfile ---');
    const profileRes = await runAction({
        userId,
        service: 'word',
        actionName: 'getProfile',
        params: {
            authId: integration.id
        }
    });
    console.log('✅ getProfile Result:', JSON.stringify(profileRes, null, 2));

  } catch (error: any) {
    console.error('\n❌ ERROR:', error.message);
    if (error.response?.data) {
      console.error('API Response:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testWordIntegration().then(() => {
    console.log('\n=== Test Complete ===');
    process.exit(0);
}).catch(err => {
    console.error('Fatal Error:', err);
    process.exit(1);
});
