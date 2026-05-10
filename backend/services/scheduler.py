"""
Background task scheduler for StudyBuddy.

start_scheduler() is called once from the FastAPI lifespan hook and returns
long-running asyncio tasks:
  - morning-brief    : fires send_morning_brief() each day at configured time
  - evening-feedback : fires send_evening_feedback_request() at 21:00 daily
  - telegram-poll    : polls Telegram getUpdates every 5 s and dispatches bot commands
  - gmail-sync       : scans Gmail inbox daily at 08:05 for assignment emails
"""
import asyncio
from datetime import datetime, timedelta

from app.database import SessionLocal
from app.models import UserSettings, CommunicationsCache


def _seconds_until(hour: int, minute: int) -> float:
    now = datetime.now()
    target = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
    if target <= now:
        target += timedelta(days=1)
    return (target - now).total_seconds()


async def _morning_brief_loop() -> None:
    from services.morning_brief import send_morning_brief

    while True:
        db = SessionLocal()
        try:
            s = db.query(UserSettings).first()
            summary_time = s.daily_summary_time if s else "08:00"
        finally:
            db.close()

        h, m = map(int, summary_time.split(":"))
        await asyncio.sleep(_seconds_until(h, m))

        try:
            await send_morning_brief()
        except Exception as exc:
            print(f"[morning-brief] error: {exc}")


async def _evening_feedback_loop() -> None:
    from services.morning_brief import send_evening_feedback_request

    while True:
        await asyncio.sleep(_seconds_until(21, 0))
        try:
            await send_evening_feedback_request()
        except Exception as exc:
            print(f"[evening-feedback] error: {exc}")


async def _telegram_poll_loop() -> None:
    from services.telegram_commands import dispatch_command, _get_token

    last_update_id: int = 0
    while True:
        try:
            if _get_token():
                last_update_id = await dispatch_command(last_update_id)
        except Exception as exc:
            print(f"[telegram-poll] {exc}")
        await asyncio.sleep(5)


async def _run_gmail_sync() -> None:
    """Fetch unread emails, parse for assignments, send Telegram notifications with inline buttons."""
    from services.gmail_client import fetch_unread_emails
    from services.email_parser import parse_email
    from services.telegram_client import send_message_with_keyboard

    db = SessionLocal()
    try:
        settings = db.query(UserSettings).first()
        if not settings or not settings.gmail_refresh_token:
            return
        if not settings.telegram_chat_id:
            return

        emails = await fetch_unread_emails(
            settings.gmail_refresh_token,
            settings.gmail_client_id,
            settings.gmail_client_secret,
        )

        for msg in emails:
            parsed = parse_email(msg)
            if not parsed:
                continue

            # Deduplicate by Gmail message ID
            existing = db.query(CommunicationsCache).filter_by(external_id=msg["id"]).first()
            if existing:
                continue

            cache = CommunicationsCache(
                source="Gmail",
                external_id=msg["id"],
                content_summary=parsed["title"],
                raw_snippet=msg["body"][:500],
                timestamp=msg["date"],
            )
            db.add(cache)
            db.commit()
            db.refresh(cache)

            deadline_str = parsed["deadline"].strftime("%d/%m") if parsed["deadline"] else "לא ידוע"
            text = (
                f"📧 מצאתי מטלה חדשה בדוא\"ל:\n\n"
                f"*{parsed['title']}*\n"
                f"מועד הגשה: {deadline_str}\n\n"
                "האם להוסיף לדשבורד ולפצל למשימות קטנות?"
            )
            keyboard = [[
                {"text": "✅ הוסף ופצל", "callback_data": f"email_add:{cache.id}"},
                {"text": "⏭ דלג", "callback_data": f"email_skip:{cache.id}"},
            ]]
            await send_message_with_keyboard(settings.telegram_chat_id, text, keyboard)
    finally:
        db.close()


async def _gmail_sync_loop() -> None:
    while True:
        await asyncio.sleep(_seconds_until(8, 5))
        try:
            await _run_gmail_sync()
        except Exception as exc:
            print(f"[gmail-sync] error: {exc}")


def start_scheduler() -> list[asyncio.Task]:
    """Create and return background tasks. Call from inside the FastAPI lifespan."""
    return [
        asyncio.create_task(_morning_brief_loop(), name="morning-brief"),
        asyncio.create_task(_evening_feedback_loop(), name="evening-feedback"),
        asyncio.create_task(_telegram_poll_loop(), name="telegram-poll"),
        asyncio.create_task(_gmail_sync_loop(), name="gmail-sync"),
    ]
