# Telegram-Droid Integration

Control Factory.ai Droid CLI remotely via Telegram and Web UI.

## Features

- **Remote Control**: Take control of Droid sessions from Web UI
- **Web Dashboard**: Real-time session monitoring with chat-style interface
- **Real-Time Activity**: See tool executions (READ, EDIT, EXECUTE) as they happen
- **Telegram Notifications**: Receive task completion alerts with Web UI links
- **Multi-Session**: Manage multiple Droid sessions per project directory
- **Permission Requests**: Approve/deny tool executions via Web UI
- **Mobile Responsive**: Access from phone on local network
- **URL Routing**: Clean URLs (`/session/{id}`, `/permissions`)
- **Cross-Device Sync**: "Droid is thinking" state syncs across all devices
- **Configurable Models**: Edit JSON file to add/remove AI models
- **Session Rename**: Rename sessions inline with hover edit button
- **Docker Support**: Run everything with Docker, no Python/Node.js required

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Telegram App  │◄───►│  Bridge Server   │◄───►│  Hook Scripts   │
│   (on Phone)    │     │  (FastAPI+WS)    │     │  (Python)       │
└─────────────────┘     └──────────────────┘     └────────┬────────┘
                               ▲                          │
                               │                          │
        ┌──────────────────────┘                          │
        │                                                 │
        ▼                                                 ▼
┌──────────────┐                                 ┌─────────────────┐
│   Web UI     │                                 │   Droid CLI     │
│   (Next.js)  │                                 │   (Factory.ai)  │
└──────────────┘                                 └─────────────────┘
```

## Quick Start

```bash
git clone https://github.com/user/droid-remote.git
cd droid-remote
./setup.sh
```

The setup script will:
1. Prompt for your Telegram credentials
2. Generate `.env` configuration
3. Configure Factory CLI hooks automatically
4. Start Docker services

That's it! Access Web UI at http://localhost:3000

---

## Manual Installation

If you prefer manual setup or the script doesn't work on your system:

### Option A: Docker (Recommended)

```bash
# 1. Clone repository
git clone https://github.com/user/droid-remote.git
cd droid-remote

# 2. Configure environment
cp .env.example .env
# Edit .env with your Telegram credentials

# 3. Start services
docker-compose up -d

# 4. Configure Factory hooks
cp config/settings.docker.json ~/.factory/settings.json
# Edit ~/.factory/settings.json - replace /path/to/droid-remote with actual path

# 5. Start Droid
droid
```

**Docker Limitations:**
- ✅ View CLI sessions in Web UI
- ✅ Respond to permission requests
- ✅ Receive Telegram notifications
- ❌ **Create new tasks via Web UI** - The `droid` CLI runs on the host, not in Docker. Web UI "Custom Task" requires the bridge to execute `droid exec`, which isn't available inside the container.

For full Web UI task creation, use Native installation or run the bridge directly on the host.

### Option B: Native (Development)

Requires Python 3.11+ and Node.js 20+.

```bash
# 1. Clone and configure
git clone https://github.com/user/droid-remote.git
cd droid-remote
cp .env.example .env
# Edit .env with your settings

# 2. Start Bridge Server (Terminal 1)
cd telegram-bridge
pip install -r requirements.txt
python server.py

# 3. Start Web UI (Terminal 2)
cd telegram-bridge/web
npm install
npm run dev

# 4. Configure Factory hooks
cp config/settings.native.json ~/.factory/settings.json
# Edit ~/.factory/settings.json - replace /path/to/droid-remote with actual path

# 5. Start Droid
droid
```

---

## Configuration

### Environment Variables (.env)

```bash
# Telegram Bot (get from @BotFather and @userinfobot)
TELEGRAM_BOT_TOKEN=your-bot-token
TELEGRAM_CHAT_ID=your-chat-id
TELEGRAM_ALLOWED_USERS=your-user-id

# Bridge Server
BRIDGE_URL=http://127.0.0.1:8765
BRIDGE_SECRET=your-secret-here

