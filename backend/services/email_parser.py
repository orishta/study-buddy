"""
Local email parser — extracts assignment/deadline info from email text.
No external APIs or ML libraries; uses regex and keyword matching only.
"""
import re
from datetime import date, datetime
from typing import Optional

# ── Keyword lists ──────────────────────────────────────────────────────────────

_HEBREW_KEYWORDS = [
    "מטלה", "הגשה", "מבחן", "תרגיל", "דדליין", "הגש", "הגישו",
    "אתר הקורס", "עבודה", "פרויקט", "בוחן", "ציון",
]
_ENGLISH_KEYWORDS = [
    "assignment", "deadline", "due", "exam", "submit", "homework",
    "project", "quiz", "midterm", "final",
]

# ── Hebrew month names ─────────────────────────────────────────────────────────

_HEB_MONTHS = {
    "ינואר": 1, "פברואר": 2, "מרץ": 3, "אפריל": 4,
    "מאי": 5, "יוני": 6, "יולי": 7, "אוגוסט": 8,
    "ספטמבר": 9, "אוקטובר": 10, "נובמבר": 11, "דצמבר": 12,
}
_ENG_MONTHS = {
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
    "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
}

# ── Date extraction patterns ───────────────────────────────────────────────────

_DATE_PATTERNS = [
    # dd/mm/yyyy or dd.mm.yyyy
    (r"(\d{1,2})[./](\d{1,2})[./](\d{2,4})", lambda m: _ymd(int(m.group(3)), int(m.group(2)), int(m.group(1)))),
    # dd/mm (no year — assume current or next year)
    (r"(?<!\d)(\d{1,2})[./](\d{1,2})(?!\d|[./]\d)", lambda m: _ymd_noyear(int(m.group(2)), int(m.group(1)))),
    # עד ה-15 or עד 15/05
    (r"עד\s+ה?-?\s*(\d{1,2})[./](\d{1,2})", lambda m: _ymd_noyear(int(m.group(2)), int(m.group(1)))),
    # 15 במאי / 15 מאי
    (r"(\d{1,2})\s+ב?(" + "|".join(_HEB_MONTHS) + r")", lambda m: _ymd_noyear(_HEB_MONTHS[m.group(2)], int(m.group(1)))),
    # due May 15 / due 15 May
    (r"due\s+(\w+)\s+(\d{1,2})", _parse_eng_due),
    (r"due\s+(\d{1,2})\s+(\w+)", _parse_eng_due_rev),
]


def _ymd(year: int, month: int, day: int) -> Optional[date]:
    if year < 100:
        year += 2000
    try:
        return date(year, month, day)
    except ValueError:
        return None


def _ymd_noyear(month: int, day: int) -> Optional[date]:
    today = date.today()
    for year in (today.year, today.year + 1):
        try:
            d = date(year, month, day)
            if d >= today:
                return d
        except ValueError:
            continue
    return None


def _parse_eng_due(m: re.Match) -> Optional[date]:
    month_str = m.group(1).lower()[:3]
    day = int(m.group(2))
    month = _ENG_MONTHS.get(month_str)
    return _ymd_noyear(month, day) if month else None


def _parse_eng_due_rev(m: re.Match) -> Optional[date]:
    day = int(m.group(1))
    month_str = m.group(2).lower()[:3]
    month = _ENG_MONTHS.get(month_str)
    return _ymd_noyear(month, day) if month else None


# ── Public API ─────────────────────────────────────────────────────────────────

def is_relevant(subject: str, body: str) -> bool:
    """Return True if the email likely contains an assignment or deadline."""
    text = (subject + " " + body).lower()
    for kw in _HEBREW_KEYWORDS:
        if kw in text:
            return True
    for kw in _ENGLISH_KEYWORDS:
        if kw in text:
            return True
    return False


def extract_deadline(text: str) -> Optional[date]:
    """Try all date patterns in order, return the first plausible future date."""
    for pattern, extractor in _DATE_PATTERNS:
        for m in re.finditer(pattern, text, flags=re.IGNORECASE):
            try:
                d = extractor(m)
                if d and d >= date.today():
                    return d
            except Exception:
                continue
    return None


def extract_task_title(subject: str, body: str) -> str:
    """
    Derive a clean task title from the subject line.
    Strips common prefixes (Fwd:, Re:, [Course]) and trims whitespace.
    Falls back to the first non-empty sentence of the body.
    """
    title = re.sub(r"^(fwd?|re|fw):\s*", "", subject.strip(), flags=re.IGNORECASE)
    title = re.sub(r"^\[.*?\]\s*", "", title)  # strip [Course Name] prefix
    title = title.strip()
    if len(title) >= 5:
        return title[:120]

    # Fallback to first sentence of body
    sentences = re.split(r"[.\n!?]", body)
    for s in sentences:
        s = s.strip()
        if len(s) >= 5:
            return s[:120]
    return subject[:120] or "מטלה חדשה"


def parse_email(msg: dict) -> Optional[dict]:
    """
    Parse a raw email dict {id, subject, body, date}.
    Returns {title, deadline, course_hint} or None if not assignment-related.
    """
    subject = msg.get("subject", "")
    body = msg.get("body", "")

    if not is_relevant(subject, body):
        return None

    full_text = subject + "\n" + body
    deadline = extract_deadline(full_text)
    title = extract_task_title(subject, body)

    # Crude course hint: look for [CourseName] pattern in subject
    course_match = re.search(r"\[([^\]]{2,40})\]", subject)
    course_hint = course_match.group(1) if course_match else None

    return {"title": title, "deadline": deadline, "course_hint": course_hint}
