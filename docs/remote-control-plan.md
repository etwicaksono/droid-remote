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

### SQLite Database

Using SQLite for persistence and troubleshooting. Single file (`bridge.db`), no server needed.

#### Why SQLite?
- **Troubleshooting**: Query historical data easily
- **Persistence**: Survives server restarts
- **Audit trail**: Track all decisions and actions
- **Simple**: Single file, no setup, works everywhere

#### Database Schema

```sql
-- Sessions table
CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    project_dir TEXT NOT NULL,
    status TEXT DEFAULT 'running',
    control_state TEXT DEFAULT 'cli_active',
    transcript_path TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Session events (for troubleshooting)
CREATE TABLE session_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    event_type TEXT NOT NULL,  -- 'start', 'stop', 'handoff', 'release', 'state_change'
    event_data TEXT,           -- JSON blob for additional data
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES sessions(id)
);

-- Message queue
CREATE TABLE queued_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    content TEXT NOT NULL,
    source TEXT NOT NULL,      -- 'telegram', 'web'
    status TEXT DEFAULT 'pending',  -- 'pending', 'sent', 'cancelled'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    sent_at TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES sessions(id)
);

-- Permission requests
CREATE TABLE permission_requests (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    tool_name TEXT,
    tool_input TEXT,           -- JSON blob
    message TEXT,
    decision TEXT,             -- 'approved', 'denied', 'pending'
    decided_by TEXT,           -- 'telegram', 'web', 'auto'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    decided_at TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES sessions(id)
);

-- Task executions
CREATE TABLE tasks (
    id TEXT PRIMARY KEY,
    session_id TEXT,
    prompt TEXT NOT NULL,
    project_dir TEXT NOT NULL,
    model TEXT,
    result TEXT,
    success BOOLEAN,
    duration_ms INTEGER,
    error TEXT,
    source TEXT NOT NULL,      -- 'telegram', 'web', 'api'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES sessions(id)
);

-- Indexes for common queries
CREATE INDEX idx_session_events_session ON session_events(session_id);
CREATE INDEX idx_session_events_created ON session_events(created_at);
CREATE INDEX idx_queued_messages_session ON queued_messages(session_id);
CREATE INDEX idx_queued_messages_status ON queued_messages(status);
CREATE INDEX idx_permission_requests_session ON permission_requests(session_id);
CREATE INDEX idx_tasks_session ON tasks(session_id);
CREATE INDEX idx_tasks_created ON tasks(created_at);
```

#### Useful Troubleshooting Queries

```sql
-- Recent session events
SELECT * FROM session_events 
WHERE session_id = ? 
ORDER BY created_at DESC LIMIT 50;

-- Permission decisions in last 24h
SELECT * FROM permission_requests 
WHERE created_at > datetime('now', '-24 hours')
ORDER BY created_at DESC;

-- Failed tasks
SELECT * FROM tasks 
WHERE success = 0 
ORDER BY created_at DESC;

-- Message queue for session
SELECT * FROM queued_messages 
WHERE session_id = ? AND status = 'pending'
ORDER BY created_at ASC;

-- Session timeline
SELECT 
    'event' as type, event_type as action, created_at 
FROM session_events WHERE session_id = ?
UNION ALL
SELECT 
    'permission' as type, tool_name as action, created_at 
FROM permission_requests WHERE session_id = ?
UNION ALL
SELECT 
    'task' as type, substr(prompt, 1, 50) as action, created_at 
FROM tasks WHERE session_id = ?
ORDER BY created_at DESC;
```

### TypeScript Interfaces (for API/Frontend)

