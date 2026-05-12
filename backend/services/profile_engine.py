"""Profile Engine — deterministic, LLM-free user profiling and advice generation.

Replaces Ollama for the mentor/morning-brief features. Data is stored in
user_profile.json next to the DB file and cached in RAM after first load.
"""
from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from datetime import date, datetime
from pathlib import Path
from typing import Any, Optional

# ── Profile dataclass ─────────────────────────────────────────────────────────

PROFILE_PATH = Path(__file__).parent.parent / "user_profile.json"

_DOW_HE = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"]


@dataclass
class UserProfile:
    # ── Scored dimensions (1–5 scale) ────────────────────────────────────────
    initiation_difficulty: int = 3      # high → warmup blocks, gentle framing
    sustained_attention: int = 3        # high → shorter work blocks
    reading_load: int = 2               # high → bullet-only output
    time_blindness: int = 2             # high → show countdown timer prominently
    overwhelm_sensitivity: int = 3      # high → hide extra tasks

    # ── Categorical preferences ───────────────────────────────────────────────
    motivation_style: str = "deadline"  # intrinsic | social | deadline | gamified
    peak_time: str = "morning"          # morning | midday | afternoon | evening
    break_style: str = "pomodoro"       # pomodoro | deep_work | flow | micro
    lang: str = "he"                    # he | en

    # ── Derived / computed ────────────────────────────────────────────────────
    block_minutes: int = 25             # computed from sustained_attention + break_style
    warmup: bool = False                # computed from initiation_difficulty
    format_style: str = "bullets"       # bullets | paragraph
    show_timer: bool = False            # computed from time_blindness
    max_visible_tasks: int = 99         # computed from overwhelm_sensitivity
    framing_prefix: str = "⏰ Due soon —"  # computed from motivation_style
    onboarding_done: bool = False


_CACHED_PROFILE: UserProfile | None = None


def load_profile() -> UserProfile:
    """Return the cached profile, loading from disk on first call."""
    global _CACHED_PROFILE
    if _CACHED_PROFILE is not None:
        return _CACHED_PROFILE
    if PROFILE_PATH.exists():
        try:
            data = json.loads(PROFILE_PATH.read_text(encoding="utf-8"))
            _CACHED_PROFILE = UserProfile(**{k: v for k, v in data.items() if k in UserProfile.__dataclass_fields__})
            return _CACHED_PROFILE
        except Exception:
            pass
    _CACHED_PROFILE = UserProfile()
    return _CACHED_PROFILE


def save_profile(p: UserProfile) -> None:
    """Compute derived fields, persist to JSON, update in-memory cache."""
    global _CACHED_PROFILE

    # Compute block_minutes from sustained_attention + break_style
    if p.break_style == "deep_work":
        base = 50
    elif p.break_style == "flow":
        base = 90
    elif p.break_style == "micro":
        base = 15
    else:  # pomodoro
        base = 25
    # Cap by attention: score 4–5 → cut by 40%, score 1–2 → full
    if p.sustained_attention >= 4:
        p.block_minutes = max(15, int(base * 0.6))
    elif p.sustained_attention >= 3:
        p.block_minutes = max(20, int(base * 0.8))
    else:
        p.block_minutes = base

    p.warmup = p.initiation_difficulty >= 3
    p.format_style = "bullets" if p.reading_load >= 3 else "paragraph"
    p.show_timer = p.time_blindness >= 3
    p.max_visible_tasks = 3 if p.overwhelm_sensitivity >= 4 else (5 if p.overwhelm_sensitivity >= 3 else 99)

    prefixes = {
        "intrinsic":  "🌱 מדהים בעצמך —",
        "social":     "👥 יחד נצליח —",
        "deadline":   "⏰ דדליין מתקרב —",
        "gamified":   "🏆 הרוויח XP —",
    }
    p.framing_prefix = prefixes.get(p.motivation_style, "⏰ Due soon —")
    p.onboarding_done = True

    _CACHED_PROFILE = p
    PROFILE_PATH.write_text(json.dumps(asdict(p), ensure_ascii=False, indent=2), encoding="utf-8")


def reset_cache() -> None:
    """Force next load_profile() call to re-read from disk."""
    global _CACHED_PROFILE
    _CACHED_PROFILE = None


# ── Questionnaire scoring ─────────────────────────────────────────────────────

