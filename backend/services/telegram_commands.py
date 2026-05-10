"""
Telegram bot command dispatcher.

Reads pending updates from Telegram, handles /commands, inline-button callbacks,
and free-form chat (answered by Ollama). Called by the scheduler every 15 seconds.

Privacy guarantee: every interaction except /start is silently ignored unless
the sender's chat_id matches the registered telegram_chat_id in UserSettings.

Commands:
  /start <code>     — deep-link connection flow; registers chat_id
  /today            — send morning brief right now
  /tasks            — list active tasks (Todo + In Progress)
  /scan_gmail       — trigger Gmail inbox scan immediately (for testing)
  /connect_gmail    — start Gmail OAuth flow (opens browser on same machine)
  /help             — show available commands

Callback data keys:
  email_add:<cache_id>       — confirm & add Gmail-found task to dashboard
  email_skip:<cache_id>      — dismiss Gmail-found task
  subtask_done:<subtask_id>  — mark subtask as done, update message counter
"""
import asyncio
import secrets
import time
from datetime import date, datetime

import httpx

from app.database import SessionLocal
from app.models import ClassSchedule, CommunicationsCache, Task, UserSettings

# One-time start codes for deep-link registration (10-min TTL)
_pending_codes: dict[str, float] = {}

# Per-session conversation history for free-form Ollama chat (cleared on restart)
_chat_history: list[dict] = []
_MAX_HISTORY = 12


# ── Start-code helpers ─────────────────────────────────────────────────────────

def generate_start_code() -> str:
    _cleanup_expired()
    code = secrets.token_urlsafe(8)
    _pending_codes[code] = time.time() + 600
    return code


def _cleanup_expired() -> None:
    now = time.time()
    for k in [k for k, v in _pending_codes.items() if v < now]:
        del _pending_codes[k]


# ── DB helpers ─────────────────────────────────────────────────────────────────

def _get_token() -> str:
    from services.telegram_client import _get_token as _client_token
    return _client_token()


def _get_registered_chat_id() -> str | None:
    db = SessionLocal()
    try:
        s = db.query(UserSettings).first()
        return str(s.telegram_chat_id) if s and s.telegram_chat_id else None
    finally:
        db.close()


def _save_chat_id(chat_id: str) -> None:
    db = SessionLocal()
    try:
        s = db.query(UserSettings).first()
        if s:
            s.telegram_chat_id = chat_id
            db.commit()
    finally:
        db.close()


def _get_gmail_credentials() -> tuple[str | None, str | None, str | None]:
    """Returns (client_id, client_secret, refresh_token) from DB."""
    db = SessionLocal()
    try:
        s = db.query(UserSettings).first()
        if not s:
            return None, None, None
        return s.gmail_client_id, s.gmail_client_secret, s.gmail_refresh_token
    finally:
        db.close()


def _save_gmail_refresh_token(token: str) -> None:
    db = SessionLocal()
    try:
        s = db.query(UserSettings).first()
        if s:
            s.gmail_refresh_token = token
            db.commit()
    finally:
        db.close()


def _build_task_list() -> str:
    db = SessionLocal()
    try:
        tasks = (
            db.query(Task)
            .filter(Task.status.in_(["Todo", "In Progress"]), Task.parent_task_id == None)
            .order_by(Task.due_date.asc().nullslast(), Task.position)
            .limit(15)
            .all()
        )
        if not tasks:
            return "אין משימות פעילות כרגע 🎉"
        lines = []
        for t in tasks:
            icon = "🔄" if t.status == "In Progress" else "📌"
            due = f" (עד {t.due_date.strftime('%d/%m')})" if t.due_date else ""
            lines.append(f"{icon} {t.title}{due}")
        return "משימות פעילות:\n" + "\n".join(lines)
    finally:
        db.close()


