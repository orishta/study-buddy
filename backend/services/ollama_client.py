"""Local LLM client — all AI inference runs through Ollama (free, private, offline)."""
import base64
import io
import json
import os

import httpx
from dotenv import load_dotenv

load_dotenv()

OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://localhost:11434")
# qwen2.5:7b = decent Hebrew, reasonable size (~4.7GB)
# aya-expanse:8b = best Hebrew quality but heavier (~5.5GB)
# Set OLLAMA_MODEL in backend/.env to override
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5:7b")

_TOPIC_PROMPT = (
    "Extract every course topic, chapter, unit, or study subject from this syllabus. "
    "Return ONLY a raw JSON array of short topic name strings. "
    "No markdown, no explanation, no code fences — just the array. "
    "CRITICAL: preserve the exact original language (Hebrew input → Hebrew output)."
)


async def generate(prompt: str, system: str = "") -> str:
    """Send a prompt to Ollama and return the response text.

    keep_alive=0  → model unloads from memory immediately after generating
                    (prevents GPU/CPU staying hot between requests)
    num_ctx=2048  → cap context window to reduce VRAM pressure
    """
    payload = {
        "model": OLLAMA_MODEL,
        "prompt": prompt,
        "system": system,
        "stream": False,
        "keep_alive": 0,        # unload model from RAM/VRAM right after use
        "options": {
            "num_ctx": 2048,    # smaller context = less memory pressure
            "num_thread": 4,    # cap CPU threads so the machine stays cool
        },
    }
    async with httpx.AsyncClient(timeout=180) as client:
        try:
            response = await client.post(f"{OLLAMA_HOST}/api/generate", json=payload)
            response.raise_for_status()
            return response.json()["response"]
        except httpx.ConnectError:
            raise RuntimeError(
                f"Cannot reach Ollama at {OLLAMA_HOST}. "
                "Is Ollama running? Start it with: ollama serve"
            )
        except Exception as e:
            raise RuntimeError(f"Ollama error: {e}")


def _parse_topics(raw: str) -> list[str]:
    raw = raw.strip()
    if raw.startswith("```"):
        lines = raw.splitlines()
        raw = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
    start, end = raw.find("["), raw.rfind("]") + 1
    if start == -1 or end == 0:
        return []
    try:
        return [str(t).strip() for t in json.loads(raw[start:end]) if str(t).strip()]
    except json.JSONDecodeError:
        return []


async def extract_topics_from_text(text: str) -> list[str]:
    """Extract course topics from plain text using Ollama."""
    prompt = f"{_TOPIC_PROMPT}\n\nSyllabus:\n{text[:8000]}"
    raw = await generate(prompt)
    return _parse_topics(raw)


async def extract_topics_from_pdf(pdf_base64: str) -> list[str]:
    """Extract text from a PDF (base64-encoded) then run topic extraction."""
    from pypdf import PdfReader

    pdf_bytes = base64.b64decode(pdf_base64)
    reader = PdfReader(io.BytesIO(pdf_bytes))
    text = "\n".join(page.extract_text() or "" for page in reader.pages)
    if not text.strip():
        raise ValueError(
            "Could not extract text from this PDF. "
            "Try a text-based PDF instead of a scanned image."
        )
    return await extract_topics_from_text(text)


async def chat(messages: list[dict], system: str = "") -> str:
    """Multi-turn chat via /api/chat. messages = [{"role":"user","content":"..."}, ...]"""
    payload = {
        "model": OLLAMA_MODEL,
        "messages": messages,
        "stream": False,
        "keep_alive": 0,
        "options": {"num_ctx": 2048, "num_thread": 4},
    }
    if system:
        payload["system"] = system
    async with httpx.AsyncClient(timeout=180) as client:
        try:
            response = await client.post(f"{OLLAMA_HOST}/api/chat", json=payload)
            response.raise_for_status()
            return response.json()["message"]["content"]
        except httpx.ConnectError:
            raise RuntimeError(
                f"Cannot reach Ollama at {OLLAMA_HOST}. "
                "Is Ollama running? Start it with: ollama serve"
            )
        except Exception as e:
            raise RuntimeError(f"Ollama error: {e}")


async def generate_mentor_advice(
    schedule_today: list[dict],
    tasks_active: list[dict],
    learning_profile: dict | None,
) -> str:
    """Generate a personalised Hebrew action plan for the 'feeling lost' mentor box."""
    profile_note = ""
    if learning_profile:
        motivation = learning_profile.get("motivation", "")
        style = learning_profile.get("style", "")
        peak = learning_profile.get("peak_time", "")
        if motivation or style or peak:
            profile_note = (
                f"\nStudent profile — motivation: {motivation}, "
                f"learning style: {style}, peak focus time: {peak}."
            )

    schedule_lines = (
        [f"- {s['start_time']}–{s['end_time']}: {s['subject_name']}" for s in schedule_today]
        if schedule_today else ["- No classes today"]
    )

    task_lines = (
        [f"- [{t['status']}] {t['title']}" + (f" (due {t['due_date']})" if t.get("due_date") else "")
         for t in tasks_active[:12]]
        if tasks_active else ["- No active tasks"]
    )

    prompt = (
        "You are a warm, practical academic mentor for a university student.\n"
        + profile_note
        + "\n\nToday's schedule:\n"
        + "\n".join(schedule_lines)
        + "\n\nActive tasks:\n"
        + "\n".join(task_lines)
        + "\n\n---\n"
        "The student feels lost and needs guidance. Write a SHORT, encouraging response in Hebrew that:\n"
        "1. Acknowledges how they feel (one sentence)\n"
        "2. Picks the ONE most important thing to do right now based on the schedule and tasks\n"
        "3. Breaks it into 2-3 tiny concrete steps they can start immediately\n"
        "4. Ends with a brief motivating sentence\n\n"
        "Be concise, warm, and practical. Output only the Hebrew message — no headers, no markdown."
    )
    return await generate(prompt)
