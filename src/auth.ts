import express from 'express';
import { createOAuthClient, SERVICE_SCOPES } from './google.js';
import { getGitHubAuthUrl, getGitHubAccessToken } from './github.js';
import { saveIntegration, getOrCreateUser } from './db.js';
import { google } from 'googleapis';
import jwt from 'jsonwebtoken';

export const authRouter = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-for-dev';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// Middleware to protect routes
export const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Missing token' });

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    req.user = user;
    next();
  });
};

// --- IDENTITY FLOW (Login) ---

authRouter.get('/login', (req, res) => {
  const client = createOAuthClient('/auth/callback/login');
  const url = client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SERVICE_SCOPES.identity
  });
  res.redirect(url);
});

authRouter.get('/callback/login', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).send('No code provided');
  
  const client = createOAuthClient('/auth/callback/login');

  try {
    const { tokens } = await client.getToken(code as string);
    client.setCredentials(tokens);

    const oauth2 = google.oauth2({ version: 'v2', auth: client });
    const { data } = await oauth2.userinfo.get();

    if (!data.email) throw new Error('No email returned from Google');
    
    // Enhanced User Creation/Update
    const user = await getOrCreateUser(data.email, data.name || undefined, data.picture || undefined);

    // Generate JWT
    const token = jwt.sign(
      { id: user.id, email: user.email }, 
      JWT_SECRET, 
      { expiresIn: '7d' }
    );

    // Redirect to frontend with token
    res.redirect(`${FRONTEND_URL}/?token=${token}`);
  } catch (error) {
    console.error('Login Callback Error:', error);
    res.status(500).send('Login failed');
  }
});

authRouter.get('/me', authenticateToken, async (req: any, res) => {
  try {
    const user = await getOrCreateUser(req.user.email); // Refresh user data from DB
    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      picture: user.picture_url
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

// --- SERVICE CONNECTION FLOW ---
authRouter.get('/connect/:service', (req, res) => {
  const { service } = req.params;
  const { userId, callbackUrl } = req.query;

  if (!SERVICE_SCOPES[service] && service !== 'github') {
    return res.status(400).send('Unsupported service');
  }

  if (!userId) {
    return res.status(400).send('userId is required');
  }

  const client = createOAuthClient(`/auth/callback/${service}`);
  
  const url = service === 'github' 
    ? getGitHubAuthUrl(userId as string, callbackUrl as string)
    : client.generateAuthUrl({
        access_type: 'offline',
        prompt: 'consent',
        scope: SERVICE_SCOPES[service],
        state: JSON.stringify({ userId, service, callbackUrl })
      });

  res.redirect(url);
});

authRouter.get('/callback/:service', async (req: any, res: any) => {
  const { code, state } = req.query;
  const { service } = req.params;

  try {
    if (!state) {
      return res.status(400).send('Missing state parameter. Please start the connection from the /auth/connect route.');
    }
    const { userId, service: stateService, callbackUrl } = JSON.parse(state as string);

    if (service !== stateService) {
      return res.status(400).send('Service mismatch');
    }

    let tokens: any;
    if (service === 'github') {
      console.log('GitHub callback');
      const githubData = await getGitHubAccessToken(code as string);
      console.log('GitHub data:', githubData);

      tokens = {
        access_token: githubData.access_token,
        refresh_token: 'github_no_refresh_token', // GitHub does NOT use refresh tokens for standard OAuth apps
        expiry_date: 1 * 60 * 60 * 1000,
        scope: githubData.githubUser?.url,
      };
    }else {
      const client = createOAuthClient(`/auth/callback/${service}`);
      const { tokens: googleTokens } = await client.getToken(code as string);
      tokens = googleTokens;
    }

    if (!tokens.refresh_token && service !== 'github') {
        // If no refresh token, prompt again or delete integration?
        // Usually happens if already connected.
    }

    await saveIntegration({
      user_id: userId,
      service,
      refresh_token: tokens.refresh_token!,
      access_token: tokens.access_token ?? undefined,
      expiry_date: tokens.expiry_date ?? undefined,
      scopes: tokens.scope ?? undefined
    });

    // Redirect to specified path (appended to frontend URL) or default integration page
    const finalRedirect = callbackUrl 
      ? (`${callbackUrl}`.startsWith('http') ? callbackUrl : `${FRONTEND_URL}${callbackUrl}`)
      : `${FRONTEND_URL}/integration`;
    res.redirect(finalRedirect);
  } catch (error: any) {
    console.error('OAuth Callback Error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Authentication failed', 
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});