def _build_chat_system_prompt() -> str:
    db = SessionLocal()
    try:
        settings = db.query(UserSettings).first()
        name = settings.display_name if settings else "סטודנט"
        profile = settings.learning_style_profile if settings else {}

        dow = (date.today().weekday() + 1) % 7
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
            .limit(10)
            .all()
        )

        profile_note = ""
        if profile:
            parts = [f"{k}={v}" for k, v in profile.items() if v]
            profile_note = " | ".join(parts)

        schedule_txt = (
            "\n".join(f"- {c.start_time}–{c.end_time}: {c.subject_name}" for c in classes)
            or "אין שיעורים היום"
        )
        tasks_txt = (
            "\n".join(
                f"- [{t.status}] {t.title}" + (f" (עד {t.due_date.strftime('%d/%m')})" if t.due_date else "")
                for t in tasks
            )
            or "אין משימות פעילות"
        )

        return (
            f"אתה מנטור לימודי אישי וחם של {name}. "
            "ענה תמיד בעברית בלבד, בשפה טבעית וידידותית.\n"
            + (f"פרופיל הסטודנט: {profile_note}\n" if profile_note else "")
            + f"לוח זמנים היום:\n{schedule_txt}\n"
            f"משימות פעילות:\n{tasks_txt}\n"
            "תן עצות קצרות וממוקדות. אל תמציא מידע שלא קיים."
        )
    finally:
        db.close()


# ── Telegram API ───────────────────────────────────────────────────────────────

def _tg_base() -> str:
    token = _get_token()
    return f"https://api.telegram.org/bot{token}" if token else ""


async def _get_updates(offset: int) -> list[dict]:
    base = _tg_base()
    if not base:
        return []
    async with httpx.AsyncClient(timeout=12) as client:
        # Use POST + JSON so allowed_updates is sent as a proper JSON array
        resp = await client.post(
            f"{base}/getUpdates",
            json={
                "offset": offset,
                "timeout": 0,
                "allowed_updates": ["message", "callback_query"],
            },
        )
        resp.raise_for_status()
        return resp.json().get("result", [])


async def _reply(chat_id: int | str, text: str) -> None:
    from services.telegram_client import send_message
    await send_message(str(chat_id), text)


# ── Command handlers ───────────────────────────────────────────────────────────

async def _handle_start(chat_id: int | str, text: str) -> None:
    parts = text.strip().split()
    code = parts[1] if len(parts) > 1 else None

    if code and code in _pending_codes and time.time() < _pending_codes[code]:
        del _pending_codes[code]
        _save_chat_id(str(chat_id))
        await _reply(
            chat_id,
            "✅ *StudyBuddy מחובר!*\n\n"
            "כל בוקר תקבל כאן בריף עם לוח הזמנים שלך והמשימות הדחופות.\n\n"
            "פקודות זמינות:\n"
            "/today — בריף בוקר עכשיו\n"
            "/tasks — משימות פעילות\n"
            "/connect\\_gmail — חיבור Gmail\n"
            "/help  — עזרה",
        )
    elif not code:
        await _reply(chat_id, "שלום! כדי להתחבר, השתמש בקישור מדף ההגדרות באפליקציה.")


async def _handle_connect_gmail(chat_id: int | str) -> None:
    """Start the Gmail OAuth flow — generates auth URL, spins up local redirect server."""
    from services.gmail_client import build_auth_url, exchange_code, wait_for_oauth_code

    client_id, client_secret, _ = _get_gmail_credentials()
    if not client_id or not client_secret:
        await _reply(
            chat_id,
            "⚠️ לא מוגדרים Client ID ו-Secret של Gmail.\n"
            "הכנס אותם בדף ההגדרות של האפליקציה תחת Gmail, ונסה שוב.",
        )
        return

    auth_url = build_auth_url(client_id)
    await _reply(
        chat_id,
        "📧 *חיבור Gmail*\n\n"
        "לחץ על הקישור הבא בדפדפן (על אותו המחשב שבו רץ StudyBuddy):\n\n"
        f"[פתח לחיבור Gmail]({auth_url})\n\n"
        "⏳ ממתין 5 דקות להשלמת ההתחברות…",
    )

    # Wait for the OAuth callback in background so the poll loop continues
    async def _complete_oauth():
        code = await wait_for_oauth_code(timeout=300)
        if not code:
            await _reply(chat_id, "⌛ פג תוקף קישור ה-Gmail. שלח /connect\\_gmail לנסות שוב.")
            return
        try:
            refresh_token = await exchange_code(code, client_id, client_secret)
            _save_gmail_refresh_token(refresh_token)
            await _reply(
                chat_id,
                "✅ *Gmail מחובר בהצלחה!*\n\n"
                "בכל בוקר (כ-5 דקות אחרי הבריף) אסרוק את תיבת הדואר שלך ואעדכן אותך על מטלות חדשות.\n\n"
                "לסריקה מיידית: /scan\\_gmail",
            )
        except Exception as e:
            await _reply(chat_id, f"❌ שגיאה בחיבור Gmail: {e}")

    asyncio.create_task(_complete_oauth())


