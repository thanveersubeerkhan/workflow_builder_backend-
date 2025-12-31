import axios from 'axios';

const API_URL = 'http://localhost:3000';
const userId = 'c0437184-24cd-4ca4-9516-a03a965bdc35';

async function debug() {
    try {
        const servicesRes = await axios.get(`${API_URL}/api/services?userId=${userId}`);
        const driveService = servicesRes.data.data.find((s: any) => s.id === 'drive');
        const connectionId = driveService?.accounts[0]?.id;

        if (!connectionId) {
            console.error("No Drive connection found");
            return;
        }

        console.log("Using Connection ID:", connectionId);

        console.log("Calling drive.listFolders...");
        const driveRes = await axios.post(`${API_URL}/api/pieces/options`, {
            userId,
            service: 'drive',
            actionName: 'listFolders',
            params: { authId: connectionId }
        });
        console.log("Result Success:", driveRes.data.success);
        if (driveRes.data.success) {
            console.log("Folders found:", driveRes.data.options.length);
        } else {
            console.log("Error:", driveRes.data.error);
        }

    } catch (err: any) {
        if (err.response) {
            console.error("Error Response:", err.response.status, JSON.stringify(err.response.data, null, 2));
        } else {
            console.error("Error Message:", err.message);
        }
    }
}

debug();
