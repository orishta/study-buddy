"""Schedule Generator — rule-based daily plan builder, no LLM required.

Converts a list of class slots + active tasks into an ordered sequence of
work/break/warmup blocks personalised to the user's UserProfile.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from typing import Any, Optional

from .profile_engine import UserProfile, load_profile

# ── Data types ────────────────────────────────────────────────────────────────


@dataclass
class ScheduleBlock:
    start: time
    end: time
    label: str
    task_id: Optional[int]
    block_type: str          # "class" | "work" | "break" | "warmup" | "buffer"
    timer_minutes: Optional[int]
    description: str = ""


# ── Helpers ───────────────────────────────────────────────────────────────────


def _t(h: int, m: int) -> time:
    return time(h, m)


def _parse_time(s: str) -> time:
    """Parse "HH:MM" string to time object."""
    hh, mm = s.split(":")
    return time(int(hh), int(mm))


def _add_minutes(t: time, minutes: int) -> time:
    dt = datetime.combine(date.today(), t) + timedelta(minutes=minutes)
    return dt.time()


def _time_to_minutes(t: time) -> int:
    return t.hour * 60 + t.minute


def _minutes_to_time(m: int) -> time:
    return time(m // 60, m % 60)


# ── Core generator ────────────────────────────────────────────────────────────


def generate_daily_plan(
    tasks: list[dict[str, Any]],
    classes: list[dict[str, Any]],
    profile: Optional[UserProfile] = None,
    day_start: time = _t(8, 0),
    day_end: time = _t(22, 0),
) -> list[ScheduleBlock]:
    """Build a personalised daily schedule.

    Args:
        tasks:    list of task dicts with keys: id, title, status, priority, due_date, estimated_minutes
        classes:  list of class-slot dicts with keys: start_time, end_time, subject_name
        profile:  UserProfile — loaded from file if None
        day_start: earliest time to schedule work blocks
        day_end:   latest time to end work blocks

    Returns:
        Sorted list of ScheduleBlock objects covering the full day.
    """
    if profile is None:
        profile = load_profile()

    blocks: list[ScheduleBlock] = []

    # ── 1. Insert class slots ─────────────────────────────────────────────────
    for c in classes:
        try:
            start = _parse_time(c["start_time"])
            end = _parse_time(c["end_time"])
        except (KeyError, ValueError):
            continue
        blocks.append(ScheduleBlock(
            start=start, end=end,
            label=c.get("subject_name", "Class"),
            task_id=None,
            block_type="class",
            timer_minutes=None,
            description="",
        ))

    # Sort class blocks by start time
    blocks.sort(key=lambda b: b.start)

    # ── 2. Find free windows between classes ──────────────────────────────────
    free_windows: list[tuple[time, time]] = []
    cursor = day_start
    for b in blocks:
        if b.start > cursor:
            free_windows.append((cursor, b.start))
        cursor = max(cursor, b.end)
    if cursor < day_end:
        free_windows.append((cursor, day_end))

    # ── 3. Filter + prioritise tasks ─────────────────────────────────────────
    active = [t for t in tasks if t.get("status") != "Done"]
    # Priority ordering: Urgent > High > In Progress > Medium > Low
    priority_order = {"Urgent": 0, "High": 1, "Medium": 2, "Low": 3}
    active.sort(key=lambda t: (
        priority_order.get(t.get("priority", "Medium"), 2),
        0 if t.get("status") == "In Progress" else 1,
        t.get("due_date") or "9999-99-99",
    ))

    # Apply overwhelm limit
    if profile.overwhelm_sensitivity >= 4:
        active = active[:3]
    elif profile.overwhelm_sensitivity >= 3:
        active = active[:5]

    # ── 4. Fill free windows with work + break blocks ─────────────────────────
    break_minutes = _break_duration(profile)
    work_blocks: list[ScheduleBlock] = []
    task_idx = 0
    n_tasks = len(active)

    for win_start, win_end in free_windows:
        cursor_m = _time_to_minutes(win_start)
        win_end_m = _time_to_minutes(win_end)
        first_in_window = True

        while cursor_m + profile.block_minutes <= win_end_m and task_idx < n_tasks:
            t = active[task_idx]

            # Warmup block before first work block in window
            if first_in_window and profile.warmup:
                wu_end = cursor_m + 5
                if wu_end + profile.block_minutes <= win_end_m:
                    work_blocks.append(ScheduleBlock(
                        start=_minutes_to_time(cursor_m),
                        end=_minutes_to_time(wu_end),
                        label="🌅 Warm-up",
                        task_id=None,
                        block_type="warmup",
                        timer_minutes=5,
                        description="Open your materials, skim headings — no pressure.",
                    ))
                    cursor_m = wu_end
                first_in_window = False

            # Work block
            block_end_m = min(cursor_m + profile.block_minutes, win_end_m)
            actual_minutes = block_end_m - cursor_m
            if actual_minutes < 10:
                break

            est = t.get("estimated_minutes") or profile.block_minutes
            label = t.get("title", "Task")
            work_blocks.append(ScheduleBlock(
                start=_minutes_to_time(cursor_m),
                end=_minutes_to_time(block_end_m),
                label=label,
                task_id=t.get("id"),
                block_type="work",
                timer_minutes=actual_minutes if profile.show_timer else None,
                description=_work_description(t, profile),
            ))
            cursor_m = block_end_m

            # Advance to next task if we've spent enough time on this one
            if actual_minutes >= min(est, profile.block_minutes):
                task_idx += 1

            # Break block
            if cursor_m + break_minutes <= win_end_m and task_idx < n_tasks:
                break_end_m = cursor_m + break_minutes
                work_blocks.append(ScheduleBlock(
                    start=_minutes_to_time(cursor_m),
                    end=_minutes_to_time(break_end_m),
                    label=_break_label(profile),
                    task_id=None,
                    block_type="break",
                    timer_minutes=break_minutes,
                    description=_break_description(profile),
                ))
                cursor_m = break_end_m

            first_in_window = False

    blocks.extend(work_blocks)
    blocks.sort(key=lambda b: b.start)
    return blocks


# ── Sub-helpers ───────────────────────────────────────────────────────────────


def _break_duration(profile: UserProfile) -> int:
    if profile.break_style == "pomodoro":
        return 5
    elif profile.break_style == "micro":
        return 3
    elif profile.break_style == "deep_work":
        return 15
    else:  # flow
        return 10


def _break_label(profile: UserProfile) -> str:
    if profile.lang == "he":
        return "☕ הפסקה"
    return "☕ Break"


def _break_description(profile: UserProfile) -> str:
    if profile.break_style == "pomodoro":
        return "קום, תמתח, שתה מים." if profile.lang == "he" else "Stand up, stretch, drink water."
    elif profile.break_style == "micro":
        return "נשימות עמוקות ×3." if profile.lang == "he" else "3 deep breaths."
    elif profile.break_style == "deep_work":
        return "הפסקה ארוכה — לך להסתובב בחוץ." if profile.lang == "he" else "Long break — go for a short walk."
    else:
        return "הפסקה קצרה." if profile.lang == "he" else "Short break."


def _work_description(task: dict[str, Any], profile: UserProfile) -> str:
    due = task.get("due_date")
    due_str = ""
    if due and isinstance(due, str):
        try:
            due_str = datetime.fromisoformat(due.rstrip("Z")).strftime("%d/%m")
        except ValueError:
            pass
    elif isinstance(due, datetime):
        due_str = due.strftime("%d/%m")

    prefix = profile.framing_prefix
    if due_str:
        if profile.lang == "he":
            return f"{prefix} הגשה ב-{due_str}"
        return f"{prefix} due {due_str}"
    return prefix
