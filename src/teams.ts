import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const TENANT_ID = 'common'; // Use 'common' for multi-tenant applications
const CLIENT_ID = process.env.MICROSOFT_CLIENT_ID;
const CLIENT_SECRET = process.env.MICROSOFT_CLIENT_SECRET;
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

if (!CLIENT_ID) {
    console.warn("MICROSOFT_CLIENT_ID not set in .env");
}

export const MICROSOFT_SCOPES = [
    'User.Read',
    'User.ReadBasic.All', 
    'offline_access' // Crucial for refresh tokens
];

export function getMicrosoftAuthUrl(userId: string, callbackUrl: string) {
    const redirectUri = `${BASE_URL}/auth/callback/microsoft`;
    
    // Using v2.0 endpoint for Microsoft Graph
    const params = new URLSearchParams({
        client_id: CLIENT_ID!,
        response_type: 'code',
        redirect_uri: redirectUri,
        response_mode: 'query',
        scope: MICROSOFT_SCOPES.join(' '),
        prompt: 'select_account',
        state: JSON.stringify({ userId, service: 'microsoft', callbackUrl })
    });

    return `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/authorize?${params.toString()}`;
}

export async function getMicrosoftAccessToken(code: string) {
    const redirectUri = `${BASE_URL}/auth/callback/microsoft`;

    const params = new URLSearchParams();
    params.append('client_id', CLIENT_ID!);
    params.append('scope', MICROSOFT_SCOPES.join(' '));
    params.append('code', code);
    params.append('redirect_uri', redirectUri);
    params.append('grant_type', 'authorization_code');
    params.append('client_secret', CLIENT_SECRET!);

    try {
        const response = await axios.post(
            `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`,
            params,
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        );

        // Fetch User Profile immediately to return standardized data
        const accessToken = response.data.access_token;
        const profile = await axios.get('https://graph.microsoft.com/v1.0/me', {
            headers: { Authorization: `Bearer ${accessToken}` }
        });

        // Try to get photo (might fail if no photo set)
        let avatarUrl = undefined;
        try {
             const photoRes = await axios.get('https://graph.microsoft.com/v1.0/me/photo/$value', {
                headers: { Authorization: `Bearer ${accessToken}` },
                responseType: 'arraybuffer'
            });
            const base64 = Buffer.from(photoRes.data, 'binary').toString('base64');
            avatarUrl = `data:image/jpeg;base64,${base64}`;
        } catch (e) {
            // Ignore photo failure
        }

        return {
            ...response.data,
            microsoftUser: {
                ...profile.data,
                avatar_url: avatarUrl
            }
        };

    } catch (error: any) {
        console.error("Microsoft Token Exchange Error:", error.response?.data || error.message);
        throw new Error('Failed to exchange code for Microsoft token');
    }
}
