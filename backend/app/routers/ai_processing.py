"""AI endpoints — inference routes to Anthropic, OpenAI, or local Ollama depending
on configured keys.  Falls back to Ollama (free, local) when no remote key is set."""
from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import ClassSchedule, Course, Task, UserSettings
from services.ollama_client import extract_topics_from_pdf, extract_topics_from_text
from services.telegram_client import get_bot_username, send_message
from services.morning_brief import send_morning_brief
from services.ai_client import provider_status
from services.keyring_store import set_secret
from services.profile_engine import generate_advice, load_profile, score_questionnaire, UserProfile

router = APIRouter(prefix="/ai", tags=["ai"])


# ── Syllabus topic extraction ──────────────────────────────────────────────────

class SyllabusIn(BaseModel):
    course_id: int
    text: Optional[str] = None
    pdf_base64: Optional[str] = None


class ExtractedTopicsOut(BaseModel):
    topics: list[str]


@router.post("/extract-topics", response_model=ExtractedTopicsOut)
async def extract_topics(payload: SyllabusIn, db: Session = Depends(get_db)):
    course = db.query(Course).filter(
        Course.id == payload.course_id, Course.is_active == True
    ).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    if not payload.text and not payload.pdf_base64:
        raise HTTPException(status_code=422, detail="Provide text or a PDF file")

    try:
        if payload.pdf_base64:
            topics = await extract_topics_from_pdf(payload.pdf_base64)
        else:
            topics = await extract_topics_from_text(payload.text)
    except (RuntimeError, ValueError) as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Ollama error: {e}")

    if not topics:
        raise HTTPException(
            status_code=502,
            detail="Could not extract topics. Make sure Ollama is running and try again.",
        )
    return ExtractedTopicsOut(topics=topics)


# ── Mentor ────────────────────────────────────────────────────────────────────

class MentorOut(BaseModel):
    advice: str


def _today_dow() -> int:
    return (date.today().weekday() + 1) % 7


@router.post("/mentor", response_model=MentorOut)
async def get_mentor_advice(db: Session = Depends(get_db)):
    """Generate a personalised 'what to do right now' action plan (offline, rule-based)."""
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
        .limit(15)
        .all()
    )

    schedule_today = [
        {"start_time": c.start_time, "end_time": c.end_time, "subject_name": c.subject_name}
        for c in classes
    ]
    tasks_active = [
        {
            "id": t.id,
            "title": t.title,
            "status": t.status,
            "priority": t.priority,
            "due_date": t.due_date.isoformat() if t.due_date else None,
        }
        for t in tasks
    ]

    profile = load_profile()
    advice = generate_advice(tasks_active, schedule_today, profile)
    return MentorOut(advice=advice.strip())


# ── Questionnaire / onboarding profile ───────────────────────────────────────


class QuestionnaireIn(BaseModel):
    answers: dict[str, str]   # {"q1": "q1_hard", "q2": "q2_30", ...}


class ProfileOut(BaseModel):
    initiation_difficulty: int
    sustained_attention: int
    reading_load: int
    time_blindness: int
    overwhelm_sensitivity: int
    motivation_style: str
    peak_time: str
    break_style: str
    block_minutes: int
    warmup: bool
    format_style: str
    show_timer: bool
    max_visible_tasks: int
    framing_prefix: str
    onboarding_done: bool


@router.post("/questionnaire", response_model=ProfileOut)
def submit_questionnaire(payload: QuestionnaireIn):
    """Score the onboarding questionnaire and persist the resulting UserProfile."""
    profile = score_questionnaire(payload.answers)
    return ProfileOut(**profile.__dict__)


@router.get("/questionnaire/profile", response_model=ProfileOut)
def get_profile():
    """Return the current user profile (or defaults if onboarding not done)."""
    p = load_profile()
    return ProfileOut(**p.__dict__)


# ── Telegram ───────────────────────────────────────────────────────────────────

class TelegramStartOut(BaseModel):
    start_url: str
    tg_url: str
    bot_username: str


class TelegramStatusOut(BaseModel):
    connected: bool
    chat_id: Optional[str] = None
    bot_username: Optional[str] = None


@router.post("/telegram/generate-start", response_model=TelegramStartOut)
async def generate_telegram_start(db: Session = Depends(get_db)):
    from services.telegram_commands import generate_start_code

    try:
        bot_username = await get_bot_username()
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Cannot reach Telegram: {e}")

    code = generate_start_code()
    name = bot_username.lstrip("@")
    return TelegramStartOut(
        start_url=f"https://t.me/{name}?start={code}",
        tg_url=f"tg://resolve?domain={name}&start={code}",
        bot_username=bot_username,
    )


@router.get("/telegram/status", response_model=TelegramStatusOut)
async def telegram_status(db: Session = Depends(get_db)):
    settings = db.query(UserSettings).first()
    chat_id = settings.telegram_chat_id if settings else None
    if not chat_id:
        return TelegramStatusOut(connected=False)
    return TelegramStatusOut(connected=True, chat_id=chat_id)


@router.post("/telegram/test")
async def test_telegram_brief(db: Session = Depends(get_db)):
    settings = db.query(UserSettings).first()
    chat_id = settings.telegram_chat_id if settings else None
    if not chat_id:
        raise HTTPException(
            status_code=400,
            detail="No Telegram chat connected yet. Use the Settings page to connect.",
        )
    try:
        await send_morning_brief()
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e))
    return {"sent": True}


# ── AI provider ────────────────────────────────────────────────────────────────

class AiProviderStatusOut(BaseModel):
    active_provider: str          # "ollama" | "anthropic" | "openai"
    anthropic_key_set: bool
    openai_key_set: bool


class AiProviderKeysIn(BaseModel):
    anthropic_api_key: Optional[str] = None
    openai_api_key: Optional[str] = None


@router.get("/provider-status", response_model=AiProviderStatusOut)
def get_provider_status():
    """Return which AI provider is active and which keys are configured."""
    return provider_status()


@router.put("/provider-keys", response_model=AiProviderStatusOut)
def update_provider_keys(payload: AiProviderKeysIn):
    """Store (or clear) remote AI API keys in the OS keychain."""
    if payload.anthropic_api_key is not None:
        set_secret("anthropic_api_key", payload.anthropic_api_key)
    if payload.openai_api_key is not None:
        set_secret("openai_api_key", payload.openai_api_key)
    return provider_status()
