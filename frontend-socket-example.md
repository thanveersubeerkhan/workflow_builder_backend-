# Frontend WebSocket Implementation Guide

Here is an example of how to connect to the backend and update a flow using Socket.IO.

## Prerequisites

Install `socket.io-client` in your frontend project:

```bash
npm install socket.io-client
```

## Implementation

```typescript
import { io } from 'socket.io-client';

// Connect to the backend
const socket = io('http://localhost:3000', {
  withCredentials: true,
});

socket.on('connect', () => {
  console.log('Connected to server:', socket.id);
  
  // Join the flow room flowId
  const flowId = 'your-flow-id-here';
  socket.emit('join-flow', flowId);
});

// Listener for external updates (e.g. from other users)
socket.on('flow-updated', (updatedFlow) => {
  console.log('Flow updated externally:', updatedFlow);
  // Update your local state here
});

// Function to update the flow
const updateFlow = (flowId: string, updates: any) => {
  // updates can contain: { name, ui_definition, is_active }
  
  socket.emit('update-flow', { flowId, ...updates }, (response: any) => {
    if (response.error) {
      console.error('Update failed:', response.error);
    } else {
      console.log('Update successful:', response.flow);
    }
  });
};

// Example Usage
// updateFlow('123', { name: 'New Flow Name', is_active: true });
```

## Events

### Client -> Server

-   `join-flow`: Join a specific flow room to receive updates.
    -   Payload: `flowId` (string)
-   `update-flow`: Update flow properties.
    -   Payload: `{ flowId, name?, ui_definition?, is_active? }`
    -   Callback: `{ success: true, flow }` or `{ error: string }`

### Server -> Client

-   `flow-updated`: Broadcasted when a flow is updated by another client (or yourself).
    -   Payload: `flow` object
