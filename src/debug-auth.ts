import { createOAuthClient, SERVICE_SCOPES } from './google.js';

function debugSheetsAuth() {
    const service = 'sheets';
    const client = createOAuthClient('/auth/callback/sheets');
    
    const scopes = [
        ...(SERVICE_SCOPES[service] || []),
        ...SERVICE_SCOPES.identity
    ];
    
    console.log('--- Debugging Sheets Auth ---');
    console.log('Target Service:', service);
    console.log('Defined Scopes in SERVICE_SCOPES:', JSON.stringify(SERVICE_SCOPES[service], null, 2));
    console.log('Final Scopes Array:', JSON.stringify(scopes, null, 2));
    
    const url = client.generateAuthUrl({
        access_type: 'offline',
        prompt: 'select_account consent',
        scope: scopes
    });
    
    console.log('\nGenerated Auth URL:');
    console.log(url);
    
    const urlObj = new URL(url);
    console.log('\nParsed Scopes from URL:');
    console.log(decodeURIComponent(urlObj.searchParams.get('scope') || '').split(' '));
}

debugSheetsAuth();