async def _handle_scan_gmail(chat_id: int | str) -> None:
    """Manually trigger a Gmail inbox scan (for testing)."""
    await _reply(chat_id, "🔍 סורק את תיבת הדואר…")
    try:
        from services.scheduler import _run_gmail_sync
        await _run_gmail_sync()
    except Exception as e:
        await _reply(chat_id, f"❌ שגיאה בסריקה: {e}")


async def _handle_command(chat_id: int | str, text: str) -> None:
    cmd = text.strip().split()[0].lower().split("@")[0]

    if cmd == "/start":
        await _handle_start(chat_id, text)
        return

    # Privacy: all other commands require registration
    registered_id = _get_registered_chat_id()
    if registered_id is None or str(chat_id) != registered_id:
        return

    if cmd == "/today":
        from services.morning_brief import send_morning_brief
        await send_morning_brief()

    elif cmd == "/tasks":
        await _reply(chat_id, _build_task_list())

    elif cmd == "/connect_gmail":
        await _handle_connect_gmail(chat_id)

    elif cmd == "/scan_gmail":
        await _handle_scan_gmail(chat_id)

    elif cmd == "/help":
        await _reply(
            chat_id,
            "פקודות זמינות:\n"
            "/today         — שלח את הבריף הבוקרי עכשיו\n"
            "/tasks         — רשימת כל המשימות הפעילות\n"
            "/connect\\_gmail — חיבור Gmail לסריקת מטלות\n"
            "/scan\\_gmail    — סרוק את ה-Gmail עכשיו\n"
            "/help          — הצג עזרה זו\n\n"
            "💬 אפשר גם לשלוח הודעה חופשית ואענה כמנטור לימודי.",
        )


# ── Callback (inline button) handlers ─────────────────────────────────────────

def _build_subtask_message(parent: Task, subtasks: list[Task]) -> tuple[str, list[list[dict]]]:
    """Build the subtask checklist message text and inline keyboard."""
    done_count = sum(1 for s in subtasks if s.status == "Done")
    total = len(subtasks)

    lines = [f"✅ *{parent.title}* — נוסף לדשבורד!\n"]
    lines.append(f"פצלתי ל-{total} שלבים:\n")
    for s in subtasks:
        icon = "✅" if s.status == "Done" else "◻️"
        lines.append(f"{icon} {s.title}")

    if done_count == total:
        lines.append(f"\n🎉 כל השלבים הושלמו! עבודה מצוינת!")
        keyboard: list[list[dict]] = []
    else:
        lines.append(f"\n{done_count}/{total} הושלמו — {_progress_emoji(done_count, total)}")
        # Only show buttons for incomplete subtasks
        keyboard = [
            [{"text": f"✅ {s.title}", "callback_data": f"subtask_done:{s.id}"}]
            for s in subtasks if s.status != "Done"
        ]

    return "\n".join(lines), keyboard


def _progress_emoji(done: int, total: int) -> str:
    ratio = done / total if total > 0 else 0
    if ratio == 0:
        return "בהצלחה! 💪"
    if ratio < 0.5:
        return "ממשיך בכיוון הנכון! 🚀"
    if ratio < 1:
        return "כמעט שם! 🏁"
    return "כל הכבוד! 🌟"


async def _confirm_email_task(chat_id: int | str, message_id: int, cache_id: int) -> None:
    """Create Task + subtasks from a CommunicationsCache row, show subtask checklist."""
    from services.telegram_client import edit_message
    from app.models import CommunicationsCache as CC

    db = SessionLocal()
    try:
        cache = db.query(CC).filter(CC.id == cache_id).first()
        if not cache:
            await edit_message(str(chat_id), message_id, "⚠️ המטלה לא נמצאה — אולי כבר נוספה.")
            return

        # Parse deadline from content_summary (stored earlier by gmail sync)
        due_date = None
        if cache.timestamp:
            # deadline was stored in content_summary as ISO if found
            pass
        # Re-extract from raw_snippet
        from services.email_parser import extract_deadline
        if cache.raw_snippet:
            due_date = extract_deadline(cache.raw_snippet)

        # Create parent task
        parent = Task(
            title=cache.content_summary or "מטלה חדשה",
            status="Todo",
            priority="High",
            due_date=datetime.combine(due_date, datetime.min.time()) if due_date else None,
            position=0,
        )
        db.add(parent)
        db.flush()

        # Create default subtasks
        subtask_titles = ["הבנת המטלה 📖", "ביצוע ✏️", "הגשה וסיכום 📤"]
        subtasks = []
        for i, title in enumerate(subtask_titles):
            st = Task(
                title=title,
                parent_task_id=parent.id,
                status="Todo",
                priority="Medium",
                position=i,
            )
            db.add(st)
            subtasks.append(st)

        db.commit()
        for obj in [parent] + subtasks:
            db.refresh(obj)

        text, keyboard = _build_subtask_message(parent, subtasks)
        await edit_message(str(chat_id), message_id, text, keyboard)

    finally:
        db.close()


