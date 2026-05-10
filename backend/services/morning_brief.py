"""Assembles and sends the daily Telegram morning brief via Ollama."""
from datetime import date, datetime
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import ClassSchedule, Task, UserSettings
from services.ai_client import generate
from services.telegram_client import send_message

_DOW_NAMES = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"]


def _today_dow() -> int:
    """0=Sunday convention (Python weekday 0=Monday → shift by 1)."""
    return (date.today().weekday() + 1) % 7


def _gather_context(db: Session) -> dict:
    dow = _today_dow()
    classes = (
        db.query(ClassSchedule)
        .filter(ClassSchedule.day_of_week == dow, ClassSchedule.is_active == True)
        .order_by(ClassSchedule.start_time)
        .all()
    )
    now = datetime.utcnow()
    tasks_active = (
        db.query(Task)
        .filter(Task.status.in_(["Todo", "In Progress"]), Task.parent_task_id == None)
        .order_by(Task.due_date.asc().nullslast(), Task.position)
        .limit(20)
        .all()
    )
    overdue = [t for t in tasks_active if t.due_date and t.due_date < now]
    due_today = [t for t in tasks_active if t.due_date and t.due_date.date() == date.today()]
    in_progress = [t for t in tasks_active if t.status == "In Progress"]
    return {"classes": classes, "overdue": overdue, "due_today": due_today, "in_progress": in_progress}


def _build_prompt(ctx: dict, name: str, profile: dict | None) -> str:
    today_name = _DOW_NAMES[_today_dow()]
    today_str = date.today().strftime("%d/%m/%Y")

    profile_note = ""
    if profile:
        motivation = profile.get("motivation", "")
        style = profile.get("style", "")
        peak = profile.get("peak_time", "")
        parts = [p for p in [motivation, style, peak] if p]
        if parts:
            profile_note = f"\nStudent profile: {', '.join(parts)}."

    lines = [
        f"Student name: {name}.",
        profile_note,
        f"\nToday is {today_name}, {today_str}.",
        "\nCLASSES TODAY:",
    ]
    if ctx["classes"]:
        for c in ctx["classes"]:
            room = f" ({c.room})" if c.room else ""
            lines.append(f"- {c.start_time}–{c.end_time}: {c.subject_name}{room}")
    else:
        lines.append("- No classes today")

    lines.append("\nTASKS:")
    if ctx["overdue"]:
        lines.append("Overdue:")
        for t in ctx["overdue"]:
            lines.append(f"  ⚠ {t.title} (due {t.due_date.strftime('%d/%m')})")
    if ctx["due_today"]:
        lines.append("Due today:")
        for t in ctx["due_today"]:
            lines.append(f"  • {t.title}")
    if ctx["in_progress"]:
        lines.append("In progress:")
        for t in ctx["in_progress"]:
            lines.append(f"  → {t.title}")
    if not ctx["overdue"] and not ctx["due_today"] and not ctx["in_progress"]:
        lines.append("- No urgent tasks.")

    lines += [
        "\n---",
        "You are a warm, encouraging academic mentor.",
        "Write a short morning brief in Hebrew (3–5 sentences) that:",
        "1. Greets the student warmly by name",
        "2. Briefly summarises today (classes + key tasks)",
        "3. Gives ONE practical tip for the day",
        "Keep tone supportive. Output ONLY the Hebrew message — no labels, no code blocks.",
    ]
    return "\n".join(lines)


async def send_morning_brief() -> None:
    db = SessionLocal()
    try:
        settings = db.query(UserSettings).first()
        if not settings:
            return
        chat_id = getattr(settings, "telegram_chat_id", None)
        if not chat_id:
            return

        ctx = _gather_context(db)
        name = settings.display_name or "סטודנט"
        profile = settings.learning_style_profile or {}
        prompt = _build_prompt(ctx, name, profile)
        message = await generate(prompt)
        await send_message(chat_id, message.strip())
    finally:
        db.close()


async def send_evening_feedback_request() -> None:
    """Send an evening check-in asking how the study day went."""
    db = SessionLocal()
    try:
        settings = db.query(UserSettings).first()
        if not settings:
            return
        chat_id = getattr(settings, "telegram_chat_id", None)
        if not chat_id:
            return

        name = settings.display_name or "סטודנט"
        tasks_done_today = (
            db.query(Task)
            .filter(
                Task.status == "Done",
                Task.completed_at >= datetime.utcnow().replace(hour=0, minute=0, second=0),
            )
            .count()
        )

        msg = (
            f"ערב טוב {name} 🌙\n\n"
            f"סיימת {tasks_done_today} משימות היום 🎉\n\n"
            "איך הלכו הלימודים? ספר לי בקצרה מה הרגשת — זה עוזר לי להבין איך לתמוך בך טוב יותר."
        )
        await send_message(chat_id, msg)
    finally:
        db.close()
