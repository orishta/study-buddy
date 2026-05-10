# StudyBuddy

A personal, local-first academic dashboard built for focus and clarity.

## Stack

- **Frontend** — Next.js 14, TypeScript, Tailwind CSS
- **Backend** — FastAPI, SQLAlchemy, SQLite
- **AI** — Ollama (qwen2.5:7b, runs fully offline)
- **No external API costs. No data leaving your machine.**

## Quick Start

```bash
cp .env.example .env   # check defaults, usually fine as-is
make setup             # install all dependencies
make dev               # start backend :8000 + frontend :3000
```

Then open [http://localhost:3000](http://localhost:3000).

## Commands

| Command | What it does |
|---------|-------------|
| `make setup` | Install Python venv + npm deps |
| `make dev` | Run backend + frontend concurrently |
| `make backend` | Backend only (port 8000) |
| `make frontend` | Frontend only (port 3000) |
| `make db-reset` | Wipe the SQLite database |

## Features

- **Phase 1** ✅ Kanban board, course management, material tracker
- **Phase 2** ✅ Telegram bot — morning brief, /today, /tasks, Ollama mentor chat
- **Phase 3** ✅ Gmail integration — OAuth2, daily inbox scan, inline task creation
- **Phase 4** ✅ Schedule import — paste iCal/yedion URL or upload CSV/Excel
- **Phase 5** 🔜 Focus mode, planner view, analytics
