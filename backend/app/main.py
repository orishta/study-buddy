"""StudyBuddy FastAPI application — entry point, middleware, and router registration."""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from dotenv import load_dotenv

from .database import engine, Base
from .routers import courses, materials, tasks, settings, schedule, ai_processing, calendar

load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    _run_migrations()
    # Warm up the user profile cache (sub-millisecond on subsequent requests)
    from services.profile_engine import load_profile
    load_profile()
    from services.scheduler import start_scheduler
    bg_tasks = start_scheduler()
    yield
    for t in bg_tasks:
        t.cancel()


def _run_migrations():
    """Safe incremental ALTER TABLE migrations — runs on every startup, idempotent."""
    migrations = [
        "ALTER TABLE courses ADD COLUMN syllabus_text TEXT",
        "ALTER TABLE user_settings ADD COLUMN telegram_chat_id TEXT",
        "ALTER TABLE user_settings ADD COLUMN telegram_bot_token TEXT",
        "ALTER TABLE user_settings ADD COLUMN gmail_client_id TEXT",
        "ALTER TABLE user_settings ADD COLUMN gmail_client_secret TEXT",
        "ALTER TABLE user_settings ADD COLUMN gmail_refresh_token TEXT",
    ]
    with engine.connect() as conn:
        for sql in migrations:
            try:
                conn.execute(text(sql))
                conn.commit()
            except Exception:
                pass  # column already exists


app = FastAPI(title="StudyBuddy API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # local-only app — no cookies or auth headers
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(courses.router)
app.include_router(materials.router)
app.include_router(tasks.router)
app.include_router(settings.router)
app.include_router(schedule.router)
app.include_router(ai_processing.router)
app.include_router(calendar.router)


@app.get("/health")
def health():
    return {"status": "ok"}
