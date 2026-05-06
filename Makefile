.PHONY: setup backend frontend dev db-reset

setup:
	@echo "→ Installing backend dependencies..."
	cd backend && python3 -m venv venv && venv/bin/pip install -q -r requirements.txt
	@echo "→ Installing frontend dependencies..."
	cd frontend && npm install --silent
	@echo ""
	@echo "✓ StudyBuddy is ready. Run: make dev"

backend:
	cd backend && venv/bin/uvicorn app.main:app --reload --port 8000

frontend:
	cd frontend && npm run dev

dev:
	$(MAKE) -j2 backend frontend

db-reset:
	rm -f backend/studybuddy.db
	@echo "✓ Database wiped. Restart the backend to recreate it."
