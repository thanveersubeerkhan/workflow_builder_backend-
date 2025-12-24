# Workflow Backend

A TypeScript-based backend for managing Google Integrations, automated triggers, and multi-step workflow execution using BullMQ and PostgreSQL.

## 🚀 Quick Start

### 1. Prerequisites
- **Node.js**: v18+
- **Docker**: For running Redis and PostgreSQL easily

### 2. Infrastructure Setup
Start the required services (Postgres & Redis) using Docker:
```bash
npm run docker:up
```

Update your `.env` file to match the services:
```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/workflow"
REDIS_URL="redis://localhost:6379"
```

### 3. Installation
```bash
npm install
```

### 3. Database Setup
Initialize the database tables:
```bash
npm run db:setup
```

### 4. Running the App
**Development (with auto-reload):**
```bash
npm run dev
```

**Production:**
```bash
npm start
```

---

## 🛠 Features

- **OAuth2 Integration**: Connect with Google services (Gmail, Drive, etc.).
- **Workflow Engine**: Execute multi-step flows with variable mapping.
- **Automated Triggers**: Poll for events (like new emails) and trigger workflows.
- **Task Queuing**: Robust background processing with BullMQ and Redis.

---

## 🔌 API Endpoints

### Authentication
- `GET /auth/connect/:service?userId=...` - Initiate Google OAuth connection.
- `GET /auth/callback` - OAuth callback handler.

### Connections
- `GET /api/connections/:userId` - List active connections for a user.
- `DELETE /api/disconnect/:userId/:service` - Remove an integration.

### Flows
- `POST /api/flows` - Create and immediately queue a new workflow.
- `DELETE /api/flows/:flowId` - Permanently delete a flow.
- `PATCH /api/flows/:flowId/status` - Stop (`inactive`) or Start (`active`) a flow.
- `POST /api/flows/:flowId/run` - Manually queue an existing flow for execution.
- `POST /api/run` - Run a single action manually (one-off).

### Tokens
- `GET /api/tokens/:userId/:service` - Get a valid access token.

---

## 🧪 Testing

Run the full system test suite:
```bash
npm run test:full
```

Individual tests:
```bash
npm run test:email
npm run test:trigger
npm run test:auto
npm run test:spiced
npm run test:pieces
npm run test:schedule
npm run test:schedule-sheets
```

---

## 📂 Project Structure

- `src/index.ts`: Main entry point & Express server.
- `src/worker.ts`: BullMQ worker for workflow execution.
- `src/trigger-worker.ts`: Background polling for automated triggers.
- `src/engine.ts`: Core logic for executing individual actions.
- `src/pieces/`: Implementation of specific service actions (Gmail, Drive, etc.).
- `src/db.ts`: Database connection and utilities.
- `src/tests/`: Collection of scripts to verify individual components.
