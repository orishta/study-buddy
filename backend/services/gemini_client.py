"""Gemini API client for syllabus topic extraction (free tier: 1500 req/day)."""
import asyncio
import json
import os

import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

_API_KEY = os.getenv("GEMINI_API_KEY", "")
_MODEL = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")

_PROMPT = (
    "Extract every course topic, chapter, unit, or study subject from this syllabus. "
    "Return ONLY a raw JSON array of short topic name strings. "
    "No markdown, no explanation, no code fences — just the array. "
    "CRITICAL: preserve the exact original language. "
    "Hebrew input → Hebrew output. English input → English output. Never translate."
)


def _model() -> genai.GenerativeModel:
    if not _API_KEY:
        raise RuntimeError(
            "GEMINI_API_KEY is not set. "
            "Get a free key at https://aistudio.google.com/app/apikey "
            "and add GEMINI_API_KEY=... to your .env file."
        )
    genai.configure(api_key=_API_KEY)
    return genai.GenerativeModel(_MODEL)


def _parse(raw: str) -> list[str]:
    raw = raw.strip()
    # Strip markdown code fences if the model added them
    if raw.startswith("```"):
        lines = raw.splitlines()
        raw = "\n".join(lines[1:-1] if lines and lines[-1].strip() == "```" else lines[1:])
    start, end = raw.find("["), raw.rfind("]") + 1
    if start == -1 or end == 0:
        return []
    try:
        return [str(t).strip() for t in json.loads(raw[start:end]) if str(t).strip()]
    except json.JSONDecodeError:
        return []


async def extract_from_text(text: str) -> list[str]:
    m = _model()
    response = await asyncio.to_thread(
        m.generate_content, f"{_PROMPT}\n\nSyllabus:\n{text}"
    )
    return _parse(response.text)


async def extract_from_pdf(pdf_base64: str) -> list[str]:
    m = _model()
    response = await asyncio.to_thread(
        m.generate_content,
        [{"inline_data": {"mime_type": "application/pdf", "data": pdf_base64}}, _PROMPT],
    )
    return _parse(response.text)