```typescript
interface Session {
  id: string;
  name: string;
  projectDir: string;
  status: 'running' | 'waiting' | 'stopped';
  controlState: 'cli_active' | 'cli_waiting' | 'remote_active' | 'released';
  transcriptPath?: string;
  createdAt: Date;
  updatedAt: Date;
  
  // Loaded separately
  queuedMessages?: QueuedMessage[];
  pendingRequest?: PermissionRequest;
}

interface SessionEvent {
  id: number;
  sessionId: string;
  eventType: string;
  eventData?: object;
  createdAt: Date;
}

interface QueuedMessage {
  id: number;
  sessionId: string;
  content: string;
  source: 'telegram' | 'web';
  status: 'pending' | 'sent' | 'cancelled';
  createdAt: Date;
  sentAt?: Date;
}

interface PermissionRequest {
  id: string;
  sessionId: string;
  toolName?: string;
  toolInput?: object;
  message: string;
  decision?: 'approved' | 'denied' | 'pending';
  decidedBy?: 'telegram' | 'web' | 'auto';
  createdAt: Date;
  decidedAt?: Date;
}

interface Task {
  id: string;
  sessionId?: string;
  prompt: string;
  projectDir: string;
  model?: string;
  result?: string;
  success?: boolean;
  durationMs?: number;
  error?: string;
  source: 'telegram' | 'web' | 'api';
  createdAt: Date;
  completedAt?: Date;
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

### Phase 1: Database Setup
1. Create `core/database.py` with SQLite connection management
2. Create schema initialization script
3. Create repository classes for each table
4. Add database path to configuration
5. Initialize database on server startup

### Phase 2: Migrate Session Registry to SQLite
1. Update `SessionRegistry` to use database
2. Migrate in-memory session storage to `sessions` table
3. Add session event logging
4. Ensure hooks still work with new storage

### Phase 3: Core State Management
1. Add `control_state` column to sessions
2. Implement state transition logic
3. Log state changes to `session_events`
4. Modify hooks to update control state

### Phase 4: Queue System
1. Implement `queued_messages` repository
2. Add queue API endpoints
3. Modify message handling to check state and queue
4. Add queue WebSocket events

### Phase 5: Handoff Commands
1. Add `/handoff` command to Telegram
2. Add `/release` command to Telegram
3. Modify Stop hook to handle handoff
4. Add handoff API endpoints

### Phase 6: Permission Tracking
1. Implement `permission_requests` repository
2. Log all permission requests and decisions
3. Update Telegram bot to use database
4. Add permission history API endpoint

### Phase 7: Task Tracking
1. Implement `tasks` repository
2. Update task executor to log to database
3. Add task history API endpoint
4. Track task source (telegram/web/api)

### Phase 8: Web UI - Session Control
1. Add control state indicators
2. Add Take Control / Release buttons
3. Add queue display panel
4. Add queue management actions

### Phase 9: Web UI - Task Execution
1. Add task input form
2. Add project/model selectors
3. Implement task submission
4. Add response streaming display

### Phase 10: Web UI - Permission Handling
1. Add permission request cards
2. Implement approve/deny actions
3. Add request history view
4. Real-time updates via WebSocket

### Phase 11: Web UI - History & Troubleshooting
1. Session timeline view
2. Task history with filters
3. Permission decision history
4. Export logs/data for debugging

## File Changes Summary

### Backend (Python)

| File | Changes |
|------|---------|
| `core/database.py` | **NEW** - SQLite connection, schema init |
| `core/repositories.py` | **NEW** - Repository classes for each table |
| `core/models.py` | Add controlState, update to match DB schema |
| `core/session_registry.py` | Use database instead of in-memory |
| `api/routes.py` | New endpoints for handoff, queue, transcript, history |
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

### Database & Persistence
- [ ] SQLite database created and initialized on startup
- [ ] Sessions persist across server restarts
- [ ] All events logged to `session_events` table
- [ ] Can query historical data for troubleshooting

### Control Flow
- [ ] Can handoff control from CLI to remote via `/handoff`
- [ ] Can release control back to CLI via `/release`
- [ ] Auto-handoff works when CLI exits unexpectedly
- [ ] Messages queued when CLI is active
- [ ] Queue persists across server restarts

### Web UI
- [ ] Queue visible and manageable in Web UI
- [ ] Can execute tasks from Web UI when in remote control
- [ ] Can approve/deny permissions from Web UI
- [ ] Session timeline and history visible
- [ ] Real-time updates via WebSocket

### Telegram
- [ ] Notifications delivered for all events
- [ ] Can approve/deny permissions via buttons
- [ ] `/handoff`, `/release`, `/status` commands work
- [ ] Link to Web UI in notifications

### Troubleshooting
- [ ] Can query permission decisions by date range
- [ ] Can view failed tasks with error details
- [ ] Can export session timeline for debugging
- [ ] All actions have audit trail in database
