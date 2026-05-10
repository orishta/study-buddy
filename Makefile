.PHONY: setup backend frontend dev prod stop db-reset

# ── Setup ─────────────────────────────────────────────────────────────────────

setup:
	@echo "→ Installing backend dependencies..."
	cd backend && python3 -m venv venv && venv/bin/pip install -q -r requirements.txt
	@echo "→ Installing frontend dependencies..."
	cd frontend && npm install --silent
	@echo ""
	@echo "✓ StudyBuddy is ready. Run: make dev"

# ── Dev mode (hot-reload, higher RAM) ─────────────────────────────────────────

backend:
	cd backend && venv/bin/uvicorn app.main:app --reload --port 8000

frontend:
	cd frontend && npm run dev

dev:
	$(MAKE) -j2 backend frontend

# ── Production mode (~50% less RAM, no hot-reload) ────────────────────────────

backend-prod:
	cd backend && venv/bin/uvicorn app.main:app --port 8000 --workers 1

frontend-prod:
	cd frontend && npm run build && npm start

prod:
	$(MAKE) -j2 backend-prod frontend-prod

# ── Process management ────────────────────────────────────────────────────────

stop:
	@echo "→ Stopping StudyBuddy servers..."
	@lsof -ti:8000 | xargs kill -9 2>/dev/null || true
	@lsof -ti:3000 | xargs kill -9 2>/dev/null || true
	@echo "✓ Ports 8000 and 3000 freed."

# ── Database ──────────────────────────────────────────────────────────────────

db-reset:
	rm -f backend/studybuddy.db
	@echo "✓ Database wiped. Restart the backend to recreate it."
