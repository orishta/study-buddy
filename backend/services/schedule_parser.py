"""
CSV/Excel/iCal schedule parser.

Converts an uploaded spreadsheet into a list of slot dicts ready to be
inserted into the ClassSchedule table. Accepts .csv and .xlsx files.

Expected columns (case-insensitive, Hebrew or English names):
  subject_name  | course | name | שם קורס       — required
  day_of_week   | day | יום                      — required; int 0–5 OR
                                                    name e.g. "ראשון"/"Sunday"
  start_time    | start | from | התחלה           — required, "HH:MM"
  end_time      | end | to | סיום                — required, "HH:MM"
  instructor    | teacher | מרצה                 — optional
  room          | location | חדר                 — optional
  color_code    | color | צבע                    — optional

Day-of-week mapping (same as app convention):
  0=ראשון/Sunday  1=שני/Monday  2=שלישי/Tuesday
  3=רביעי/Wednesday  4=חמישי/Thursday  5=שישי/Friday
"""
import csv
import io
import re
from datetime import datetime
from typing import Any

_DAY_MAP: dict[str, int] = {
    "0": 0, "sunday": 0, "ראשון": 0, "א": 0,
    "1": 1, "monday": 1, "שני": 1,   "ב": 1,
    "2": 2, "tuesday": 2, "שלישי": 2, "ג": 2,
    "3": 3, "wednesday": 3, "רביעי": 3, "ד": 3,
    "4": 4, "thursday": 4, "חמישי": 4, "ה": 4,
    "5": 5, "friday": 5, "שישי": 5,  "ו": 5,
}

_ALIASES: dict[str, list[str]] = {
    "subject_name": ["subject_name", "course", "name", "subject", "שם קורס", "קורס"],
    "day_of_week":  ["day_of_week", "day", "יום"],
    "start_time":   ["start_time", "start", "from", "התחלה"],
    "end_time":     ["end_time", "end", "to", "סיום"],
    "instructor":   ["instructor", "teacher", "מרצה"],
    "room":         ["room", "location", "חדר"],
    "color_code":   ["color_code", "color", "colour", "צבע"],
}


def _map_headers(headers: list[str]) -> dict[str, str]:
    """Return {canonical_field: actual_column_header} for the given header row."""
    lower_map = {h.lower().strip(): h for h in headers}
    result: dict[str, str] = {}
    for canonical, aliases in _ALIASES.items():
        for alias in aliases:
            if alias.lower() in lower_map:
                result[canonical] = lower_map[alias.lower()]
                break
    return result


def _parse_day(raw: str) -> int:
    key = raw.strip().lower()
    if key in _DAY_MAP:
        return _DAY_MAP[key]
    raise ValueError(f"Unknown day: '{raw}'. Use 0–5 or a name like 'ראשון' / 'Sunday'.")


def _parse_time(raw: str) -> str:
    raw = raw.strip()
    parts = raw.split(":")
    if len(parts) != 2:
        raise ValueError(f"Time must be HH:MM, got '{raw}'.")
    h, m = int(parts[0]), int(parts[1])
    if not (0 <= h <= 23 and 0 <= m <= 59):
        raise ValueError(f"Invalid time value: '{raw}'.")
    return f"{h:02d}:{m:02d}"


def _row_to_slot(row: dict[str, Any], mapping: dict[str, str]) -> dict:
    def get(field: str) -> str:
        col = mapping.get(field)
        return str(row.get(col, "") or "").strip()

    subject = get("subject_name")
    if not subject:
        raise ValueError("subject_name is required and cannot be empty.")

    day_raw = get("day_of_week")
    if not day_raw:
        raise ValueError("day_of_week is required.")

    start_raw = get("start_time")
    end_raw = get("end_time")
    if not start_raw:
        raise ValueError("start_time is required.")
    if not end_raw:
        raise ValueError("end_time is required.")

    return {
        "subject_name": subject,
        "day_of_week":  _parse_day(day_raw),
        "start_time":   _parse_time(start_raw),
        "end_time":     _parse_time(end_raw),
        "instructor":   get("instructor") or None,
        "room":         get("room") or None,
        "color_code":   get("color_code") or "#6B7C5E",
    }


def _collect(rows: list[dict], mapping: dict[str, str]) -> list[dict]:
    slots, errors = [], []
    for i, row in enumerate(rows, start=2):
        # Skip completely blank rows
        if not any(str(v).strip() for v in row.values()):
            continue
        try:
            slots.append(_row_to_slot(row, mapping))
        except ValueError as e:
            errors.append(f"Row {i}: {e}")

    if errors and not slots:
        raise ValueError("No valid rows found.\n" + "\n".join(errors))
    return slots


def parse_csv(content: bytes) -> list[dict]:
    """Parse a CSV file and return a list of slot dicts."""
    text = content.decode("utf-8-sig")  # strip BOM from Windows exports
    reader = csv.DictReader(io.StringIO(text))
    headers = list(reader.fieldnames or [])
    if not headers:
        raise ValueError("CSV file has no headers.")
    mapping = _map_headers(headers)
    if "subject_name" not in mapping or "day_of_week" not in mapping:
        raise ValueError(
            "Required columns not found. Make sure your file has 'subject_name' and 'day_of_week' columns."
        )
    return _collect(list(reader), mapping)