# Web UI Authentication
AUTH_USERNAME=admin
AUTH_PASSWORD=your-password
JWT_SECRET=change-this-to-random-string

# Web UI URL (use local IP for mobile access)
WEB_UI_URL=http://192.168.x.x:3000
```

### Docker Commands

```bash
docker-compose up -d        # Start services
docker-compose logs -f      # View logs
docker-compose down         # Stop services
docker-compose up -d --build  # Rebuild after changes
```

## Project Structure

```
droid-remote/
├── .env                        # Centralized configuration (all settings)
├── .env.example                # Configuration template
│
├── config/                     # Configuration templates
│   ├── settings.py             # Python config loader
│   ├── settings.docker.json    # Factory hooks config (Docker)
│   └── settings.native.json    # Factory hooks config (Native)
│
├── hooks/                      # Hook scripts for Droid
│   ├── docker/                 # Docker wrapper scripts (bash)
│   │   └── *.sh                # Wrapper scripts for docker exec
│   ├── lib/                    # Shared library
│   │   ├── bridge_client.py    # HTTP client for bridge
│   │   ├── config.py           # Imports from config/settings.py
│   │   └── formatters.py       # Message formatters
│   ├── telegram_notify.py      # Notification hook
│   ├── telegram_stop.py        # Stop hook (saves chat, sends notification)
│   ├── telegram_pre_tool.py    # Permission request hook
│   ├── telegram_post_tool.py   # Post tool hook
│   ├── telegram_user_prompt.py # User prompt capture hook
│   ├── telegram_session_start.py
│   ├── telegram_session_end.py
│   └── telegram_subagent_stop.py
│
├── telegram-bridge/            # Bridge server
│   ├── bot/                    # Telegram bot
│   ├── api/                    # REST API routes + auth
│   ├── core/                   # Core modules (session registry, db, models)
│   ├── web/                    # Next.js Web UI
│   │   └── src/
│   │       ├── app/            # Next.js app router (pages)
│   │       ├── components/     # React components
│   │       ├── hooks/          # Custom React hooks
│   │       ├── config/         # Configuration (models.json)
│   │       └── lib/            # Utilities
│   ├── server.py               # Main entry point
│   ├── Dockerfile
│   └── docker-compose.yml
│
└── docs/                       # Implementation plans
    ├── 01-remote-control-plan.md
    ├── 02-mobile-responsive-plan.md
    ├── 03-sidebar-redesign-plan.md
    └── 04-image-support-plan.md
```

## Web UI Features

Access at `http://localhost:3000` or `http://<your-ip>:3000` for mobile.

### Session View
- **Claude-Style Input**: Clean input box with toolbar
- **Welcome Screen**: Centered input when no chat history
- **Chat Interface**: Send instructions to Droid
- **Real-Time Activity**: Collapsible panel showing tool executions as they happen
- **Model Selection**: Choose AI model from toolbar
- **Thinking Mode**: Adjust reasoning effort for supported models
- **Autonomy Level**: Control tool execution autonomy (low/medium/high)
- **Take Control**: Switch from CLI to remote control
- **Release to CLI**: Return control back to CLI
- **Cross-Device Sync**: "Droid is thinking" shows on all connected devices
- **Pagination**: Load older messages with "Load more" button

### Real-Time Activity Panel
While Droid is processing, you can see:
- Tool calls: `[READ]`, `[EDIT]`, `[EXECUTE]`, `[Grep]`, `[Glob]`, etc.
- File paths and parameters
- Action count with collapsible view
- Click to expand/collapse activity details

### URL Routes

| Route | Description |
|-------|-------------|
| `/` | Home - Session list and custom task |
| `/session/{id}` | Individual session view |
| `/permissions` | Permission request history |
| `/settings` | Permission allowlist management |

Session URLs are shareable via Telegram notifications and bookmarkable.

