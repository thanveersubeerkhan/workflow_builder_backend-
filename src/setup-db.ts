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
      updated_at TIMESTAMP DEFAULT now(),
      UNIQUE (user_id, service)
    );

    ALTER TABLE google_integrations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT now();

    CREATE TABLE IF NOT EXISTS flows (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      definition JSONB NOT NULL,
      ui_definition JSONB DEFAULT '{"nodes": [], "edges": []}',
      last_trigger_data TEXT,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT now(),
      updated_at TIMESTAMP DEFAULT now()
    );

    ALTER TABLE flows ADD COLUMN IF NOT EXISTS ui_definition JSONB DEFAULT '{"nodes": [], "edges": []}';
    ALTER TABLE flows ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

    -- Migration from status to is_active if status exists
    DO $$ 
    BEGIN 
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='flows' AND column_name='status') THEN
        UPDATE flows SET is_active = (status = 'active');
        ALTER TABLE flows DROP COLUMN status;
      END IF;
    END $$;

    CREATE TABLE IF NOT EXISTS flow_runs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      flow_id UUID REFERENCES flows(id) ON DELETE CASCADE,
      status TEXT DEFAULT 'pending',
      logs JSONB DEFAULT '[]',
      result JSONB,
      created_at TIMESTAMP DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS services_metadata (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      icon TEXT,
      color TEXT,
      created_at TIMESTAMP DEFAULT now()
    );
  `;

  try {
    await pool.query(schema);
    console.log('✅ Database tables created successfully!');
    
    await seedServices();
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Failed to initialize database:', error.message);
    process.exit(1);
  }
}

async function seedServices() {
  console.log('--- Seeding Service Metadata ---');
  const services = [
    {
      id: 'gmail',
      name: 'Gmail',
      description: 'Send and receive emails, manage drafts and labels.',
      icon: 'Mail',
      color: 'text-red-500',
    },
    {
      id: 'sheets',
      name: 'Google Sheets',
      description: 'Create, read, and edit spreadsheets dynamically.',
      icon: 'FileSpreadsheet',
      color: 'text-green-600',
    },
    {
      id: 'docs',
      name: 'Google Docs',
      description: 'Create, read, and edit documents dynamically.',
      icon: 'FileText',
      color: 'text-purple-600',
    },
    {
      id: 'drive',
      name: 'Google Drive',
      description: 'Upload, download, and manage files in the cloud.',
      icon: 'HardDrive',
      color: 'text-blue-500',
    }
  ];

  for (const s of services) {
    await pool.query(
      `INSERT INTO services_metadata (id, name, description, icon, color)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         description = EXCLUDED.description,
         icon = EXCLUDED.icon,
         color = EXCLUDED.color`,
      [s.id, s.name, s.description, s.icon, s.color]
    );
  }
  console.log('✅ Service metadata seeded.');
}

setup();
