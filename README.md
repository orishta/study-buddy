# StudyBuddy

> A privacy-first, fully local academic dashboard built for students who struggle with executive functioning - no cloud, no subscriptions, no data leaving your machine.

**Stack:** Next.js 14 · FastAPI · SQLite · Tailwind CSS · framer-motion · React Query · Zustand

---

## What is this?

StudyBuddy is a personal productivity tool designed specifically for students. It replaces the chaos of scattered WhatsApp reminders, Google Calendar events, and sticky notes with a single unified dashboard that understands academic workflows.

The core design philosophy is **local-first and offline-capable** - every feature works without an internet connection. AI capabilities default to a zero-network rule engine; cloud models are an opt-in upgrade stored in your OS keychain, never in the app.

---

## Features

| Feature | Status | Notes |
|---------|--------|-------|
| Kanban task board (drag-and-drop) | ✅ Shipped | Subtasks, priorities, due dates, per-course filtering |
| Weekly timetable | ✅ Shipped | Import via iCal URL, CSV, or Excel; edit slots inline |
| Course management | ✅ Shipped | Per-course material tracker with self-rated understanding levels |
| AI syllabus parser | ✅ Shipped | Paste/upload syllabus → auto-extract topic list |
| Gamified Focus Timer | ✅ Shipped | Circular Pomodoro timer, 7 unlockable badges, penguin mascot |
| Executive-functioning onboarding | ✅ Shipped | 8-question diagnostic quiz → personalised AI profile |
| Offline rule-based mentor | ✅ Shipped | "What should I do right now?" - works with zero network |
| ICS calendar subscription feed | ✅ Shipped | `webcal://` feed, auto-refreshes hourly in any calendar app |
| Telegram morning brief | ✅ Shipped | Daily briefing with schedule + tasks, fully rule-based |
| Telegram bot commands | ✅ Shipped | `/today`, `/tasks`, `/help` |
| Gmail integration | ✅ Shipped | Scans inbox for assignments, one-tap Telegram card to add task |
| AI provider routing | ✅ Shipped | Anthropic → OpenAI → Ollama fallback, keys in OS keychain |
| macOS `.app` bundle | ✅ Shipped | Double-click to launch, ready for Dock |
| Windows / Linux launchers | ✅ Shipped | `launch.bat`, `start.sh` |
| **Smart Daily Planner (Telegram)** | 🚧 In progress | Profile-driven schedule blocks sent each morning via bot |
| **"Fix my day" one-tap reschedule** | 🔜 Planned | Detect overloaded days and propose a rebalanced plan |
| **Spaced-repetition review reminders** | 🔜 Planned | Based on material understanding levels + time since last review |
| **iOS shortcut integration** | 🔜 Planned | Add task to dashboard from iPhone Share Sheet |
| **Multi-user / shared study groups** | 🔜 Planned | Architecture supports it; UI not built yet |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Browser - Next.js 14 App Router                            │
│  React Query (server state) · Zustand (UI state)            │
│  Tailwind CSS · framer-motion · dnd-kit                     │
└───────────────────┬─────────────────────────────────────────┘
                    │  REST / JSON  (localhost:8000)
┌───────────────────▼─────────────────────────────────────────┐
│  FastAPI + SQLAlchemy 2.0 + SQLite                          │
│                                                             │
│  ┌──────────────────┐  ┌──────────────────────────────────┐ │
│  │  Profile Engine  │  │  Schedule Generator               │ │
│  │  (rule-based,    │  │  (class slots + tasks → time      │ │
│  │   zero network)  │  │   blocks personalised to profile) │ │
│  └──────────────────┘  └──────────────────────────────────┘ │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  AI Router: Anthropic → OpenAI → Ollama              │   │
│  │  Keys stored in OS keychain (keyring library)        │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  Background tasks (asyncio):                                │
│    • Morning brief loop (daily at 08:00)                   │
│    • Telegram poll loop (every 3 s)                        │
│    • Gmail sync loop (daily at 08:05)                      │
└───────────────────┬─────────────────────────────────────────┘
                    │
        ┌───────────┼──────────────┐
        ▼           ▼              ▼
   SQLite DB   Telegram API    Gmail API
  (local only)  (optional)    (readonly OAuth)