# Maps answer keys to (dimension, delta) tuples — additive scoring
_QUESTION_MAP: dict[str, list[tuple[str, int]]] = {
    # Q1 — starting tasks
    "q1_hard":      [("initiation_difficulty", 2)],
    "q1_medium":    [("initiation_difficulty", 1)],
    "q1_easy":      [("initiation_difficulty", 0)],
    # Q2 — staying focused
    "q2_15":        [("sustained_attention", 4)],
    "q2_30":        [("sustained_attention", 3)],
    "q2_60":        [("sustained_attention", 2)],
    "q2_90":        [("sustained_attention", 1)],
    # Q3 — reading
    "q3_avoid":     [("reading_load", 4)],
    "q3_skip":      [("reading_load", 3)],
    "q3_ok":        [("reading_load", 2)],
    "q3_enjoy":     [("reading_load", 1)],
    # Q4 — time awareness
    "q4_often":     [("time_blindness", 4)],
    "q4_sometimes": [("time_blindness", 3)],
    "q4_rarely":    [("time_blindness", 2)],
    "q4_never":     [("time_blindness", 1)],
    # Q5 — overwhelm
    "q5_shutdown":  [("overwhelm_sensitivity", 5)],
    "q5_panic":     [("overwhelm_sensitivity", 4)],
    "q5_manage":    [("overwhelm_sensitivity", 2)],
    "q5_fine":      [("overwhelm_sensitivity", 1)],
    # Q6 — motivation (categorical)
    "q6_intrinsic": [],   # handled below
    "q6_social":    [],
    "q6_deadline":  [],
    "q6_gamified":  [],
    # Q7 — peak time (categorical)
    "q7_morning":   [],
    "q7_midday":    [],
    "q7_afternoon": [],
    "q7_evening":   [],
    # Q8 — break style (categorical)
    "q8_pomodoro":  [],
    "q8_deep":      [],
    "q8_flow":      [],
    "q8_micro":     [],
}


def score_questionnaire(answers: dict[str, str]) -> UserProfile:
    """Map questionnaire answers → UserProfile, then compute derived fields.

    answers: {"q1": "q1_hard", "q2": "q2_30", ...}
    """
    dims: dict[str, int] = {
        "initiation_difficulty": 1,
        "sustained_attention": 1,
        "reading_load": 1,
        "time_blindness": 1,
        "overwhelm_sensitivity": 1,
    }

    motivation = "deadline"
    peak_time = "morning"
    break_style = "pomodoro"

    for _q, answer in answers.items():
        deltas = _QUESTION_MAP.get(answer, [])
        for dim, delta in deltas:
            dims[dim] = min(5, dims[dim] + delta)

        if answer.startswith("q6_"):
            motivation = answer[3:]   # strip "q6_"
        elif answer.startswith("q7_"):
            peak_time = answer[3:]
        elif answer.startswith("q8_"):
            val = answer[3:]
            break_style = "deep_work" if val == "deep" else val

    p = UserProfile(
        initiation_difficulty=dims["initiation_difficulty"],
        sustained_attention=dims["sustained_attention"],
        reading_load=dims["reading_load"],
        time_blindness=dims["time_blindness"],
        overwhelm_sensitivity=dims["overwhelm_sensitivity"],
        motivation_style=motivation,
        peak_time=peak_time,
        break_style=break_style,
    )
    save_profile(p)
    return p


# ── Rule-based advice generation ──────────────────────────────────────────────

