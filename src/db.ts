import pg from 'pg';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { GoogleIntegration, User } from './types.js';

dotenv.config();

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || ''; // Must be 256 bits (64 hex chars)
const IV_LENGTH = 16; 

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return iv.toString('hex') + ':' + authTag + ':' + encrypted;
}

export function decrypt(text: string): string {
  const parts = text.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encryptedText = parts[2];
  const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

export async function getOrCreateUser(email: string, name?: string, pictureUrl?: string): Promise<User> {
  const res = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  
  if (res.rows.length > 0) {
    const user = res.rows[0];
    // Update if name or picture changed
    if ((name && user.name !== name) || (pictureUrl && user.picture_url !== pictureUrl)) {
      const update = await pool.query(
        'UPDATE users SET name = COALESCE($1, name), picture_url = COALESCE($2, picture_url) WHERE email = $3 RETURNING *',
        [name, pictureUrl, email]
      );
      return update.rows[0];
    }
    return user;
  }

  const insert = await pool.query(
    'INSERT INTO users (email, name, picture_url) VALUES ($1, $2, $3) RETURNING *',
    [email, name, pictureUrl]
  );
  return insert.rows[0];
}

export async function saveIntegration(data: GoogleIntegration): Promise<void> {
  const { 
    user_id, 
    userId, 
    service, 
    refresh_token, 
    refreshToken, 
    access_token, 
    accessToken, 
    expiry_date, 
    expiryDate, 
    scopes 
  } = data as any;
  
  const finalUserId = user_id || userId;
  const finalRefreshToken = refresh_token || refreshToken;
  const finalAccessToken = access_token || accessToken;
  const finalExpiryDate = expiry_date || expiryDate;

  if (!finalRefreshToken) {
    throw new Error('Missing refresh_token in saveIntegration');
  }

  const encryptedRefresh = encrypt(finalRefreshToken);

  const query = `
    INSERT INTO google_integrations (user_id, service, refresh_token, access_token, expiry_date, scopes)
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (user_id, service) 
    DO UPDATE SET 
      refresh_token = EXCLUDED.refresh_token,
      access_token = EXCLUDED.access_token,
      expiry_date = EXCLUDED.expiry_date,
      scopes = EXCLUDED.scopes,
      updated_at = now()
  `;

  await pool.query(query, [finalUserId, service, encryptedRefresh, finalAccessToken, finalExpiryDate, scopes]);
}

export async function getIntegration(userId: string, service: string): Promise<GoogleIntegration | null> {
  const res = await pool.query(
    'SELECT * FROM google_integrations WHERE user_id = $1 AND service = $2',
    [userId, service]
  );
  
  if (res.rows.length === 0) return null;

  const integration = res.rows[0];
  return {
    ...integration,
    refresh_token: decrypt(integration.refresh_token)
  };
}

export async function deleteIntegration(userId: string, service: string): Promise<void> {
  await pool.query(
    'DELETE FROM google_integrations WHERE user_id = $1 AND service = $2',
    [userId, service]
  );
}

export async function getAllIntegrations(): Promise<GoogleIntegration[]> {
  const res = await pool.query('SELECT * FROM google_integrations');
  return res.rows.map(row => ({
    ...row,
    refresh_token: decrypt(row.refresh_token)
  }));
}
