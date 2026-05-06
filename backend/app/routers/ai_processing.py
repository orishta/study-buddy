import json
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Course
from services.ollama_client import generate

router = APIRouter(prefix="/ai", tags=["ai"])


class SyllabusIn(BaseModel):
    course_id: int
    text: str


class ExtractedTopicsOut(BaseModel):
    topics: list[str]


def _parse_topics(raw: str) -> list[str]:
    """Extract a JSON array of strings from potentially noisy LLM output."""
    raw = raw.strip()
    start = raw.find("[")
    end = raw.rfind("]") + 1
    if start == -1 or end == 0:
        return []
    try:
        parsed = json.loads(raw[start:end])
        return [str(t).strip() for t in parsed if str(t).strip()]
    except json.JSONDecodeError:
        return []


@router.post("/extract-topics", response_model=ExtractedTopicsOut)
async def extract_topics(payload: SyllabusIn, db: Session = Depends(get_db)):
    course = db.query(Course).filter(
        Course.id == payload.course_id, Course.is_active == True
    ).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    if not payload.text.strip():
        raise HTTPException(status_code=422, detail="Syllabus text is empty")

    prompt = (
        "Read the following course syllabus and extract all the topics, units, or chapters "
        "that a student needs to study.\n"
        "Rules:\n"
        "- Return ONLY a JSON array of short topic name strings.\n"
        "- No markdown, no explanation, no code blocks — just the raw JSON array.\n"
        "- Keep each topic name concise (2–6 words).\n"
        "- Include every distinct topic you find.\n\n"
        "Example output: [\"Introduction\", \"Data Structures\", \"Sorting Algorithms\"]\n\n"
        f"Syllabus:\n{payload.text}"
    )

    try:
        raw = await generate(prompt)
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail=f"Ollama is not reachable. Make sure it is running: {e}",
        )

    topics = _parse_topics(raw)
    if not topics:
        raise HTTPException(
            status_code=502,
            detail="Could not extract topics from the syllabus. Try pasting cleaner text.",
        )

    return ExtractedTopicsOut(topics=topics)