async def _mark_subtask_done(chat_id: int | str, message_id: int, subtask_id: int) -> None:
    """Mark a subtask as Done and update the inline message with new progress."""
    from services.telegram_client import edit_message

    db = SessionLocal()
    try:
        subtask = db.query(Task).filter(Task.id == subtask_id).first()
        if not subtask or not subtask.parent_task_id:
            return

        subtask.status = "Done"
        subtask.completed_at = datetime.utcnow()
        db.commit()

        # Reload parent + all siblings
        parent = db.query(Task).filter(Task.id == subtask.parent_task_id).first()
        siblings = (
            db.query(Task)
            .filter(Task.parent_task_id == subtask.parent_task_id)
            .order_by(Task.position)
            .all()
        )

        # Mark parent Done if all subtasks are Done
        if all(s.status == "Done" for s in siblings):
            parent.status = "Done"
            parent.completed_at = datetime.utcnow()
            db.commit()
            db.refresh(parent)

        text, keyboard = _build_subtask_message(parent, siblings)
        await edit_message(str(chat_id), message_id, text, keyboard)

    finally:
        db.close()


async def _handle_callback(cq: dict) -> None:
    """Dispatch inline keyboard button presses."""
    from services.telegram_client import edit_message

    data = cq.get("data", "")
    chat_id = cq["from"]["id"]
    message_id = cq["message"]["message_id"]

    registered_id = _get_registered_chat_id()
    if registered_id is None or str(chat_id) != registered_id:
        return  # privacy: silently ignore

    try:
        if data.startswith("email_add:"):
            cache_id = int(data.split(":")[1])
            await _confirm_email_task(chat_id, message_id, cache_id)

        elif data.startswith("email_skip:"):
            await edit_message(str(chat_id), message_id, "⏭ דולג — לא נוסף לדשבורד.")

        elif data.startswith("subtask_done:"):
            subtask_id = int(data.split(":")[1])
            await _mark_subtask_done(chat_id, message_id, subtask_id)

    except Exception as e:
        print(f"[telegram-callback] error for '{data}': {e}")


# ── Main poll function ─────────────────────────────────────────────────────────

async def dispatch_command(last_update_id: int) -> int:
    """Poll Telegram for updates, handle messages and callbacks, return new offset."""
    if not _get_token():
        return last_update_id

    updates = await _get_updates(offset=last_update_id + 1 if last_update_id else 0)

    for update in updates:
        last_update_id = max(last_update_id, update["update_id"])

        # ── Inline button press ──
        cq = update.get("callback_query")
        if cq:
            try:
                await _handle_callback(cq)
                from services.telegram_client import answer_callback_query
                await answer_callback_query(cq["id"])
            except Exception as e:
                print(f"[telegram-callback] {e}")
            continue

        # ── Regular message ──
        msg = update.get("message", {})
        text = msg.get("text", "")
        chat_id = msg.get("chat", {}).get("id")

        if not chat_id or not text:
            continue

        if text.startswith("/"):
            try:
                await _handle_command(chat_id, text)
            except Exception as e:
                print(f"[telegram-cmd] error for '{text}': {e}")
        else:
            # Free-form message: Ollama mentor chat (registered user only)
            registered_id = _get_registered_chat_id()
            if registered_id and str(chat_id) == registered_id:
                try:
                    from services.ollama_client import chat
                    _chat_history.append({"role": "user", "content": text})
                    if len(_chat_history) > _MAX_HISTORY:
                        _chat_history.pop(0)
                    system = _build_chat_system_prompt()
                    response = await chat(list(_chat_history), system=system)
                    _chat_history.append({"role": "assistant", "content": response})
                    await _reply(chat_id, response)
                except Exception as e:
                    print(f"[telegram-chat] {e}")
                    await _reply(chat_id, "מצטער, לא יכולתי לענות כרגע. ודא ש-Ollama רץ.")

    return last_update_id
