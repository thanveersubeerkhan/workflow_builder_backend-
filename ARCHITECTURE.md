# 🏗 Workflow Backend: System Architecture & File-by-File Explainer

This document provides a comprehensive walkthrough of the entire application. Read this to understand how the system functions as a modular automation platform, similar to Activepieces.

---

## 🗺 High-Level Flow

The system operates in three main stages:
1.  **Connection**: Users link their Google accounts (OAuth).
2.  **Triggering**: Automated scripts or API calls detect an event (e.g., a new email).
3.  **Execution**: A background worker executes a sequence of actions, mapping data between them.

---

## 📂 Core Directory: `src/`

### 1. Entry & Infrastructure
*   **`index.ts` (The Brain)**: 
    - Initializes the Express server.
    - Mounts all API routes (`/auth`, `/api/flows`, etc.).
    - Starts the background workers (`refresh-worker` and `trigger-worker`).
*   **`db.ts`**: Handles the connection to the PostgreSQL database using a connection pool.
*   **`queues.ts`**: Defines the BullMQ queues (`flow-execution`) and the Redis connection shared by the API and workers.
*   **`types.ts`**: Contains the TypeScript interfaces (like `FlowDefinition`, `Step`) that ensure data consistency across the app.

### 2. Authentication & Integration
*   **`auth.ts`**: Manages the Google OAuth2 flow. It generates the auth URL and handles the callback to store the initial `refresh_token`.
*   **`tokens.ts`**: A critical utility that provides valid `access_tokens`. It checks if a token is expired and uses the `refresh_token` to get a new one if needed.
*   **`disconnect.ts`**: Cleans up by deleting user integrations from the database.

### 3. The Execution Engine
*   **`engine.ts`**: The "Individual Action Runner." It knows how to take a single request (e.g., "Send Email") and route it to the correct "Piece."
*   **`mapping-engine.ts`**: The "Data Glue." It resolves variables like `{{steps.trigger.data.id}}`. It looks at the results of previous steps and replaces the placeholders with real data.
*   **`worker.ts`**: The "Multi-step Orchestrator." This is a BullMQ worker that:
    1.  Starts a "Flow Run" in the database.
    2.  Loops through every step in a flow.
    3.  Calls the `mapping-engine` to resolve inputs.
    4.  Calls the `engine` to execute the action.
    5.  Logs everything and updates the final status.

### 4. Background Workers (The "Autonomous" part)
*   **`trigger-worker.ts`**: Polls external services (like Gmail) every minute. If it finds something new, it creates a job in the `flow-execution` queue to start a workflow.
*   **`refresh-worker.ts`**: A maintenance job that periodically ensures all stored OAuth tokens are fresh and valid.

### 5. `pieces/` (The Library of Actions)
This folder contains the actual logic for interacting with external APIs.
*   **`google.ts`**: Shared utility for creating Google API clients using stored tokens.
*   **`gmail.ts`**: Implementation of Gmail actions (Send email, List threads).
*   **`drive.ts`**: Implementation of Google Drive actions (List files).

---

## ⚙️ Support Files

*   **`setup-db.ts`** (in `src/`): A script to create the database schema (Tables: `users`, `google_integrations`, `flows`, `flow_runs`). Run via `npm run db:setup`.
*   **`master-test.ts`** (in `src/`): A system-wide test suite that simulates a user connecting, creating a flow, and verifying that the worker executes it correctly.
*   **`src/tests/`**: Contains various scripts for testing individual components (`test-email.ts`, `test-trigger.ts`, etc.).
*   **`.env`**: Stores sensitive credentials (DB URLs, Google Client IDs). **Never commit this to version control.**

---

## 🔄 The Life of a Workflow (Example)

1.  **User Action**: User connects Gmail via `/auth/connect`.
2.  **Flow Creation**: User sends a POST to `/api/flows` with a definition:
    - *Step 1*: Trigger on New Email.
    - *Step 2*: Send an automated reply.
3.  **Polling**: `trigger-worker.ts` sees a new email in the user's inbox.
4.  **Queueing**: `trigger-worker.ts` adds a job to the Redis queue.
5.  **Execution**: `worker.ts` picks up the job, maps the sender's email address from the trigger, and calls `gmail.ts` to send the reply.
6.  **Logging**: The results are saved in the `flow_runs` table for the user to see later.

---

## 🚀 Why this architecture?
- **Decoupled**: The API doesn't wait for the workflow to finish; the Worker handles it separately.
- **Extensible**: You can add "Slack" by just adding `src/pieces/slack.ts`.
- **Reliable**: If the server restarts, Redis remembers which jobs were in the queue and resumes them.
