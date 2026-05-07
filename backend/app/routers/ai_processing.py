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


def _parse_line_numbers(raw: str, total_lines: int) -> list[int]:
    """Extract a JSON array of integers from LLM output, clamped to valid line range."""
    raw = raw.strip()
    start = raw.find("[")
    end = raw.rfind("]") + 1
    if start == -1 or end == 0:
        return []
    try:
        parsed = json.loads(raw[start:end])
        return [int(n) for n in parsed if str(n).strip().isdigit() and 1 <= int(n) <= total_lines]
    except (json.JSONDecodeError, ValueError):
        return []


def _prepare_lines(text: str) -> list[str]:
    return [line.strip() for line in text.splitlines() if line.strip()]


@router.post("/extract-topics", response_model=ExtractedTopicsOut)
async def extract_topics(payload: SyllabusIn, db: Session = Depends(get_db)):
    course = db.query(Course).filter(
        Course.id == payload.course_id, Course.is_active == True
    ).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    if not payload.text.strip():
        raise HTTPException(status_code=422, detail="Syllabus text is empty")

    lines = _prepare_lines(payload.text)
    if not lines:
        raise HTTPException(status_code=422, detail="Syllabus text is empty")

    numbered = "\n".join(f"{i + 1}. {line}" for i, line in enumerate(lines))

    # Ask model for line numbers only — avoids any Unicode reproduction issues
    prompt = (
        "Below is a numbered course syllabus. "
        "Identify which line numbers represent a topic, chapter, unit, or subject heading "
        "that a student should study.\n"
        "Return ONLY a JSON array of integers (the line numbers). "
        "No text, no explanation, no markdown — just the array.\n"
        "Example: [1, 3, 5, 8]\n\n"
        f"Syllabus:\n{numbered}"
    )

    try:
        raw = await generate(prompt)
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail=f"Ollama is not reachable. Make sure it is running: {e}",
        )

    indices = _parse_line_numbers(raw, len(lines))
    if not indices:
        raise HTTPException(
            status_code=502,
            detail="Could not identify topics in the syllabus. Try pasting cleaner text.",
        )

    # Pull the original text for those lines — language is preserved perfectly
    topics = [lines[i - 1] for i in sorted(set(indices))]
    return ExtractedTopicsOut(topics=topics)