```

### Why SQLite?

A local student dashboard has one user and thousands (not millions) of rows. SQLite eliminates infrastructure entirely - no Docker, no Postgres, no connection pool. The database is a single file you can copy, back up, or delete. FastAPI's `StaticPool` + `check_same_thread=False` makes it thread-safe with SQLAlchemy.

### Why FastAPI?

Pydantic v2 gives us runtime type validation for free. FastAPI's lifespan context manager gives clean startup/shutdown hooks for background asyncio tasks. The auto-generated OpenAPI docs (`/docs`) are a bonus for development.

### Why Next.js App Router over a SPA?

Server components allow the HTML shell to render instantly on first load. The `"use client"` boundary is explicit - only components that actually need browser APIs opt in to the JS bundle. React Query handles cache invalidation so the UI stays fresh without polling.

---

## The Algorithmic Choices (explained plainly)

### Why not use an LLM for everything?

The original prototype used Ollama (a local LLM runner). It worked, but had two problems:

1. **Setup friction** - users had to install Ollama separately, pull a model (1–8 GB), wait for it to load, and hope it responded in under 30 seconds.
2. **Flakiness** - LLMs are probabilistic. The same question can produce wildly different advice, which is actively harmful for someone with executive dysfunction who needs *predictable* structure.

The replacement is a **Weighted Scoring Engine** - a deterministic rule-based system that is faster, more predictable, and requires zero network access.

### The Executive Functioning Profile

Students with ADHD, dyslexia, or anxiety-related executive dysfunction don't all need the same study structure. A single "25 minutes Pomodoro" advice ignores this. The onboarding questionnaire scores the user on **5 clinical dimensions**:

| Dimension | What it measures | Effect on the app |
|-----------|-----------------|-------------------|
| `initiation_difficulty` | How hard it is to start a task | High score → 5-min warmup block before each work session |
| `sustained_attention` | How long focus holds before breaking | High score → shorter work blocks (15 min instead of 50) |
| `reading_load` | Reading stamina | High score → bullet-point output instead of paragraphs |
| `time_blindness` | Losing track of time | High score → countdown timer shown prominently |
| `overwhelm_sensitivity` | Shutting down from too many tasks | High score → hide all but the 3 most urgent tasks |

Plus 3 categorical preferences: **motivation style** (intrinsic / social / deadline / gamified), **peak time** (morning / midday / afternoon / evening), and **break style** (Pomodoro / deep work / flow / micro).

The questionnaire maps answers to these dimensions using additive scoring (each answer adds a delta to one or more dimensions). The result is a `UserProfile` dataclass written to `user_profile.json` on the first run and loaded into RAM on every subsequent start - sub-millisecond access, no database query needed.

### The Daily Schedule Generator

Given a list of class slots and active tasks, the schedule generator fills the free windows between classes with **work blocks, warmup blocks, and break blocks**. The logic:

1. Extract class slots from the DB and sort them chronologically.
2. Find the free windows between them (and before/after the day boundaries).
3. Sort tasks by urgency: Overdue → High priority → In Progress → Medium → Low.
4. If `overwhelm_sensitivity ≥ 4`, cap the visible task list at 3 items.
5. For each free window, alternate: warmup (optional) → work block → break → work block → break… until the window fills or tasks run out.
6. Work block duration is derived from `sustained_attention` and `break_style` (e.g., Pomodoro profile with high attention difficulty → 15 min blocks).

This is O(n log n) in the number of tasks and O(k) in the number of schedule slots - fast enough to re-run on every page load.

### The ICS Feed (no OAuth)

Instead of requiring users to grant Google Calendar access (which involves OAuth scopes, refresh tokens, and rate limits), the app exposes a `webcal://localhost:8000/calendar/feed.ics` endpoint. The user subscribes once in their calendar app; the app generates a fresh ICS file on every request. Calendar apps like Google Calendar poll subscribed feeds hourly automatically. 

UIDs in the ICS file are generated with `uuid.uuid5` (deterministic from date + event label), so repeated fetches don't create duplicate events.

### The AI Routing Stack

When a remote API key is present, the app prefers it (better quality responses). When it's not, it falls back to a locally running Ollama instance. When Ollama isn't available either, the profile engine's rule-based generator kicks in. This means the mentor feature *always works*, regardless of connectivity or Ollama status.