def generate_advice(
    tasks: list[dict[str, Any]],
    schedule_today: list[dict[str, Any]],
    profile: Optional[UserProfile] = None,
) -> str:
    """Generate a warm, personalised 'what to do right now' message — no LLM needed."""
    if profile is None:
        profile = load_profile()

    today_name = _DOW_HE[(date.today().weekday() + 1) % 7]
    now_hour = datetime.now().hour

    # ── Find the ONE most important task ─────────────────────────────────────
    urgent = [t for t in tasks if t.get("status") != "Done" and t.get("priority") in ("Urgent", "High")]
    overdue = [t for t in tasks if t.get("due_date") and _is_overdue(t["due_date"])]
    in_progress = [t for t in tasks if t.get("status") == "In Progress"]

    if overdue:
        top = overdue[0]
        reason_he = "יש לה מועד הגשה שעבר"
        reason_en = "it's overdue"
    elif urgent:
        top = urgent[0]
        reason_he = "היא דחופה"
        reason_en = "it's urgent"
    elif in_progress:
        top = in_progress[0]
        reason_he = "כבר התחלת עליה"
        reason_en = "you already started it"
    elif tasks:
        top = tasks[0]
        reason_he = "היא הראשונה ברשימה"
        reason_en = "it's next on your list"
    else:
        top = None
        reason_he = reason_en = ""

    # ── Greeting / acknowledgment ─────────────────────────────────────────────
    if profile.lang == "he":
        if now_hour < 12:
            greeting = "בוקר טוב ☀️"
        elif now_hour < 18:
            greeting = "אחר הצהריים טובים 🌤"
        else:
            greeting = "ערב טוב 🌙"
        lost_ack = f"{greeting} — אני מבין שאתה מרגיש קצת אבוד. זה בסדר גמור, בואו נסדר את זה ביחד."
    else:
        if now_hour < 12:
            greeting = "Good morning ☀️"
        elif now_hour < 18:
            greeting = "Good afternoon 🌤"
        else:
            greeting = "Good evening 🌙"
        lost_ack = f"{greeting} — I can see you're feeling a bit lost. That's okay — let's sort it out together."

    # ── Next class context ────────────────────────────────────────────────────
    next_class_note = ""
    if schedule_today:
        now_str = datetime.now().strftime("%H:%M")
        upcoming = [s for s in schedule_today if s.get("start_time", "99:99") > now_str]
        if upcoming:
            c = upcoming[0]
            if profile.lang == "he":
                next_class_note = f"\nהשיעור הבא שלך: {c.get('subject_name', '')} ב-{c.get('start_time', '')}."
            else:
                next_class_note = f"\nYour next class: {c.get('subject_name', '')} at {c.get('start_time', '')}."

    # ── Task advice ───────────────────────────────────────────────────────────
    if top:
        title = top.get("title", "")
        prefix = profile.framing_prefix

        if profile.lang == "he":
            task_line = f"\n{prefix} הדבר החשוב ביותר עכשיו: **{title}** (כי {reason_he})."
            if profile.format_style == "bullets":
                steps = _steps_he(title, profile)
                task_advice = task_line + "\n\nצעדים קטנים להתחיל:\n" + "\n".join(f"• {s}" for s in steps)
            else:
                steps = _steps_he(title, profile)
                task_advice = task_line + " התחל עם: " + " → ".join(steps[:2]) + "."
        else:
            task_line = f"\n{prefix} The most important thing right now: **{title}** (because {reason_en})."
            steps = _steps_en(title, profile)
            task_advice = task_line + "\n\nSmall steps to start:\n" + "\n".join(f"• {s}" for s in steps)
    else:
        if profile.lang == "he":
            task_advice = "\nנראה שאין משימות פעילות. זה זמן מעולה לתכנן את השבוע שלך!"
        else:
            task_advice = "\nNo active tasks — great time to plan your week!"

    # ── Encouragement ─────────────────────────────────────────────────────────
    enc_map = {
        "gamified": ("🏆 כל צעד קטן מקרב אותך לניצחון. אתה יכול!", "🏆 Every small step is a win. You've got this!"),
        "social":   ("👥 חשוב על האנשים שמאמינים בך — הם תמיד שם בשבילך.", "👥 Think of the people rooting for you — they believe in you!"),
        "intrinsic":("🌱 הדרך לשם מתחילה בצעד אחד. תן לסקרנות שלך להוביל אותך.", "🌱 The path starts with one step. Let your curiosity lead the way."),
        "deadline": ("⏰ קדימה — כל דקה שאתה מתחיל עכשיו היא דקה שחוסכת אחר כך!", "⏰ Go for it — every minute you start now saves you later!"),
    }
    enc_he, enc_en = enc_map.get(profile.motivation_style, enc_map["deadline"])
    encouragement = "\n\n" + (enc_he if profile.lang == "he" else enc_en)

    return lost_ack + next_class_note + task_advice + encouragement


# ── Internal helpers ──────────────────────────────────────────────────────────

def _is_overdue(due_date: Any) -> bool:
    now = datetime.utcnow()
    if isinstance(due_date, datetime):
        return due_date < now
    if isinstance(due_date, str):
        try:
            return datetime.fromisoformat(due_date.rstrip("Z")) < now
        except ValueError:
            return False
    return False


def _steps_he(title: str, profile: UserProfile) -> list[str]:
    if profile.initiation_difficulty >= 3:
        warmup = "פתח את החומרים וקרא כותרות בלבד (5 דקות)"
    else:
        warmup = "קרא את ההוראות של המשימה פעם אחת"

    block = profile.block_minutes
    return [
        warmup,
        f"עבוד על החלק הראשון של {title} — {block} דקות ללא הסחות דעת",
        "עצור, בדוק מה עשית, ותכנן את הצעד הבא",
    ]


def _steps_en(title: str, profile: UserProfile) -> list[str]:
    block = profile.block_minutes
    return [
        "Open the materials and skim headings (5 min)",
        f"Work on the first part of {title} — {block} min, no distractions",
        "Stop, review your progress, plan the next step",
    ]
