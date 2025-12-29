import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

export const GITHUB_SCOPES = 'read:user user:email repo delete_repo';

export function getGitHubAuthUrl(userId: string, callbackUrl?: string) {
  const baseUrl = 'https://github.com/login/oauth/authorize';
  const redirectUri = `${process.env.BASE_URL}/auth/callback/github`;

  const state = JSON.stringify({
    userId,
    service: 'github',
    callbackUrl,
  });

  const params = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID!,
    redirect_uri: redirectUri,
    scope: GITHUB_SCOPES,
    state,
  });

  return `${baseUrl}?${params.toString()}`;
}


export async function getGitHubAccessToken(code: string) {
  const tokenRes = await axios.post(
    'https://github.com/login/oauth/access_token',
    {
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: `${process.env.BASE_URL}/auth/callback/github`,
    },
    { headers: { Accept: 'application/json' } }
  );

  const tokenData = tokenRes.data;

  if (!tokenData.access_token) {
    throw new Error('GitHub did not return access token');
  }

  // 🔍 Validate token by fetching user
  const userRes = await axios.get('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
    },
  });

  return {
    ...tokenData,
    githubUser: userRes.data,
  };
}

export async function refreshGitHubAccessToken(refreshToken: string) {
    console.log('[GitHub] Refreshing access token...');
    const tokenRes = await axios.post(
      'https://github.com/login/oauth/access_token',
      {
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        grant_type: 'refresh_token',
        refresh_token: refreshToken
      },
      { headers: { Accept: 'application/json' } }
    );
  
    const tokenData = tokenRes.data;
  
    if (tokenData.error) {
        throw new Error(`GitHub Refresh Failed: ${tokenData.error_description || tokenData.error}`);
    }
  
    if (!tokenData.access_token) {
      throw new Error('GitHub did not return access token during refresh');
    }
  
    // Calculate new expiry (GitHub usually returns expires_in seconds)
    // If not provided, we might assume 8 hours (standard) or keep existing? 
    // Usually expires_in is 28800 (8 hours) for web-app flow.
    let expiry_date: number | undefined;
    if (tokenData.expires_in) {
        expiry_date = Date.now() + (tokenData.expires_in * 1000);
    }

    return {
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token, // GitHub might rotate it!
        refreshTokenExpiresIn: tokenData.refresh_token_expires_in,
        expiry_date
    };
  }

export async function getUserRepos(accessToken: string) {
  const response = await axios.get('https://api.github.com/user/repos', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
    params: {
        sort: 'updated',
        per_page: 100
    }
  });

  return response.data;
}

export async function getRepoIssues(accessToken: string, owner: string, repo: string) {
  const response = await axios.get(`https://api.github.com/repos/${owner}/${repo}/issues`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
    params: {
        state: 'all',
        sort: 'updated',
        per_page: 100
    }
  });

  return response.data;
}

export async function getIssueDetails(accessToken: string, owner: string, repo: string, issueNumber: number) {
  const response = await axios.get(`https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    }
  });

  return response.data;
}

