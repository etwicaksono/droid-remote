# Droid Remote Control - Implementation Plan

## Overview

Enable remote control of Droid sessions via Telegram (notifications + quick actions) and Web UI (full control center). Support seamless handoff between CLI and remote control.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Droid CLI                                │
│                    (Local Terminal Session)                      │
└─────────────────────────┬───────────────────────────────────────┘
                          │ Hooks
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Bridge Server                               │
│  - Session Registry (with control state)                         │
│  - Message Queue                                                 │
│  - Task Executor (droid exec)                                    │
└─────────┬───────────────────────────────────────┬───────────────┘
          │                                       │
          ▼                                       ▼
┌─────────────────────┐               ┌─────────────────────────┐
│      Telegram       │               │        Web UI           │
│  (Notifications +   │               │   (Full Control Center) │
│   Quick Actions)    │               │                         │
└─────────────────────┘               └─────────────────────────┘
```

## Session Control States

```
┌─────────────┐     /handoff      ┌─────────────┐
│   CLI       │ ─────────────────→│   REMOTE    │
│  (active)   │                   │  (active)   │
└─────────────┘                   └─────────────┘
       │                                 │
       │ CLI exits                       │ /release
       │ unexpectedly                    │
       ▼                                 ▼
┌─────────────┐    droid --continue    ┌─────────────┐
│   REMOTE    │ ←─────────────────────│  RELEASED   │
│  (auto)     │                       │  (waiting)  │
└─────────────┘                       └─────────────┘
```

### State Definitions

| State | Description | Who Can Execute Tasks |
|-------|-------------|----------------------|
| `cli_active` | CLI is running and processing | CLI only (remote messages queued) |
| `cli_waiting` | CLI at stop point, waiting for input | CLI only (remote messages queued) |
| `remote_active` | Remote has taken control | Web UI / Telegram |
| `released` | Remote released, waiting for CLI | Neither (messages queued) |

## Telegram Scope (Lightweight)

### Notifications
- Session started
- Session stopped (with "Open Web UI" link)
- Permission request (with quick action buttons)
- Queue status ("3 messages queued")

### Quick Actions (Inline Buttons)
- **Approve** / **Deny** / **Approve All** - Permission requests
- **Handoff** - Take remote control
- **Open Web UI** - Link to full interface

### Commands
| Command | Description |
|---------|-------------|
| `/status` | Show session status and control state |
| `/handoff` | Take remote control from CLI |
| `/release` | Release control back to CLI |
| `/sessions` | List active sessions |

### What Telegram Does NOT Do
- ❌ Task execution (use Web UI)
- ❌ Model selection (use Web UI)
- ❌ Queue management (use Web UI)
- ❌ Long responses (link to Web UI)

## Web UI Scope (Full Control)

### Dashboard
- Active sessions list with status indicators
- Control state badge (CLI Active / Remote / Released)
- Quick actions per session

### Session View
- Full conversation history
- Real-time updates via WebSocket
- File changes viewer
- Execution logs

### Task Execution
- Text area for instructions
- Project directory selector
- Model selector dropdown
- Execute button
- Response display with streaming

### Permission Handling
- Permission request cards
- Approve / Deny / Approve All buttons
- Tool details (name, input, risk level)
- Request history

### Queue Management
- View queued messages
- Reorder / delete queued items
- Send next in queue
- Clear queue

### Session Control
- **Take Control** button (handoff from CLI)
- **Release to CLI** button
- Status indicator with timestamps
- Session history

## Data Model

### Session (Extended)

```typescript
interface Session {
  id: string;
  name: string;
  projectDir: string;
  status: 'running' | 'waiting' | 'stopped';
  
  // New fields
  controlState: 'cli_active' | 'cli_waiting' | 'remote_active' | 'released';
  controlStateChangedAt: Date;
  transcriptPath: string;
  
  // Queue
  queuedMessages: QueuedMessage[];
  
  // Pending request
  pendingRequest?: PendingRequest;
}

interface QueuedMessage {
  id: string;
  content: string;
  source: 'telegram' | 'web';
  createdAt: Date;
}

interface PendingRequest {
  id: string;
  type: 'permission' | 'input';
  toolName?: string;
  toolInput?: object;
  message: string;
  createdAt: Date;
}
```

## Event Handling

### Hook Events → State Changes

| Hook Event | Current State | New State | Action |
|------------|---------------|-----------|--------|
| SessionStart | * | `cli_active` | Register session, notify Telegram |
| Stop (normal) | `cli_active` | `cli_waiting` | Notify Telegram + Web UI |
| SessionEnd | `cli_*` | `remote_active` | Auto-handoff, notify user |
| SessionEnd | `remote_*` | `released` | Session ended remotely |

### User Actions → State Changes

| Action | Current State | New State | Effect |
|--------|---------------|-----------|--------|
| `/handoff` | `cli_waiting` | `remote_active` | Stop hook exits, enable remote |
| `/release` | `remote_active` | `released` | Disable remote, wait for CLI |
| `droid --continue` | `released` | `cli_active` | CLI resumes |
| `droid --continue` | `remote_active` | `cli_active` | CLI takes back control |

### Message Handling

| Sender | Control State | Action |
|--------|---------------|--------|
| Web UI | `remote_active` | Execute via `droid exec --session-id` |
| Web UI | `cli_*` | Queue message, notify user |
| Web UI | `released` | Queue message |
| Telegram | Any | Quick actions only (no task execution) |

## API Endpoints

### Existing (Keep)
- `POST /sessions/register` - Hook registers session
- `GET /sessions` - List sessions
- `PATCH /sessions/:id` - Update session
- `POST /sessions/:id/notify` - Send notification
- `POST /sessions/:id/respond` - Send response to waiting session
- `POST /tasks/execute` - Execute task via droid exec

### New Endpoints

```
POST /sessions/:id/handoff
  - Trigger handoff from CLI to remote
  - Returns: { success: boolean }

