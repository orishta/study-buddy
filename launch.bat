@echo off
cd /d "%~dp0"
echo StudyBuddy -- Starting...
start "StudyBuddy Backend" cmd /k "cd backend && venv\Scripts\activate && uvicorn app.main:app --reload --port 8000"
timeout /t 3 /nobreak >nul
start "StudyBuddy Frontend" cmd /k "cd frontend && npm run dev"
timeout /t 5 /nobreak >nul
start "" "http://localhost:3000"