def parse_xlsx(content: bytes) -> list[dict]:
    """Parse an Excel .xlsx file and return a list of slot dicts."""
    try:
        import openpyxl
    except ImportError:
        raise RuntimeError("openpyxl is not installed. Run: pip install openpyxl")

    wb = openpyxl.load_workbook(io.BytesIO(content), read_only=True, data_only=True)
    ws = wb.active
    all_rows = list(ws.iter_rows(values_only=True))
    if not all_rows:
        raise ValueError("Spreadsheet is empty.")

    headers = [str(c).strip() if c is not None else "" for c in all_rows[0]]
    mapping = _map_headers(headers)
    if "subject_name" not in mapping or "day_of_week" not in mapping:
        raise ValueError(
            "Required columns not found. Make sure the first row has 'subject_name' and 'day_of_week' headers."
        )

    dict_rows = [
        {headers[j]: (str(v).strip() if v is not None else "") for j, v in enumerate(row)}
        for row in all_rows[1:]
    ]
    return _collect(dict_rows, mapping)


# ── iCal parser ────────────────────────────────────────────────────────────────

# Instructor title patterns used to split SUMMARY into course name + instructor
_INSTRUCTOR_TITLES = re.compile(
    r'\s+(ד"ר|פרופ\'?|גב\'|מר|מרצה|Dr\.?|Prof\.?)\s+', re.UNICODE
)

# Events to skip: zero-duration exams, holidays, semester markers
_SKIP_DESC_KW = ("חגי ישראל", "מועדי פתיחה", "מועדי סיום")
_SKIP_SUMMARY_KW = ("מבחן", "בוחן")

# Consistent color palette for auto-assigned course colors
_COLORS = [
    "#6B7C5E", "#7C6B7E", "#7E6B6B", "#6B7C7C", "#7C7B6B",
    "#5E7C6B", "#7C5E6B", "#6B7E7C", "#7E7C5E", "#5E6B7C",
]


def _color_for(name: str) -> str:
    return _COLORS[hash(name) % len(_COLORS)]


def _unfold(text: str) -> str:
    """Unfold iCal line continuations (lines starting with space/tab)."""
    return re.sub(r"\r?\n[ \t]", "", text)


def _parse_ical_events(text: str) -> list[dict[str, str]]:
    """Return raw field dicts for each VEVENT block."""
    text = _unfold(text)
    events = []
    for block in text.split("BEGIN:VEVENT")[1:]:
        block = block.split("END:VEVENT")[0]
        fields: dict[str, str] = {}
        for line in block.splitlines():
            line = line.strip()
            if not line or ":" not in line:
                continue
            key_part, _, value = line.partition(":")
            key = key_part.split(";")[0].upper()
            fields[key] = value
        if fields:
            events.append(fields)
    return events


def _clean_location(raw: str) -> str | None:
    """Shorten 'ווסטון 001 ווסטון - בניין 2 מכללה' → 'ווסטון 001'."""
    if not raw:
        return None
    # Split on '<space><building> - בניין' pattern
    cleaned = re.split(r"\s+\S+\s*-\s*בניין", raw)[0].strip()
    return cleaned or raw.strip() or None


def _split_summary(summary: str) -> tuple[str, str | None]:
    """Split 'אלגוריתמים ד"ר גולדנברג אלעזר' → ('אלגוריתמים', 'ד"ר גולדנברג אלעזר')."""
    m = _INSTRUCTOR_TITLES.search(summary)
    if m:
        course = summary[: m.start()].strip()
        instructor = summary[m.start():].strip()
        return course, instructor
    return summary.strip(), None


def _ical_time(dt_str: str) -> str:
    """Extract HH:MM from '20260409T120000'."""
    try:
        dt = datetime.strptime(dt_str[:15], "%Y%m%dT%H%M%S")
        return dt.strftime("%H:%M")
    except ValueError:
        return dt_str


def _ical_day_of_week(dt_str: str) -> int:
    """
    Extract day-of-week (0=Sun … 5=Fri) from '20260409T120000'.
    Python weekday(): 0=Mon … 6=Sun → (weekday+1)%7 maps to our convention.
    """
    try:
        dt = datetime.strptime(dt_str[:8], "%Y%m%d")
        return (dt.weekday() + 1) % 7
    except ValueError:
        return 0


def parse_ical(content: str | bytes) -> list[dict]:
    """
    Parse an iCal string/bytes (e.g. from the MTA calendar URL) and return
    a deduplicated list of weekly slot dicts.

    Filters out exams (DTSTART==DTEND), holidays, and semester markers.
    Groups repeated occurrences of the same class so each (course, day, time)
    appears only once.
    """
    if isinstance(content, bytes):
        content = content.decode("utf-8", errors="replace")

    raw_events = _parse_ical_events(content)

    # key → best slot dict (first occurrence wins for room)
    seen: dict[tuple, dict] = {}

    for ev in raw_events:
        summary = ev.get("SUMMARY", "").strip()
        dtstart = ev.get("DTSTART", "")
        dtend = ev.get("DTEND", "")
        description = ev.get("DESCRIPTION", "")
        location = ev.get("LOCATION", "")

        # Skip exams (zero-duration), holidays, semester markers
        if not dtstart or not dtend or dtstart == dtend:
            continue
        if any(kw in description for kw in _SKIP_DESC_KW):
            continue
        if any(kw in summary for kw in _SKIP_SUMMARY_KW):
            continue
        if not summary:
            continue

        course_name, instructor = _split_summary(summary)
        start_time = _ical_time(dtstart)
        end_time = _ical_time(dtend)
        day_of_week = _ical_day_of_week(dtstart)
        room = _clean_location(location)

        key = (course_name, day_of_week, start_time, end_time)
        if key not in seen:
            seen[key] = {
                "subject_name": course_name,
                "day_of_week": day_of_week,
                "start_time": start_time,
                "end_time": end_time,
                "instructor": instructor,
                "room": room,
                "color_code": _color_for(course_name),
            }

    if not seen:
        raise ValueError("No class events found in the calendar. Make sure the URL points to a personal student calendar.")

    return list(seen.values())
