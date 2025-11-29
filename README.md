# Telegram-Droid Integration

Control Factory.ai Droid CLI remotely via Telegram and Web UI.

## Features

- **Telegram Bot**: Receive notifications and send commands via Telegram
- **Web Dashboard**: Real-time session monitoring and control
- **Multi-Session**: Manage multiple Droid instances simultaneously
- **Permission Requests**: Approve/deny tool executions remotely
- **Docker Ready**: Easy deployment with Docker Compose

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Telegram App  │◄───►│  Bridge Server   │◄───►│  Hook Scripts   │
│   (on Phone)    │     │  (FastAPI)       │     │  (Python)       │
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

### 2. Configure Environment

```bash
cd telegram-bridge
cp .env.example .env
# Edit .env with your bot token and chat ID
```

### 3. Install Hook Scripts

Copy hooks to your Factory.ai hooks directory:

```powershell
# Windows
Copy-Item -Path hooks\* -Destination "$env:USERPROFILE\.factory\hooks" -Recurse
```

### 4. Configure Droid

Copy the settings to your Factory.ai config:

```powershell
# Windows - Use the template and replace USERNAME
Copy-Item config\settings.template.json "$env:USERPROFILE\.factory\settings.json"
# Then edit the file to replace USERNAME with your Windows username
```

### 5. Start Bridge Server

```bash
cd telegram-bridge

# Option A: Docker (recommended)
docker-compose up -d

# Option B: Native Python
pip install -r requirements.txt
python server.py
```

### 6. Start Droid

```bash
droid
# You should receive a Telegram notification!
```

## Project Structure

```
droid-remote/
├── hooks/                      # Hook scripts for Droid
│   ├── lib/                    # Shared library
│   │   ├── bridge_client.py    # HTTP client for bridge
│   │   ├── config.py           # Configuration loader
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
│   ├── core/                   # Core modules
│   ├── utils/                  # Utilities
│   ├── web/                    # Next.js Web UI
│   ├── server.py               # Main entry point
│   ├── Dockerfile
│   └── docker-compose.yml
│
└── config/                     # Droid configuration
    ├── settings.json           # For user Eko Teguh Wicaksono
    └── settings.template.json  # Template for other users
```

## Telegram Commands

| Command | Description |
|---------|-------------|
| `/start` | Initialize bot |
| `/sessions` | List active sessions |
| `/status` | Check session status |
| `/switch <name>` | Switch active session |
| `/done` | End current session |
| `/broadcast <msg>` | Send to all waiting sessions |

## Web UI

Access the dashboard at `http://localhost:3000` (when running with Docker or `npm run dev`).

Features:
- Real-time session list
- Approve/deny permission requests
- Send instructions to sessions
- Activity feed

## License

MIT