### Sidebar Navigation
- **Sessions**: List of active sessions with status indicators
- **Custom Task**: Create standalone tasks with directory picker
- **Permissions**: View permission request history
- **Settings**: Manage permission allowlist rules
- Collapsible session header with project folder and last activity

## Telegram Bot

### Commands

| Command | Description |
|---------|-------------|
| `/start` | Initialize bot |
| `/sessions` | List active sessions |
| `/status` | Check session status |

### Notifications

The bot sends notifications for:
- **Session Start**: When a new Droid session begins
- **Task Completion**: When CLI or Web UI task completes

Example notification:
```
✅ *Task Completed*
📁 Project: `my-project`
💬 Prompt: _fix the bug in..._

📝 *Result:*
I've fixed the bug by updating...

🔗 Open in Web UI
```

Task result length is configurable via `TELEGRAM_TASK_RESULT_MAX_LENGTH` in `hooks/lib/config.py`.

## Permission Requests

When Droid needs approval for a tool execution:

1. CLI must run with `--auto high` (or medium) for PreToolUse hook to fire
2. Permission request appears in Web UI session view
3. Click **Approve** or **Deny** in Web UI
4. Telegram notification shows link to Web UI for mobile access

## Mobile Access

To access from phone on same network:

1. Find your computer's local IP (e.g., `192.168.100.8`)
2. Set environment variables:
   - `WEB_UI_URL` in `hooks/lib/config.py` → `http://192.168.100.8:3000`
   - `NEXT_PUBLIC_API_URL` in `telegram-bridge/web/.env.local` → `http://192.168.100.8:8765`
   - `NEXT_PUBLIC_WS_URL` in `telegram-bridge/web/.env.local` → `http://192.168.100.8:8765`
3. Rebuild Web UI: `npm run build`
4. Access Web UI at `http://192.168.100.8:3000`

## Configuration Files

| File | Purpose |
|------|---------|
| `.env` (project root) | All settings (Telegram, bridge, auth, timeouts) |
| `telegram-bridge/web/.env.local` | Web UI API/WebSocket URLs |
| `telegram-bridge/web/src/config/models.json` | Available AI models |
| `~/.factory/settings.json` | Factory CLI hooks configuration |

### Models Configuration

Edit `telegram-bridge/web/src/config/models.json` to add/remove AI models:

```json
{
  "models": [
    { "id": "claude-sonnet-4-5-20250929", "name": "Claude Sonnet 4.5", "reasoning": true },
    { "id": "claude-opus-4-5-20251101", "name": "Claude Opus 4.5", "reasoning": true },
    { "id": "gpt-5.1-codex", "name": "GPT-5.1 Codex", "reasoning": true }
  ],
  "defaultModel": "claude-sonnet-4-5-20250929",
  "reasoningLevels": [
    { "id": "off", "name": "Off" },
    { "id": "low", "name": "Low" },
    { "id": "medium", "name": "Medium" },
    { "id": "high", "name": "High" }
  ],
  "defaultReasoningLevel": "medium"
}
```

- `reasoning: true` - Shows thinking mode selector for this model
- Rebuild Web UI after changes: `npm run build`

### Hook Health Check

Hooks include a quick health check (300ms timeout) before connecting to the bridge server. If the bridge is down, hooks exit immediately without blocking the CLI.

## Troubleshooting

### Hooks not firing
- Check `~/.factory/settings.json` has correct hook paths
- Verify Python path is correct for your system
- Check hook logs in `hooks/logs/` directory

### WebSocket not connecting
- Verify `NEXT_PUBLIC_WS_URL` matches your bridge server address
- Check if bridge server is running on port 8765
- Look for connection status indicator in Web UI sidebar

### Activity not streaming
- The activity panel only shows for Web UI tasks (not CLI)
- Ensure bridge server is running and WebSocket is connected
- Check browser console for `task_activity` events

### Permission requests not appearing
- CLI must run with `--auto high` or `--auto medium`
- PreToolUse hook must be configured in `~/.factory/settings.json`
- Check Web UI session view for pending requests

## License

MIT
