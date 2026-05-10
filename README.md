# StudyBuddy

> A local-first academic dashboard: Kanban task board, weekly timetable, material tracker, and an optional Telegram bot — all running on your own machine, no cloud required.

---

## Features

- **Kanban board** — drag-and-drop tasks across Todo / In Progress / Done, with subtasks and due dates
- **Course management** — per-course material tracker with star-rated understanding levels
- **Weekly timetable** — import your schedule via iCal URL (yedion/MTA), CSV, or Excel
- **Telegram bot** — morning brief, `/today`, `/tasks`, `/help`, and an Ollama-powered Hebrew mentor chat
- **Gmail integration** — daily inbox scan for assignment emails; one-tap task creation with subtask chunking via inline Telegram buttons
- **AI syllabus parser** — paste a syllabus and auto-extract topic list into the material tracker

---

## Architecture

```
Browser (Next.js 14)
    │  REST / JSON
    ▼
FastAPI + SQLAlchemy (SQLite)
    │
    ├── Ollama sidecar  ← local LLM, no data leaves your machine
    ├── Telegram Bot API ← optional polling loop
    └── Gmail API       ← optional, readonly OAuth scope
```

All persistent data lives in `backend/studybuddy.db` (SQLite). Nothing is sent to any external service unless you explicitly configure Telegram or Gmail credentials.

---

## Project Structure

```
studybuddy/
├── backend/
│   ├── app/
│   │   ├── main.py          # FastAPI app, lifespan, migrations
│   │   ├── models.py        # SQLAlchemy ORM models
│   │   ├── schemas.py       # Pydantic v2 schemas
│   │   ├── database.py      # Engine, session, get_db
│   │   └── routers/
│   │       ├── courses.py
│   │       ├── tasks.py
│   │       ├── materials.py
│   │       ├── schedule.py
│   │       ├── settings.py
│   │       └── ai_processing.py
│   ├── services/
│   │   ├── scheduler.py         # Background loops (morning brief, Telegram poll, Gmail sync)
│   │   ├── telegram_commands.py # Bot command dispatch & callback handling
│   │   ├── telegram_client.py   # Raw httpx helpers for Telegram API
│   │   ├── gmail_client.py      # Gmail OAuth2 + message fetching
│   │   ├── email_parser.py      # Local NLP for assignment detection
│   │   ├── schedule_parser.py   # iCal / CSV / Excel → slot dicts
│   │   ├── ollama_client.py     # Ollama chat wrapper
│   │   └── morning_brief.py     # Daily summary generator
│   └── requirements.txt
├── frontend/
│   ├── app/                 # Next.js App Router pages
│   ├── components/          # React components
│   └── lib/                 # API client, types, utils
├── Makefile
├── launch.command           # macOS double-click launcher
├── launch.bat               # Windows double-click launcher
├── start.sh                 # Linux / alternative macOS launcher
└── .env.example
```

---

## Quick Start

### Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Python | 3.11+ | |
| Node.js | 18+ | |
| Ollama | latest | Optional — only needed for AI features |

### macOS / Linux

```bash
# 1. Clone and configure
git clone <repo-url> studybuddy
cd studybuddy
cp .env.example .env          # edit if needed — defaults work out of the box

# 2. Install dependencies
make setup

# 3. Start
make dev                      # backend :8000 + frontend :3000
```

Then open [http://localhost:3000](http://localhost:3000).

**One-click options:**
- **macOS** — double-click `StudyBuddy.app` (add to Dock or Applications for easy access), or double-click `launch.command`
- **Linux** — run `./start.sh`
- **Windows** — double-click `launch.bat`

> First run on macOS: right-click `StudyBuddy.app` → Open (bypasses Gatekeeper). After that, double-click works freely.

### Windows

```bat
:: 1. Clone and configure
git clone <repo-url> studybuddy
cd studybuddy
copy .env.example .env

:: 2. Install dependencies
make setup   :: requires GNU Make; install via Chocolatey: choco install make

:: 3. Start
make dev
```

**Or** double-click `launch.bat` — opens two terminal windows and then your browser.

---

## Configuration

All configuration lives in `.env` (copy from `.env.example`). The app runs without any API keys — Ollama provides local AI.

| Variable | Default | Purpose |
|----------|---------|---------|
| `DATABASE_URL` | `sqlite:///./studybuddy.db` | SQLite path |
| `ALLOWED_ORIGINS` | `http://localhost:3000` | CORS origin for frontend |
| `OLLAMA_HOST` | `http://localhost:11434` | Ollama API base URL |
| `OLLAMA_MODEL` | `qwen2.5:7b` | Model name (`aya-expanse:8b` for Hebrew) |
| `ANTHROPIC_API_KEY` | _(blank)_ | Optional remote AI fallback |
| `OPENAI_API_KEY` | _(blank)_ | Optional remote AI fallback |
| `GEMINI_API_KEY` | _(blank)_ | Optional remote AI fallback |
| `TELEGRAM_BOT_TOKEN` | _(blank)_ | From @BotFather — enables the bot |
| `GMAIL_CLIENT_ID` | _(blank)_ | Google OAuth Desktop app credentials |
| `GMAIL_CLIENT_SECRET` | _(blank)_ | Google OAuth Desktop app credentials |

### Setting up Telegram (optional)

1. Message [@BotFather](https://t.me/BotFather) → `/newbot` → copy the token into `TELEGRAM_BOT_TOKEN`
2. Start the app, go to **Settings** in the dashboard
3. Send any message to your bot — it auto-detects your chat ID
4. The morning brief fires at 08:00. Send `/help` for available commands.

### Setting up Gmail (optional)

1. [Google Cloud Console](https://console.cloud.google.com) → New project → Enable Gmail API
2. Create OAuth credentials (type: **Desktop app**) → download client ID and secret
3. Enter them on the **Settings** page, save
4. Send `/connect_gmail` in Telegram → follow the browser link → done

---

## Make Commands

| Command | What it does |
|---------|-------------|
| `make setup` | Install Python venv + npm deps |
| `make dev` | Run backend + frontend in dev mode (hot-reload) |
| `make prod` | Build Next.js and run both servers in production mode (~50% less RAM) |
| `make stop` | Kill any running servers on ports 8000 and 3000 |
| `make backend` | Backend only (port 8000, dev mode) |
| `make frontend` | Frontend only (port 3000, dev mode) |
| `make db-reset` | Wipe the SQLite database and restart fresh |

---

## Privacy

- **All data is local.** Everything is stored in `backend/studybuddy.db` on your machine.
- **AI is local by default.** Ollama runs offline — no prompts or responses leave your machine unless you configure a remote API key.
- **Gmail is readonly.** The OAuth scope is `gmail.readonly`. The refresh token is stored in your local SQLite DB only.
- **No telemetry.** No analytics, no crash reporting, no usage tracking of any kind.
- **Telegram** is the only external network call in the default setup (if configured). It receives only the text you explicitly send via bot commands.

---

## Built with Claude Code

This project was built with the assistance of [Claude Code](https://claude.ai/code) by Anthropic.
