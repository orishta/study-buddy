from datetime import datetime
from typing import Any, Optional
from pydantic import BaseModel, ConfigDict


# ── Settings ──────────────────────────────────────────────────────────────────

class SettingsUpdate(BaseModel):
    display_name: Optional[str] = None
    learning_style_profile: Optional[Any] = None
    whatsapp_number: Optional[str] = None
    daily_summary_time: Optional[str] = None
    peak_focus_start: Optional[str] = None
    peak_focus_end: Optional[str] = None
    pomodoro_duration: Optional[int] = None


class SettingsOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    display_name: str
    learning_style_profile: Optional[Any]
    whatsapp_number: Optional[str]
    daily_summary_time: str
    peak_focus_start: str
    peak_focus_end: str
    pomodoro_duration: int


# ── Courses ───────────────────────────────────────────────────────────────────

class CourseCreate(BaseModel):
    title: str
    color_code: str = "#6B7C5E"
    emoji: str = "📚"
    notebooklm_link: Optional[str] = None


class CourseUpdate(BaseModel):
    title: Optional[str] = None
    color_code: Optional[str] = None
    emoji: Optional[str] = None
    notebooklm_link: Optional[str] = None
    is_active: Optional[bool] = None


class CourseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    color_code: str
    emoji: str
    notebooklm_link: Optional[str]
    is_active: bool
    created_at: datetime


class CourseWithStats(CourseOut):
    todo_count: int = 0
    in_progress_count: int = 0
    done_count: int = 0
    total_count: int = 0


# ── Materials ─────────────────────────────────────────────────────────────────

class MaterialCreate(BaseModel):
    topic_name: str
    understanding_level: int = 3
    notes: Optional[str] = None


class MaterialUpdate(BaseModel):
    topic_name: Optional[str] = None
    understanding_level: Optional[int] = None
    notes: Optional[str] = None
    last_reviewed: Optional[datetime] = None


class MaterialOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    course_id: int
    topic_name: str
    understanding_level: int
    notes: Optional[str]
    last_reviewed: Optional[datetime]


# ── Tasks ─────────────────────────────────────────────────────────────────────

class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    course_id: Optional[int] = None
    parent_task_id: Optional[int] = None
    status: str = "Todo"
    priority: str = "Medium"
    due_date: Optional[datetime] = None
    estimated_minutes: Optional[int] = None
    position: int = 0


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    course_id: Optional[int] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    due_date: Optional[datetime] = None
    estimated_minutes: Optional[int] = None
    position: Optional[int] = None


class TaskStatusUpdate(BaseModel):
    status: str


class TaskReorderItem(BaseModel):
    id: int
    position: int
    status: str


class TaskReorder(BaseModel):
    tasks: list[TaskReorderItem]


class TaskOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: Optional[str]
    course_id: Optional[int]
    parent_task_id: Optional[int]
    status: str
    priority: str
    due_date: Optional[datetime]
    estimated_minutes: Optional[int]
    position: int
    is_notified: bool
    completed_at: Optional[datetime]
    created_at: datetime


class TaskWithSubtasks(TaskOut):
    subtasks: list[TaskOut] = []