POST /sessions/:id/release
  - Release control back to CLI
  - Returns: { success: boolean }

GET /sessions/:id/queue
  - Get queued messages
  - Returns: { messages: QueuedMessage[] }

POST /sessions/:id/queue
  - Add message to queue
  - Body: { content: string, source: string }
  - Returns: { message: QueuedMessage }

DELETE /sessions/:id/queue/:messageId
  - Remove message from queue
  - Returns: { success: boolean }

POST /sessions/:id/queue/send-next
  - Send next queued message
  - Returns: { success: boolean, message?: QueuedMessage }

GET /sessions/:id/transcript
  - Get conversation transcript
  - Returns: { messages: TranscriptMessage[] }
```

## WebSocket Events

### Server → Client

```typescript
// Session updates
'sessions_update': Session[]
'session_state_changed': { sessionId: string, controlState: string }

// Queue updates  
'queue_updated': { sessionId: string, queue: QueuedMessage[] }

// Permission requests
'permission_request': { sessionId: string, request: PendingRequest }
'permission_resolved': { sessionId: string, requestId: string, decision: string }

// Task execution
'task_started': { sessionId: string, taskId: string, prompt: string }
'task_progress': { sessionId: string, taskId: string, content: string }
'task_completed': { sessionId: string, taskId: string, result: TaskResult }
```

### Client → Server

```typescript
// Responses
'respond': { sessionId: string, requestId?: string, response: string }
'approve': { sessionId: string, requestId: string }
'deny': { sessionId: string, requestId: string }

// Control
'handoff': { sessionId: string }
'release': { sessionId: string }

// Queue
'queue_message': { sessionId: string, content: string }
'clear_queue': { sessionId: string }
```

## Implementation Phases

### Phase 1: Core State Management
1. Add `controlState` to Session model
2. Add `queuedMessages` to Session model  
3. Update session registry with state transitions
4. Modify hooks to set appropriate states

### Phase 2: Queue System
1. Implement message queue in session registry
2. Add queue API endpoints
3. Modify message handling to check state and queue
4. Add queue WebSocket events

### Phase 3: Handoff Commands
1. Add `/handoff` command to Telegram
2. Add `/release` command to Telegram
3. Modify Stop hook to handle handoff
4. Add handoff API endpoints

### Phase 4: Web UI - Session Control
1. Add control state indicators
2. Add Take Control / Release buttons
3. Add queue display panel
4. Add queue management actions

### Phase 5: Web UI - Task Execution
1. Add task input form
2. Add project/model selectors
3. Implement task submission
4. Add response streaming display

### Phase 6: Web UI - Permission Handling
1. Add permission request cards
2. Implement approve/deny actions
3. Add request history
4. Real-time updates via WebSocket

### Phase 7: Web UI - Conversation View
1. Parse and display transcript
2. Real-time message updates
3. File changes viewer
4. Execution logs

## File Changes Summary

### Backend (Python)

| File | Changes |
|------|---------|
| `core/models.py` | Add controlState, queuedMessages fields |
| `core/session_registry.py` | State transitions, queue management |
| `api/routes.py` | New endpoints for handoff, queue, transcript |
| `api/socketio_handlers.py` | New events for state, queue, permissions |
| `bot/telegram_bot.py` | Simplify to notifications + quick actions |
| `bot/commands.py` | Add /handoff, /release commands |
| `hooks/telegram_stop.py` | Handle handoff request |
| `hooks/telegram_session_end.py` | Auto-handoff on CLI exit |

### Frontend (Next.js)

| File | Changes |
|------|---------|
| `components/sessions/session-card.tsx` | Control state, quick actions |
| `components/sessions/session-detail.tsx` | New: full session view |
| `components/sessions/task-form.tsx` | New: task execution form |
| `components/sessions/permission-card.tsx` | New: permission handling |
| `components/sessions/queue-panel.tsx` | New: queue management |
| `components/sessions/transcript-view.tsx` | New: conversation display |
| `hooks/use-session.ts` | New: session state management |
| `lib/socket.ts` | Add new event types |

## Success Criteria

- [ ] Can handoff control from CLI to remote via `/handoff`
- [ ] Can release control back to CLI via `/release`
- [ ] Auto-handoff works when CLI exits unexpectedly
- [ ] Messages queued when CLI is active
- [ ] Queue visible and manageable in Web UI
- [ ] Can execute tasks from Web UI when in remote control
- [ ] Can approve/deny permissions from both Telegram and Web UI
- [ ] Full conversation visible in Web UI
- [ ] Real-time updates in both Telegram and Web UI
