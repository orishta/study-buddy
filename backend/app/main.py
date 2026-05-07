import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from dotenv import load_dotenv

from .database import engine, Base
from .routers import courses, materials, tasks, settings, schedule, ai_processing

load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    # Safe incremental migrations for columns added after initial DB creation
    _run_migrations()
    yield


def _run_migrations():
    migrations = [
        "ALTER TABLE courses ADD COLUMN syllabus_text TEXT",
    ]
    with engine.connect() as conn:
        for sql in migrations:
            try:
                conn.execute(text(sql))
                conn.commit()
            except Exception:
                pass  # column already exists


app = FastAPI(title="StudyBuddy API", version="1.0.0", lifespan=lifespan)

allowed_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(courses.router)
app.include_router(materials.router)
app.include_router(tasks.router)
app.include_router(settings.router)
app.include_router(schedule.router)
app.include_router(ai_processing.router)


@app.get("/health")
def health():
    return {"status": "ok"}
