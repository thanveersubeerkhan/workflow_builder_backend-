import axios from 'axios';

const API_URL = 'http://localhost:3000';
const userId = 'c0437184-24cd-4ca4-9516-a03a965bdc35';

async function debug() {
    try {
        const servicesRes = await axios.get(`${API_URL}/api/services?userId=${userId}`);
        const docsService = servicesRes.data.data.find((s: any) => s.id === 'docs');
        const connectionId = docsService?.accounts[0]?.id;

        if (!connectionId) {
            console.error("No Docs connection found");
            return;
        }

        console.log("Using Connection ID:", connectionId);

        // Test Drive Service with Docs Connection
        console.log("Testing drive.listFolders with Docs connection...");
        try {
            const driveRes = await axios.post(`${API_URL}/api/pieces/options`, {
                userId,
                service: 'drive',
                actionName: 'listFolders',
                params: { authId: connectionId }
            });
            console.log("Drive Result:", JSON.stringify(driveRes.data, null, 2));
        } catch (e: any) {
            console.error("Drive Call Failed:", e.response?.status, e.response?.data);
        }

        // Test Docs Service with Docs Connection
        console.log("Testing docs.listDocs with Docs connection...");
        try {
            const docsRes = await axios.post(`${API_URL}/api/pieces/options`, {
                userId,
                service: 'docs',
                actionName: 'listDocs',
                params: { authId: connectionId }
            });
            console.log("Docs Result:", JSON.stringify(docsRes.data, null, 2));
        } catch (e: any) {
             console.error("Docs Call Failed:", e.response?.status, e.response?.data);
        }

    } catch (err: any) {
        console.error("Error:", err.message);
    }
}

debug();
