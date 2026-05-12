"""Calendar feed endpoints — ICS subscription and Google Calendar add URL."""
from __future__ import annotations

import socket
from datetime import date
from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import ClassSchedule, Task
from services.ics_generator import build_ics
from services.schedule_generator import generate_daily_plan
from services.profile_engine import load_profile

router = APIRouter(prefix="/calendar", tags=["calendar"])


def _today_dow() -> int:
    """0=Sunday convention."""
    return (date.today().weekday() + 1) % 7


def _base_url(request: Request) -> str:
    """Derive the base URL, preferring the request's own host."""
    host = request.headers.get("host", f"localhost:{request.url.port or 8000}")
    scheme = "http"  # local-only app
    return f"{scheme}://{host}"


# ── ICS feed ──────────────────────────────────────────────────────────────────


@router.get("/feed.ics")
def calendar_feed(db: Session = Depends(get_db)):
    """Dynamic ICS subscription endpoint — returns today's personalised schedule.

    Subscribe once via webcal://localhost:8000/calendar/feed.ics and your
    calendar app will refresh automatically (REFRESH-INTERVAL: 1h).
    """
    dow = _today_dow()
    classes = (
        db.query(ClassSchedule)
        .filter(ClassSchedule.day_of_week == dow, ClassSchedule.is_active == True)
        .order_by(ClassSchedule.start_time)
        .all()
    )
    tasks = (
        db.query(Task)
        .filter(Task.status.in_(["Todo", "In Progress"]), Task.parent_task_id == None)
        .order_by(Task.due_date.asc().nullslast(), Task.position)
        .limit(30)
        .all()
    )

    class_dicts = [
        {"start_time": c.start_time, "end_time": c.end_time, "subject_name": c.subject_name}
        for c in classes
    ]
    task_dicts = [
        {
            "id": t.id,
            "title": t.title,
            "status": t.status,
            "priority": t.priority,
            "due_date": t.due_date.isoformat() if t.due_date else None,
            "estimated_minutes": t.estimated_minutes,
        }
        for t in tasks
    ]

    profile = load_profile()
    blocks = generate_daily_plan(task_dicts, class_dicts, profile)
    ics_content = build_ics(blocks, cal_date=date.today())

    return Response(
        content=ics_content,
        media_type="text/calendar; charset=utf-8",
        headers={
            "Content-Disposition": 'attachment; filename="studybuddy.ics"',
            "Cache-Control": "no-cache, no-store, must-revalidate",
        },
    )


# ── Subscribe URL helper ───────────────────────────────────────────────────────


class SubscribeUrlOut:
    def __init__(self, webcal_url: str, google_url: str):
        self.webcal_url = webcal_url
        self.google_url = google_url


@router.get("/subscribe-url")
def subscribe_url(request: Request):
    """Return webcal:// and Google Calendar add URLs for one-click subscription."""
    base = _base_url(request)
    feed_path = "/calendar/feed.ics"
    webcal = base.replace("http://", "webcal://").replace("https://", "webcal://") + feed_path
    http_url = base + feed_path
    google = f"https://www.google.com/calendar/render?cid={http_url}"
    return {"webcal_url": webcal, "google_calendar_url": google, "feed_url": http_url}
