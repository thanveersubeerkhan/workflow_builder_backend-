import { pool } from './db.js';

async function setup() {
  console.log('--- Initializing Database Schema ---');
  
  const schema = `
    CREATE EXTENSION IF NOT EXISTS "pgcrypto";

    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      picture_url TEXT,
      created_at TIMESTAMP DEFAULT now()
    );

    ALTER TABLE users ADD COLUMN IF NOT EXISTS name TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS picture_url TEXT;

    CREATE TABLE IF NOT EXISTS google_integrations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      service TEXT NOT NULL,
      refresh_token TEXT NOT NULL,
      access_token TEXT,
      expiry_date BIGINT,
      scopes TEXT,
      created_at TIMESTAMP DEFAULT now(),
      UNIQUE (user_id, service)
    );

    CREATE TABLE IF NOT EXISTS flows (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      definition JSONB NOT NULL,
      last_trigger_data TEXT, -- Stores last seen Email ID or Row ID
      created_at TIMESTAMP DEFAULT now(),
      updated_at TIMESTAMP DEFAULT now()
    );

    ALTER TABLE flows ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

    CREATE TABLE IF NOT EXISTS flow_runs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      flow_id UUID REFERENCES flows(id) ON DELETE CASCADE,
      status TEXT DEFAULT 'pending',
      logs JSONB DEFAULT '[]',
      result JSONB,
      created_at TIMESTAMP DEFAULT now()
    );
  `;

  try {
    await pool.query(schema);
    console.log('✅ Database tables created successfully!');
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Failed to initialize database:', error.message);
    process.exit(1);
  }
}

setup();
