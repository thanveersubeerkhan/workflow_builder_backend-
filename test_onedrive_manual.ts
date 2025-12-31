
import dotenv from 'dotenv';
import { runAction, runTrigger } from './src/engine.js';
import { getIntegration } from './src/db.js';

dotenv.config();

const userId = '8bebb0d3-c40e-4b48-9732-ff0694b71f9c';
const knownAuthId = '54d1e1fa-a249-4495-9ec1-afdaa5f711ef'; 

async function main() {
  console.log('=== Testing OneDrive Integration (Debug Mode) ===');
  console.log(`Using Auth ID: ${knownAuthId}`);

  // Helper to run safely
  async function safeRun(name: string, fn: () => Promise<any>) {
    console.log(`\n--- STEP: ${name} ---`);
    try {
        await fn();
        console.log(`✅ ${name} SUCCESS`);
    } catch (e: any) {
        console.error(`❌ ${name} FAILED`);
        console.error('Error Message:', e.message);
        if (e.response?.data) {
            console.error('API Error:', JSON.stringify(e.response.data, null, 2));
        } else {
            console.error('Full Error:', e);
        }
    }
  }

  await safeRun('getProfile', async () => {
    const res = await runAction({
        userId,
        service: 'onedrive',
        actionName: 'getProfile',
        params: { authId: knownAuthId }
    });
    console.log('Result:', JSON.stringify(res, null, 2));
  });

  await safeRun('listFolders', async () => {
    const res = await runAction({
        userId,
        service: 'onedrive',
        actionName: 'listFolders',
        params: { authId: knownAuthId }
    });
    console.log(`Result: Found ${res.folders?.length || 0} folders`);
  });

  let fileId: string | undefined;
  const fileName = `OneDrive_Test_Debug_${Date.now()}.txt`;

  await safeRun('uploadFile', async () => {
    const res = await runAction({
        userId,
        service: 'onedrive',
        actionName: 'uploadFile',
        params: { 
            authId: knownAuthId,
            fileName: fileName,
            content: 'Debug content'
        }
    });
    console.log('Result:', JSON.stringify(res, null, 2));
    fileId = res.id;
  });

  if (fileId) {
    await safeRun('listFiles', async () => {
        const res = await runAction({
            userId,
            service: 'onedrive',
            actionName: 'listFiles',
            params: { authId: knownAuthId }
        });
        const found = res.files.find((f: any) => f.id === fileId);
        console.log(found ? `Found uploaded file: ${found.name}` : 'File not found in list');
    });

    await safeRun('downloadFile', async () => {
        const res = await runAction({
            userId,
            service: 'onedrive',
            actionName: 'downloadFile',
            params: { 
                authId: knownAuthId,
                fileId: fileId! 
            }
        });
        const decoded = Buffer.from(res.content, 'base64').toString('utf-8');
        console.log(`Download content matches? ${decoded === 'Debug content'}`);
    });

    await safeRun('deleteFile', async () => {
        await runAction({
            userId,
            service: 'onedrive',
            actionName: 'deleteFile',
            params: { authId: knownAuthId, fileId: fileId! } // ! assertion safe due to if check
        });
    });
  }
}

main();
