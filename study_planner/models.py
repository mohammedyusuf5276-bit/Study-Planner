"""Data models for Study Planner & Time Management System."""

from __future__ import annotations
from dataclasses import dataclass, field, asdict
from datetime import datetime, date
from typing import Optional, Dict, Any
import uuid


def generate_id() -> str:
    """Generate a unique short identifier."""
    return uuid.uuid4().hex[:8]


@dataclass
class Subject:
    name: str
    target_weekly_hours: float = 5.0
    color: str = "#4A90E2"
    id: str = field(default_factory=generate_id)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> Subject:
        return cls(
            id=data.get("id", generate_id()),
            name=data["name"],
            target_weekly_hours=float(data.get("target_weekly_hours", 5.0)),
            color=data.get("color", "#4A90E2")
        )


@dataclass
class Task:
    title: str
    subject: str
    due_date: str  # YYYY-MM-DD
    estimated_hours: float = 1.0
    actual_hours: float = 0.0
    priority: str = "Medium"  # High, Medium, Low
    status: str = "Pending"    # Pending, In Progress, Completed
    id: str = field(default_factory=generate_id)
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    completed_at: Optional[str] = None
    notes: str = ""

    def mark_completed(self) -> None:
        self.status = "Completed"
        self.completed_at = datetime.now().isoformat()

    @property
    def is_overdue(self) -> bool:
        if self.status == "Completed":
            return False
        try:
            due = datetime.strptime(self.due_date, "%Y-%m-%d").date()
            return due < date.today()
        except ValueError:
            return False

    @property
    def days_remaining(self) -> Optional[int]:
        try:
            due = datetime.strptime(self.due_date, "%Y-%m-%d").date()
            return (due - date.today()).days
        except ValueError:
            return None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> Task:
        return cls(
            id=data.get("id", generate_id()),
            title=data["title"],
            subject=data.get("subject", "General"),
            due_date=data.get("due_date", date.today().isoformat()),
            estimated_hours=float(data.get("estimated_hours", 1.0)),
            actual_hours=float(data.get("actual_hours", 0.0)),
            priority=data.get("priority", "Medium"),
            status=data.get("status", "Pending"),
            created_at=data.get("created_at", datetime.now().isoformat()),
            completed_at=data.get("completed_at"),
            notes=data.get("notes", "")
        )


@dataclass
class StudySession:
    subject: str
    duration_minutes: float
    start_time: str
    end_time: str
    id: str = field(default_factory=generate_id)
    task_id: Optional[str] = None
    focus_score: int = 5  # 1 (distracted) to 5 (highly focused)
    session_type: str = "pomodoro"  # "pomodoro", "stopwatch", "manual"
    notes: str = ""

    @property
    def duration_hours(self) -> float:
        return round(self.duration_minutes / 60.0, 2)

    @property
    def session_date(self) -> str:
        try:
            return self.start_time.split("T")[0]
        except Exception:
            return date.today().isoformat()

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> StudySession:
        return cls(
            id=data.get("id", generate_id()),
            subject=data.get("subject", "General"),
            duration_minutes=float(data.get("duration_minutes", 0.0)),
            start_time=data.get("start_time", datetime.now().isoformat()),
            end_time=data.get("end_time", datetime.now().isoformat()),
            task_id=data.get("task_id"),
            focus_score=int(data.get("focus_score", 5)),
            session_type=data.get("session_type", "manual"),
            notes=data.get("notes", "")
        )


@dataclass
class DailyGoal:
    date: str  # YYYY-MM-DD
    target_hours: float = 3.0
    notes: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> DailyGoal:
        return cls(
            date=data.get("date", date.today().isoformat()),
            target_hours=float(data.get("target_hours", 3.0)),
            notes=data.get("notes", "")
        )
