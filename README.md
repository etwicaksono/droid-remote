# Telegram-Droid Integration

Control Factory.ai Droid CLI remotely via Telegram and Web UI.

## Features

- **Remote Control**: Take control of Droid sessions from Web UI or Telegram
- **Web Dashboard**: Real-time session monitoring with chat-style interface
- **Telegram Bot**: Receive notifications with clickable links to Web UI
- **Multi-Session**: Manage multiple Droid instances simultaneously
- **Permission Requests**: Approve/deny tool executions remotely
- **Mobile Responsive**: Access from phone on local network
- **URL Sharing**: Direct links to specific sessions (e.g., `/?session=<id>`)

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

### 1. Create Telegram Bot

1. Open Telegram, search for @BotFather
2. Send `/newbot` and follow instructions
3. Save the bot token
4. Get your chat ID from @userinfobot

### 2. Configure Hooks

Edit `hooks/lib/config.py` with your settings:

```python
# Bridge Server
BRIDGE_URL = "http://127.0.0.1:8765"
BRIDGE_SECRET = "your-secret-here"

# Web UI (for session links in Telegram notifications)
WEB_UI_URL = "http://192.168.x.x:3000"  # Use your local IP for mobile access

# Timeouts
DEFAULT_TIMEOUT = 300
PERMISSION_TIMEOUT = 120
NOTIFY_TIMEOUT = 10
```

### 3. Configure Bridge Server

Edit `telegram-bridge/.env`:

```bash
TELEGRAM_BOT_TOKEN=your-bot-token
TELEGRAM_CHAT_ID=your-chat-id
TELEGRAM_ALLOWED_USERS=your-user-id
BRIDGE_SECRET=your-secret-here
```

### 4. Install Hook Scripts

Copy hooks to your Factory.ai hooks directory:

```powershell
# Windows
Copy-Item -Path hooks\* -Destination "$env:USERPROFILE\.factory\hooks" -Recurse
```

### 5. Configure Droid

Copy the settings to your Factory.ai config:

```powershell
# Windows
Copy-Item config\settings.template.json "$env:USERPROFILE\.factory\settings.json"
# Edit the file to replace USERNAME with your Windows username
```

### 6. Start Bridge Server

```bash
cd telegram-bridge

# Option A: Docker (recommended)
docker-compose up -d

# Option B: Native Python
pip install -r requirements.txt
python server.py
```

### 7. Start Web UI

```bash
cd telegram-bridge/web
npm install
npm run dev
```

### 8. Start Droid

```bash
droid
# You should receive a Telegram notification with a link to Web UI!
```

## Project Structure

```
droid-remote/
├── hooks/                      # Hook scripts for Droid
│   ├── lib/                    # Shared library
│   │   ├── bridge_client.py    # HTTP client for bridge
│   │   ├── config.py           # Centralized configuration
│   │   └── formatters.py       # Message formatters
│   ├── telegram_notify.py      # Notification hook
│   ├── telegram_stop.py        # Stop hook (wait for input)
│   ├── telegram_pre_tool.py    # Permission request hook
│   ├── telegram_session_start.py
│   ├── telegram_session_end.py
│   └── telegram_subagent_stop.py
│
├── telegram-bridge/            # Bridge server
│   ├── bot/                    # Telegram bot
│   ├── api/                    # REST API routes
│   ├── core/                   # Core modules (session registry, db, models)
│   ├── web/                    # Next.js Web UI
│   │   └── src/
│   │       ├── app/            # Next.js app router
│   │       ├── components/     # React components
│   │       ├── hooks/          # Custom React hooks
│   │       └── lib/            # Utilities
│   ├── server.py               # Main entry point
│   ├── .env                    # Server configuration
│   ├── Dockerfile
│   └── docker-compose.yml
│
├── config/                     # Droid configuration templates
│   └── settings.template.json
│
└── docs/                       # Implementation plans
    ├── 01-remote-control-plan.md
    ├── 02-mobile-responsive-plan.md
    └── 03-sidebar-redesign-plan.md
```

## Web UI Features

Access at `http://localhost:3000` or `http://<your-ip>:3000` for mobile.

### Session View
- **Chat Interface**: Send instructions to Droid in chat-style UI
- **Model Selection**: Choose AI model (Claude, GPT, Gemini, etc.)
- **Thinking Mode**: Adjust reasoning effort for supported models
- **Take Control**: Switch from CLI to remote control
- **Release to CLI**: Return control back to CLI

### Session URL
Each session has a direct URL: `/?session=<session-id>`
- Shareable via Telegram notifications
- Bookmarkable for quick access
- Auto-selects session on page load

### Sidebar Navigation
- **Sessions**: List of active sessions with status indicators
- **Custom Task**: Create standalone tasks
- **Permissions**: View permission request history
- **History**: Task execution history grouped by session

## Telegram Commands

| Command | Description |
|---------|-------------|
| `/start` | Initialize bot |
| `/sessions` | List active sessions |
| `/status` | Check session status |
| `/switch <name>` | Switch active session |
| `/handoff` | Take remote control |
| `/release` | Release back to CLI |
| `/models` | Select AI model |

## Telegram Notifications

Session start notifications include clickable Web UI link:

```
▶️ [project-name] Session Started

📁 Project: D:\Project\...
🕐 Time: 2025-12-02 04:00:00
🔄 Trigger: cli

🔗 Open in Web UI  ← Click to open session
```

## Mobile Access

To access from phone on same network:

1. Find your computer's local IP (e.g., `192.168.100.8`)
2. Set `WEB_UI_URL` in `hooks/lib/config.py`
3. Access Web UI at `http://192.168.100.8:3000`

## Configuration Files

| File | Purpose |
|------|---------|
| `hooks/lib/config.py` | Hook settings (URLs, timeouts) |
| `telegram-bridge/.env` | Server settings (tokens, secrets) |
| `telegram-bridge/web/.env.local` | Web UI API URL |

## License

MIT
