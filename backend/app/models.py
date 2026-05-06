from datetime import datetime
from typing import Optional
from sqlalchemy import (
    Boolean, Column, DateTime, Enum, ForeignKey,
    Integer, JSON, String, Text,
)
from sqlalchemy.orm import relationship
from .database import Base


class UserSettings(Base):
    __tablename__ = "user_settings"

    id = Column(Integer, primary_key=True, index=True)
    display_name = Column(String, default="Student")
    learning_style_profile = Column(JSON, nullable=True)
    whatsapp_number = Column(String, nullable=True)
    daily_summary_time = Column(String, default="08:00")
    peak_focus_start = Column(String, default="09:00")
    peak_focus_end = Column(String, default="13:00")
    pomodoro_duration = Column(Integer, default=25)


class Course(Base):
    __tablename__ = "courses"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    color_code = Column(String, default="#6B7C5E")
    emoji = Column(String, default="📚")
    notebooklm_link = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    tasks = relationship("Task", back_populates="course", lazy="select")
    materials = relationship("MaterialTracking", back_populates="course", lazy="select")


class MaterialTracking(Base):
    __tablename__ = "materials_tracking"

    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False)
    topic_name = Column(String, nullable=False)
    understanding_level = Column(Integer, default=3)
    notes = Column(Text, nullable=True)
    last_reviewed = Column(DateTime, nullable=True)

    course = relationship("Course", back_populates="materials")


class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=True)
    parent_task_id = Column(Integer, ForeignKey("tasks.id"), nullable=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    status = Column(
        Enum("Todo", "In Progress", "Done", name="task_status"),
        default="Todo",
        nullable=False,
    )
    priority = Column(
        Enum("Low", "Medium", "High", "Urgent", name="task_priority"),
        default="Medium",
        nullable=False,
    )
    due_date = Column(DateTime, nullable=True)
    estimated_minutes = Column(Integer, nullable=True)
    position = Column(Integer, default=0)
    is_notified = Column(Boolean, default=False)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    course = relationship("Course", back_populates="tasks")
    subtasks = relationship("Task", back_populates="parent_task", foreign_keys=[parent_task_id])
    parent_task = relationship("Task", back_populates="subtasks", remote_side=[id], foreign_keys=[parent_task_id])


class CommunicationsCache(Base):
    __tablename__ = "communications_cache"

    id = Column(Integer, primary_key=True, index=True)
    source = Column(Enum("Gmail", "Calendar", name="comm_source"), nullable=False)
    external_id = Column(String, nullable=True)
    content_summary = Column(Text, nullable=True)
    raw_snippet = Column(Text, nullable=True)
    timestamp = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class StudySession(Base):
    __tablename__ = "study_sessions"

    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=True)
    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=True)
    started_at = Column(DateTime, nullable=False)
    ended_at = Column(DateTime, nullable=True)
    duration_minutes = Column(Integer, nullable=True)
    notes = Column(Text, nullable=True)


class WeeklyDiagnostic(Base):
    __tablename__ = "weekly_diagnostics"

    id = Column(Integer, primary_key=True, index=True)
    week_start = Column(DateTime, nullable=False)
    responses = Column(JSON, nullable=True)
    ai_feedback = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class ClassSchedule(Base):
    __tablename__ = "class_schedule"

    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=True)
    subject_name = Column(String, nullable=False)
    instructor = Column(String, nullable=True)
    # 0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday
    day_of_week = Column(Integer, nullable=False)
    start_time = Column(String, nullable=False)   # "08:15"
    end_time = Column(String, nullable=False)     # "11:45"
    room = Column(String, nullable=True)
    color_code = Column(String, default="#6B7C5E")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
