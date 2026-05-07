from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Course
from services.gemini_client import extract_from_pdf, extract_from_text

router = APIRouter(prefix="/ai", tags=["ai"])


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
            topics = await extract_from_pdf(payload.pdf_base64)
        else:
            topics = await extract_from_text(payload.text)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Gemini API error: {e}")

    if not topics:
        raise HTTPException(
            status_code=502,
            detail="Could not extract topics. Try cleaner text or check the PDF is readable.",
        )

    return ExtractedTopicsOut(topics=topics)
