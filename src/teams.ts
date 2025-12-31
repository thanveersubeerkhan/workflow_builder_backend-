import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const TENANT_ID = process.env.MICROSOFT_TENANT_ID || 'common'; // Use 'common' for both personal and work accounts
const CLIENT_ID = process.env.MICROSOFT_CLIENT_ID;
const CLIENT_SECRET = process.env.MICROSOFT_CLIENT_SECRET;
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

if (!CLIENT_ID) {
    console.warn("MICROSOFT_CLIENT_ID not set in .env");
}

export const SERVICE_SCOPES: Record<string, string[]> = {
    outlook: ['Mail.Send', 'Mail.Read', 'User.Read', 'offline_access'],
    excel: ['Files.ReadWrite', 'User.Read', 'offline_access'],
    word: ['Files.ReadWrite', 'User.Read', 'offline_access'],
    onedrive: ['Files.ReadWrite', 'User.Read', 'offline_access'],
    microsoft: ['User.Read', 'Mail.Read', 'Mail.Send', 'Files.ReadWrite', 'Chat.Read', 'Chat.ReadBasic', 'offline_access']
};

export function getMicrosoftAuthUrl(userId: string, callbackUrl: string, service: string = 'microsoft') {
    const redirectUri = `${BASE_URL}/auth/callback/microsoft`; // Standardize on one redirect URI
    const scopes = SERVICE_SCOPES[service] || SERVICE_SCOPES.microsoft;
    
    const params = new URLSearchParams({
        client_id: CLIENT_ID!,
        response_type: 'code',
        redirect_uri: redirectUri,
        response_mode: 'query',
        scope: scopes.join(' '),
        prompt: 'select_account',
        state: JSON.stringify({ userId, service, callbackUrl })
    });

    return `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/authorize?${params.toString()}`;
}

export async function revokeMicrosoftToken(accessToken: string) {
    try {
        await axios.post(
            'https://graph.microsoft.com/v1.0/me/revokeSignInSessions',
            {},
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`
                },
                timeout: 10000
            }
        );
        return true;
    } catch (error: any) {
        console.warn(`[Microsoft] Revoke failed:`, error.response?.data || error.message);
        return false;
    }
}

export async function getMicrosoftAccessToken(code: string, service: string = 'microsoft') {
    const redirectUri = `${BASE_URL}/auth/callback/microsoft`; // Standardize on one redirect URI
    
    // NOTE: Scopes are determined by the authorization code, NOT the token exchange
    // The code was generated with specific scopes in getMicrosoftAuthUrl()
    // We should NOT send scopes again during token exchange

    const params = new URLSearchParams();
    params.append('client_id', CLIENT_ID!);
    // REMOVED: params.append('scope', scopes.join(' ')); // This was causing the wrong scopes!
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
                },
                timeout: 30000 // 30s timeout
            }
        );

        const accessToken = response.data.access_token;
        
        let profile;
        try {
            profile = await axios.get('https://graph.microsoft.com/v1.0/me', {
                headers: { Authorization: `Bearer ${accessToken}` },
                timeout: 10000
            });
        } catch (err: any) {
            console.warn(`[Teams] Profile fetch failed:`, err.message);
            profile = { data: { id: 'unknown', displayName: 'Microsoft User' } };
        }

        let avatarUrl = undefined;
        try {
             const photoRes = await axios.get('https://graph.microsoft.com/v1.0/me/photo/$value', {
                headers: { Authorization: `Bearer ${accessToken}` },
                responseType: 'arraybuffer',
                timeout: 5000
            });
            const base64 = Buffer.from(photoRes.data, 'binary').toString('base64');
            avatarUrl = `data:image/jpeg;base64,${base64}`;
        } catch (e) { }

        return {
            ...response.data,
            microsoftUser: {
                ...profile.data,
                avatar_url: avatarUrl
            }
        };

    } catch (error: any) {
        console.error(`Microsoft Token Exchange Error (${service}):`, error.code, error.response?.data || error.message);
        if (error.code === 'ETIMEDOUT') {
            throw new Error(`Connection to Microsoft failed (Timeout). Please check your internet connection or firewall.`);
        }
        throw new Error(`Failed to exchange code for ${service} token: ${error.message}`);
    }
}

export async function refreshMicrosoftAccessToken(refreshToken: string, service: string = 'microsoft') {
    const scopes = SERVICE_SCOPES[service] || SERVICE_SCOPES.microsoft;

    const params = new URLSearchParams();
    params.append('client_id', CLIENT_ID!);
    params.append('scope', scopes.join(' '));
    params.append('refresh_token', refreshToken);
    params.append('grant_type', 'refresh_token');
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

        return response.data;
    } catch (error: any) {
        console.error(`Microsoft Token Refresh Error (${service}):`, error.response?.data || error.message);
        throw new Error(`Failed to refresh ${service} token`);
    }
}