```
User asks "what should I do right now?"
    │
    ▼
Anthropic API key set?  ──yes──▶  claude-haiku-4-5 (fast, cheap)
    │ no
    ▼
OpenAI API key set?     ──yes──▶  gpt-4o-mini
    │ no
    ▼
Ollama running locally? ──yes──▶  qwen2.5:7b or aya-expanse:8b
    │ no
    ▼
Profile Engine          ──────▶  rule-based advice (always available)
```

API keys are stored via the `keyring` library, which routes to:
- macOS Keychain on Mac
- Windows Credential Manager on Windows
- libsecret / KWallet on Linux

Keys are **never** stored in the database or `.env` file.

### The Beep Sound (Web Audio API)

The focus timer alerts you with an audible "beep beep beep" when you switch tabs during a session. This uses the Web Audio API's `OscillatorNode` - a sine wave at 880 Hz fired three times with a linear gain envelope. No audio file is needed; the browser synthesises the tone from scratch. This keeps the project dependency-free and the bundle small.

---

## Project Structure

```
studybuddy/
├── backend/
│   ├── app/
│   │   ├── main.py                  # FastAPI app, lifespan, startup migrations
│   │   ├── models.py                # SQLAlchemy ORM (UserSettings, Course, Task, …)
│   │   ├── schemas.py               # Pydantic v2 request/response models
│   │   ├── database.py              # Engine, SessionLocal, get_db dependency
│   │   └── routers/
│   │       ├── courses.py           # Course CRUD + task-count aggregation
│   │       ├── tasks.py             # Task CRUD, status patch, drag-and-drop reorder
│   │       ├── materials.py         # Material tracker per course
│   │       ├── schedule.py          # Class slots CRUD, CSV/Excel/iCal import
│   │       ├── settings.py          # Settings singleton (GET + PUT)
│   │       ├── ai_processing.py     # Mentor, questionnaire, Telegram, syllabus
│   │       └── calendar.py          # ICS feed + subscribe URL
│   └── services/
│       ├── profile_engine.py        # Questionnaire scoring + rule-based advice
│       ├── schedule_generator.py    # Daily plan builder (work/break/warmup blocks)
│       ├── ics_generator.py         # VCALENDAR string builder
│       ├── ai_client.py             # Unified AI router (Anthropic → OpenAI → Ollama)
│       ├── keyring_store.py         # OS keychain wrapper with env-var fallback
│       ├── scheduler.py             # Background asyncio task loops
│       ├── morning_brief.py         # Daily Telegram message generator
│       ├── telegram_commands.py     # Bot command + callback_query dispatch
│       ├── telegram_client.py       # Raw httpx helpers for Telegram Bot API
│       ├── gmail_client.py          # Gmail OAuth2 + message fetching
│       ├── email_parser.py          # Local NLP for assignment/deadline detection
│       ├── schedule_parser.py       # iCal / CSV / Excel → slot dicts
│       └── ollama_client.py         # Ollama chat wrapper (syllabus extraction)
├── frontend/
│   ├── app/
│   │   ├── page.tsx                 # Dashboard (Kanban + stats)
│   │   ├── schedule/page.tsx        # Weekly timetable
│   │   ├── focus/page.tsx           # Gamified focus timer
│   │   ├── courses/[id]/page.tsx    # Per-course view
│   │   ├── settings/page.tsx        # All settings panels
│   │   └── onboarding/page.tsx      # First-run wizard
│   ├── components/
│   │   ├── layout/Sidebar.tsx       # Collapsible sidebar with course CRUD
│   │   ├── kanban/                  # Drag-and-drop board
│   │   ├── tasks/                   # Task dialog, task card
│   │   ├── courses/                 # Course form, course card, syllabus dialog
│   │   ├── schedule/                # Timetable grid, slot editor, import dialog
│   │   ├── MentorBox.tsx            # "Feeling lost?" floating panel
│   │   ├── OnboardingGate.tsx       # Redirect to onboarding if not done
│   │   └── providers.tsx            # React Query + Zustand providers
│   └── lib/
│       ├── api.ts                   # Type-safe API client
│       ├── types.ts                 # Shared TypeScript interfaces
│       ├── store.ts                 # Zustand UI state
│       └── utils.ts                 # cn(), color helpers
├── Makefile                         # Setup, dev, prod, stop commands
├── StudyBuddy.app/                  # macOS application bundle
├── launch.command                   # macOS terminal launcher
├── launch.bat                       # Windows launcher
├── start.sh                         # Linux / alternative macOS launcher
└── .env.example                     # Documented configuration template
```

---

