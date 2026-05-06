# StudyBuddy

A personal, local-first academic dashboard built for focus and clarity.

## Stack

- **Frontend** — Next.js 14, TypeScript, Tailwind CSS, shadcn/ui
- **Backend** — FastAPI, SQLAlchemy, SQLite
- **AI** — Ollama (phi3:mini, runs fully offline)
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

## Phases

- **Phase 1** ✅ Kanban board, course management, material tracker
- **Phase 2** 🔜 AI task chunking, study debrief, weekly mentor (Ollama)
- **Phase 3** 🔜 Google Calendar + Gmail sync
- **Phase 4** 🔜 WhatsApp morning briefing + deadline nagging
- **Phase 5** 🔜 Focus mode, planner view, analytics
