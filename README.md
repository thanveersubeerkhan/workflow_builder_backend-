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

- **OAuth2 Integration**: Connect with Google services (Gmail, Drive, etc) with robust secure encryption.
- **React Flow UI Sync**: Automatically maps visual node/edge data to backend execution logic.
- **Workflow Engine**: Execute multi-step flows with variable mapping and smart error handling.
- **Automated Triggers**: Poll for events (like new emails or time schedules) and trigger workflows.
- **Detailed execution logs**: View step-by-step logs and full API error messages from Google.
- **Task Queuing**: Robust background processing with BullMQ and Redis.

---

## 🔌 API Endpoints

### Authentication
- `GET /auth/connect/:service?userId=...` - Initiate Google OAuth connection.
- `GET /auth/me` - Get current user profile and session info.
- `GET /auth/callback/:service` - OAuth callback handler.

### Connections & Metadata
- `GET /api/connections/:userId` - List active connections for a user.
- `DELETE /api/disconnect/:userId/:service` - Remove an integration (robust revocation).
- `GET /api/services` - Get metadata (icons, colors, names) for all available services.

### Flows (Workflow Management)
- `POST /api/flows` - Create a new flow from UI definition (defaults to inactive).
- `GET /api/flows?userId=...` - List all flows for a specific user.
- `GET /api/flows/:flowId` - Get full details (logic + visual layout) of a flow.
- `PATCH /api/flows/:flowId` - Update flow name, UI layout, or toggle `is_active` status.
- `GET /api/flows/:flowId/runs` - Fetch recent execution logs and results for a flow.
- `POST /api/flows/:flowId/run` - Manually queue an execution for an existing flow.

---

## 🧪 Testing

The project includes a comprehensive test suite to verify all layers:

```bash
# Core Flows
npm run test:full       # Complete system test
npm run test:flow-mgmt  # Test UI-backsync and CRUD
npm run test:ui-sync    # Test logic mapping (UI -> Execution)

# Individual Pieces
npm run test:email      # Gmail send/receive
npm run test:trigger    # Polling triggers
npm run test:pieces     # All service actions check
npm run test:schedule   # Time-based triggers
```

---

## 📂 Project Structure

- `src/index.ts`: Main entry point & Express server.
- `src/worker.ts`: BullMQ worker for workflow execution with detailed logging.
- `src/trigger-worker.ts`: Background polling for automated triggers.
- `src/flow-mapper.ts`: Utility that converts React Flow UI data to execution logic.
- `src/engine.ts`: Core execution logic and Google OAuth client management.
- `src/pieces/`: Implementation of service-specific triggers and actions.
- `src/setup-db.ts`: Database schema definition and initialization logic.
- `src/tests/`: Collection of scripts to verify individual components.


-`trigger dev run`:npx trigger.dev@latest dev 

-`trigger dev run`:npx trigger.dev@latest dev 

