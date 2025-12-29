import { Piece } from '../types.js';
import { getUserRepos } from '../github.js';
import axios from 'axios';

const getAccessToken = (auth: any) => {
  return typeof auth === 'string' ? auth : auth?.credentials?.access_token || auth?.access_token;
};

const parseRepo = (repository: string) => {
  if (!repository) return { owner: '', repo: '' };
  const parts = repository.split('/');
  if (parts.length === 2) {
    return { owner: parts[0], repo: parts[1] };
  }
  return { owner: '', repo: repository }; // Fallback
};

export const githubPiece: Piece = {
  name: 'github',
  actions: {
    listRepos: async ({ auth, params }) => {
      console.log('[GitHub.listRepos] Params:', JSON.stringify(params));
      const accessToken = getAccessToken(auth);
      if (!accessToken) throw new Error('GitHub access token is missing');
      return await getUserRepos(accessToken);
    },

    getIssue: async ({ auth, params }) => {
      console.log('[GitHub.getIssue] Params:', JSON.stringify(params));
      const accessToken = getAccessToken(auth);
      if (!accessToken) throw new Error('GitHub access token is missing');

      const { repository, issueNumber } = params;
      if (!repository || !issueNumber) throw new Error('Missing required params: repository, issueNumber');

      const { owner, repo } = parseRepo(repository);
      if (!owner || !repo) throw new Error('Repository must be in "owner/repo" format');
      const url = `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}`;
      console.log(`[GitHub.getIssue] Requesting: ${url}`);
      const res = await axios.get(url, 
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/vnd.github.v3+json',
          }
        }
      );
      return res.data || { success: true };
    },

    createRepository: async ({ auth, params }) => {
      console.log('[GitHub.createRepository] Params:', JSON.stringify(params));
      const accessToken = getAccessToken(auth);
      if (!accessToken) throw new Error('GitHub access token is missing');

      const name = params.name || params.repository;
      const { description, private: isPrivate } = params;
      
      if (!name) {
          console.error('[GitHub.createRepository] FAILED: Missing name');
          throw new Error('Missing required param: name');
      }

      console.log(`[GitHub.createRepository] Creating repo: ${name}`);
      const res = await axios.post('https://api.github.com/user/repos', 
        { name, description, private: isPrivate },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/vnd.github.v3+json',
          }
        }
      );
      return res.data || { success: true };
    },

    deleteRepository: async ({ auth, params }) => {
      console.log('[GitHub.deleteRepository] Params:', JSON.stringify(params));
      const accessToken = getAccessToken(auth);
      if (!accessToken) throw new Error('GitHub access token is missing');

      const { repository } = params;
      if (!repository) throw new Error('Missing required param: repository');

      const { owner, repo } = parseRepo(repository);
      if (!owner || !repo) throw new Error('Repository must be in "owner/repo" format');

      const url = `https://api.github.com/repos/${owner}/${repo}`;
      console.log(`[GitHub.deleteRepository] Requesting: DELETE ${url}`);
      const res = await axios.delete(url, 
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/vnd.github.v3+json',
          }
        }
      );
      return res.data || { success: true };
    },
    
    createIssue: async ({ auth, params }) => {
      console.log('[GitHub.createIssue] Params:', JSON.stringify(params));
      const accessToken = getAccessToken(auth);
      if (!accessToken) throw new Error('GitHub access token is missing');

      const { repository, title, body } = params;
      if (!repository || !title) throw new Error('Missing required params: repository, title');

      const { owner, repo } = parseRepo(repository);
      if (!owner || !repo) throw new Error('Repository must be in "owner/repo" format');

      const url = `https://api.github.com/repos/${owner}/${repo}/issues`;
      console.log(`[GitHub.createIssue] Requesting: POST ${url}`);
      const res = await axios.post(url, 
        { title, body },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/vnd.github.v3+json',
          }
        }
      );
      return res.data || { success: true };
    },

    updateIssue: async ({ auth, params }) => {
      console.log('[GitHub.updateIssue] Params:', JSON.stringify(params));
      const accessToken = getAccessToken(auth);
      if (!accessToken) throw new Error('GitHub access token is missing');

      const { repository, issueNumber, title, body, state } = params;
      if (!repository || !issueNumber) throw new Error('Missing required params: repository, issueNumber');

      const { owner, repo } = parseRepo(repository);
      if (!owner || !repo) throw new Error('Repository must be in "owner/repo" format');
      const url = `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}`;
      console.log(`[GitHub.updateIssue] Requesting: PATCH ${url}`);
      const res = await axios.patch(url, 
        { title, body, state },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/vnd.github.v3+json',
          }
        }
      );
      return res.data || { success: true };
    },

    closeIssue: async ({ auth, params }) => {
      console.log('[GitHub.closeIssue] Params:', JSON.stringify(params));
      const accessToken = getAccessToken(auth);
      if (!accessToken) throw new Error('GitHub access token is missing');

      const { repository, issueNumber } = params;
      const { owner, repo } = parseRepo(repository);
      if (!owner || !repo) throw new Error('Repository must be in "owner/repo" format');
      const url = `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}`;
      console.log(`[GitHub.closeIssue] Requesting: PATCH ${url}`);
      const res = await axios.patch(url, 
        { state: 'closed' },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/vnd.github.v3+json',
          }
        }
      );
      return res.data || { success: true };
    },

    reOpenIssue: async ({ auth, params }) => {
      console.log('[GitHub.reOpenIssue] Params:', JSON.stringify(params));
      const accessToken = getAccessToken(auth);
      if (!accessToken) throw new Error('GitHub access token is missing');

      const { repository, issueNumber } = params;
      const { owner, repo } = parseRepo(repository);
      if (!owner || !repo) throw new Error('Repository must be in "owner/repo" format');

      const url = `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}`;
      console.log(`[GitHub.reOpenIssue] Requesting: PATCH ${url}`);
      const res = await axios.patch(url, 
        { state: 'open' },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/vnd.github.v3+json',
          }
        }
      );
      return res.data || { success: true };
    },



    lockIssue: async ({ auth, params }) => {
      console.log('[GitHub.lockIssue] Params:', JSON.stringify(params));
      const accessToken = getAccessToken(auth);
      if (!accessToken) throw new Error('GitHub access token is missing');

      const { repository, issueNumber } = params;
      const { owner, repo } = parseRepo(repository);
      if (!owner || !repo) throw new Error('Repository must be in "owner/repo" format');
      const url = `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}/lock`;
      console.log(`[GitHub.lockIssue] Requesting: PUT ${url}`);
      const res = await axios.put(url, 
        {},
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/vnd.github.v3+json',
          }
        }
      );
      return res.data || { success: true };
    },

    unlockIssue: async ({ auth, params }) => {
      console.log('[GitHub.unlockIssue] Params:', JSON.stringify(params));
      const accessToken = getAccessToken(auth);
      if (!accessToken) throw new Error('GitHub access token is missing');

      const { repository, issueNumber } = params;
      const { owner, repo } = parseRepo(repository);
      if (!owner || !repo) throw new Error('Repository must be in "owner/repo" format');
      const url = `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}/lock`;
      console.log(`[GitHub.unlockIssue] Requesting: DELETE ${url}`);
      const res = await axios.delete(url, 
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/vnd.github.v3+json',
          }
        }
      );
      return res.data || { success: true };
    },

    getUser: async ({ auth, params }) => {
      console.log('[GitHub.getUser] Requesting: /user');
      const accessToken = getAccessToken(auth);
      if (!accessToken) throw new Error('GitHub access token is missing');

      const res = await axios.get('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github.v3+json',
        }
      });
      return res.data;
    }
  },
  triggers: {}
};
