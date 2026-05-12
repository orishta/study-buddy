"""ICS Calendar Generator — builds a VCALENDAR string from ScheduleBlock objects.

No external dependencies — pure Python stdlib.
UIDs are stable (uuid5 of date + label) so calendar clients deduplicate correctly.
The feed includes REFRESH-INTERVAL:PT1H so subscribed clients auto-refresh hourly.
"""
from __future__ import annotations

import uuid
from datetime import date, datetime, time
from typing import Optional

from .schedule_generator import ScheduleBlock

# ── Constants ─────────────────────────────────────────────────────────────────

_NAMESPACE = uuid.UUID("6ba7b810-9dad-11d1-80b4-00c04fd430c8")  # URL namespace
_CRLF = "\r\n"


# ── Public API ────────────────────────────────────────────────────────────────


def build_ics(
    blocks: list[ScheduleBlock],
    cal_date: Optional[date] = None,
    cal_name: str = "StudyBuddy",
) -> str:
    """Return a complete VCALENDAR string for the given day's blocks.

    Args:
        blocks:    list of ScheduleBlock objects (from schedule_generator)
        cal_date:  the calendar day (defaults to today)
        cal_name:  display name of the calendar feed
    """
    if cal_date is None:
        cal_date = date.today()

    lines: list[str] = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//StudyBuddy//StudyBuddy//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        f"X-WR-CALNAME:{_escape(cal_name)}",
        "X-WR-TIMEZONE:Asia/Jerusalem",
        "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
        "X-PUBLISHED-TTL:PT1H",
    ]

    for block in blocks:
        lines.extend(_vevent(block, cal_date))

    lines.append("END:VCALENDAR")
    return _CRLF.join(lines) + _CRLF


# ── VEVENT builder ────────────────────────────────────────────────────────────


def _vevent(block: ScheduleBlock, cal_date: date) -> list[str]:
    dtstart = _combine(cal_date, block.start)
    dtend = _combine(cal_date, block.end)

    uid_source = f"{cal_date.isoformat()}:{block.label}:{block.start}"
    uid = str(uuid.uuid5(_NAMESPACE, uid_source))

    summary = _escape(block.label)
    desc = _escape(block.description) if block.description else ""
    categories = block.block_type.upper()

    vevent = [
        "BEGIN:VEVENT",
        f"UID:{uid}@studybuddy.local",
        f"DTSTAMP:{_now_utc()}",
        f"DTSTART;TZID=Asia/Jerusalem:{_fmt(dtstart)}",
        f"DTEND;TZID=Asia/Jerusalem:{_fmt(dtend)}",
        f"SUMMARY:{summary}",
        f"CATEGORIES:{categories}",
    ]
    if desc:
        vevent.append(f"DESCRIPTION:{desc}")
    if block.timer_minutes:
        vevent.append(f"X-STUDYBUDDY-TIMER:{block.timer_minutes}")
    vevent.append("END:VEVENT")
    return vevent


# ── Helpers ───────────────────────────────────────────────────────────────────


def _combine(d: date, t: time) -> datetime:
    return datetime.combine(d, t)


def _fmt(dt: datetime) -> str:
    return dt.strftime("%Y%m%dT%H%M%S")


def _now_utc() -> str:
    return datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")


def _escape(s: str) -> str:
    """Escape special ICS characters: , ; \\ and newlines."""
    return s.replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,").replace("\n", "\\n")