## Quick Start

### Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Python | 3.11+ | [python.org](https://python.org) |
| Node.js | 18+ | [nodejs.org](https://nodejs.org) |
| Ollama | latest | [ollama.com](https://ollama.com) - optional, for AI |

### macOS / Linux

```bash
git clone https://github.com/orishta/study-buddy.git studybuddy
cd studybuddy
cp .env.example .env          # defaults work out of the box
make setup                    # installs Python venv + npm deps
make dev                      # starts backend :8000 + frontend :3000
```

Open [http://localhost:3000](http://localhost:3000) - the onboarding wizard runs automatically.

**One-click launchers:**
- **macOS** - double-click `StudyBuddy.app` (right-click → Open on first run) or `launch.command`
- **Linux** - `./start.sh`
- **Windows** - double-click `launch.bat`

### Windows

```bat
git clone https://github.com/orishta/study-buddy.git studybuddy
cd studybuddy
copy .env.example .env
make setup
make dev
```

*Requires GNU Make - install via [Chocolatey](https://chocolatey.org): `choco install make`*

---

## Configuration

| Variable | Default | Purpose |
|----------|---------|---------|
| `DATABASE_URL` | `sqlite:///./studybuddy.db` | SQLite file path |
| `OLLAMA_HOST` | `http://localhost:11434` | Local Ollama URL |
| `OLLAMA_MODEL` | `qwen2.5:7b` | Model for syllabus extraction |
| `ANTHROPIC_API_KEY` | _(blank)_ | Optional - stored in OS keychain via Settings UI |
| `OPENAI_API_KEY` | _(blank)_ | Optional - stored in OS keychain via Settings UI |
| `TELEGRAM_BOT_TOKEN` | _(blank)_ | From [@BotFather](https://t.me/BotFather) |
| `GMAIL_CLIENT_ID` | _(blank)_ | Google OAuth Desktop app credentials |
| `GMAIL_CLIENT_SECRET` | _(blank)_ | Google OAuth Desktop app credentials |

---

## Make Commands

| Command | What it does |
|---------|-------------|
| `make setup` | Create Python venv + install all deps |
| `make dev` | Hot-reload backend + frontend (development) |
| `make prod` | Build Next.js + run both servers in production mode |
| `make stop` | Kill anything running on ports 8000 and 3000 |
| `make backend` | Backend only |
| `make frontend` | Frontend only |
| `make db-reset` | Wipe the database and start fresh |

---

## Privacy

- **All data is local.** `backend/studybuddy.db` is a file on your machine. Nothing is uploaded anywhere.
- **AI is offline by default.** The rule-based profile engine and schedule generator work with zero network calls. Ollama (if installed) also runs entirely locally.
- **No telemetry, no analytics, no crash reporting** of any kind.
- **Gmail is readonly.** The OAuth scope is `gmail.readonly`. The refresh token lives in your local SQLite DB.
- **API keys live in your OS keychain.** They are never stored in the app database or committed to `.env`.
- **Telegram** is the only external network call if configured - and only for messages you explicitly request.

---

## Tech Decisions Log

| Decision | Alternatives considered | Why this one |
|----------|------------------------|--------------|
| SQLite | PostgreSQL, MongoDB | Single user, zero infrastructure - one file, zero config |
| FastAPI | Flask, Django | Native async, Pydantic v2, auto OpenAPI, lifespan hooks |
| Next.js App Router | Vite + React SPA | Server-side shell renders instantly; explicit client boundary |
| React Query | Redux, SWR, Zustand | Purpose-built for server state; stale-while-revalidate OOB |
| framer-motion | CSS transitions | Composable `AnimatePresence` for mount/unmount animations |
| dnd-kit | react-beautiful-dnd | Maintained, tree-shakeable, accessible, no drag-handle issues |
| Weighted scoring engine | LLM, Decision Tree, k-NN | Zero training data, deterministic, sub-ms, works offline |
| `keyring` library | `.env` secrets, SQLite | OS keychain is the right place for credentials |
| ICS subscription feed | Google Calendar API | No OAuth dance, works with every calendar app, self-refreshes |
| Web Audio API for beep | Audio file | Zero dependency, zero network, synthesised in browser |

---

## Built with Claude Code

This project was designed and built iteratively using [Claude Code](https://claude.ai/code) by Anthropic - an agentic coding tool that can plan, implement, and refactor across multiple files in a single session.
