"""Telegram Bot API client — token is read from the DB (set in Settings UI)."""
from typing import Optional
import httpx


def _get_token() -> str:
    """Return bot token from DB (preferred) or TELEGRAM_BOT_TOKEN env var (fallback)."""
    try:
        from app.database import SessionLocal
        from app.models import UserSettings
        db = SessionLocal()
        try:
            s = db.query(UserSettings).first()
            if s and s.telegram_bot_token:
                return s.telegram_bot_token
        finally:
            db.close()
    except Exception:
        pass
    import os
    return os.getenv("TELEGRAM_BOT_TOKEN", "")


def _base() -> str:
    token = _get_token()
    if not token:
        raise RuntimeError(
            "No Telegram bot token configured. "
            "Go to Settings → Telegram and paste your bot token."
        )
    return f"https://api.telegram.org/bot{token}"


async def send_message(chat_id: str, text: str) -> dict:
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(
            f"{_base()}/sendMessage",
            json={"chat_id": chat_id, "text": text, "parse_mode": "Markdown"},
        )
        resp.raise_for_status()
        return resp.json().get("result", {})


async def send_message_with_keyboard(
    chat_id: str,
    text: str,
    keyboard: list[list[dict]],
) -> dict:
    """Send a message with an inline keyboard.
    keyboard = [[{"text": "Label", "callback_data": "key:value"}, ...], ...]
    """
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(
            f"{_base()}/sendMessage",
            json={
                "chat_id": chat_id,
                "text": text,
                "parse_mode": "Markdown",
                "reply_markup": {"inline_keyboard": keyboard},
            },
        )
        resp.raise_for_status()
        return resp.json().get("result", {})


async def edit_message(
    chat_id: str,
    message_id: int,
    text: str,
    keyboard: Optional[list[list[dict]]] = None,
) -> None:
    """Edit an existing message (used to update subtask progress in-place)."""
    payload: dict = {
        "chat_id": chat_id,
        "message_id": message_id,
        "text": text,
        "parse_mode": "Markdown",
    }
    if keyboard is not None:
        payload["reply_markup"] = {"inline_keyboard": keyboard}
    else:
        payload["reply_markup"] = {"inline_keyboard": []}  # remove buttons

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(f"{_base()}/editMessageText", json=payload)
        # Telegram returns 400 if message content hasn't changed — that's OK
        if resp.status_code not in (200, 400):
            resp.raise_for_status()


async def answer_callback_query(callback_query_id: str, text: str = "") -> None:
    """Acknowledge an inline button press (required by Telegram API)."""
    async with httpx.AsyncClient(timeout=10) as client:
        await client.post(
            f"{_base()}/answerCallbackQuery",
            json={"callback_query_id": callback_query_id, "text": text},
        )


async def get_bot_username() -> str:
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(f"{_base()}/getMe")
        resp.raise_for_status()
        return "@" + resp.json()["result"]["username"]
