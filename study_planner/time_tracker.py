"""Time management and study session tracking module."""

from __future__ import annotations
import time
from datetime import datetime, date
from typing import Optional, List, Dict, Any, Callable
from .models import StudySession, Task
from .storage import StorageManager
from .planner import StudyPlanner


class TimeTracker:
    """Manages study sessions, Pomodoro intervals, and study time logging."""

    def __init__(self, storage_manager: Optional[StorageManager] = None, planner: Optional[StudyPlanner] = None) -> None:
        self.storage = storage_manager or StorageManager()
        self.planner = planner or StudyPlanner(self.storage)
        self.sessions: List[StudySession] = []
        self.load_sessions()

        # Active session state
        self.is_active: bool = False
        self.is_paused: bool = False
        self.session_mode: str = "pomodoro"  # "pomodoro" or "stopwatch"
        self.current_subject: str = "General"
        self.current_task_id: Optional[str] = None
        self.start_epoch: float = 0.0
        self.accumulated_seconds: float = 0.0
        self.last_pause_epoch: float = 0.0
        self.target_duration_seconds: float = 25 * 60  # Default 25 min Pomodoro
        self.pomodoro_state: str = "IDLE"  # IDLE, FOCUSING, SHORT_BREAK, LONG_BREAK
        self.pomodoros_completed_today: int = 0

    def load_sessions(self) -> None:
        """Loads logged study sessions from disk."""
        data = self.storage.load_data()
        self.sessions = [StudySession.from_dict(s) for s in data.get("sessions", [])]

    def save_sessions(self) -> None:
        """Saves sessions to persistent storage."""
        data = self.storage.load_data()
        data["sessions"] = [s.to_dict() for s in self.sessions]
        self.storage.save_data(data)

    # ---------------- Timer Operations ----------------
    def start_pomodoro(
        self,
        subject: str,
        task_id: Optional[str] = None,
        work_minutes: int = 25
    ) -> None:
        """Starts a Pomodoro focus interval."""
        self.is_active = True
        self.is_paused = False
        self.session_mode = "pomodoro"
        self.pomodoro_state = "FOCUSING"
        self.current_subject = subject
        self.current_task_id = task_id
        self.target_duration_seconds = work_minutes * 60
        self.accumulated_seconds = 0.0
        self.start_epoch = time.time()

    def start_stopwatch(
        self,
        subject: str,
        task_id: Optional[str] = None
    ) -> None:
        """Starts an open-ended study stopwatch."""
        self.is_active = True
        self.is_paused = False
        self.session_mode = "stopwatch"
        self.pomodoro_state = "FOCUSING"
        self.current_subject = subject
        self.current_task_id = task_id
        self.target_duration_seconds = 0.0
        self.accumulated_seconds = 0.0
        self.start_epoch = time.time()

    def pause(self) -> None:
        """Pauses the active timer."""
        if self.is_active and not self.is_paused:
            self.accumulated_seconds += time.time() - self.start_epoch
            self.is_paused = True

    def resume(self) -> None:
        """Resumes the paused timer."""
        if self.is_active and self.is_paused:
            self.start_epoch = time.time()
            self.is_paused = False

    def get_elapsed_seconds(self) -> float:
        """Returns total elapsed focus seconds for active session."""
        if not self.is_active:
            return 0.0
        if self.is_paused:
            return self.accumulated_seconds
        return self.accumulated_seconds + (time.time() - self.start_epoch)

    def get_remaining_seconds(self) -> float:
        """Returns remaining seconds for countdown / Pomodoro timer."""
        if self.session_mode != "pomodoro" or not self.is_active:
            return 0.0
        rem = self.target_duration_seconds - self.get_elapsed_seconds()
        return max(0.0, rem)

    def is_target_reached(self) -> bool:
        """Checks if the Pomodoro work interval has elapsed."""
        if self.session_mode == "pomodoro" and self.is_active:
            return self.get_elapsed_seconds() >= self.target_duration_seconds
        return False

    def finish_session(
        self,
        focus_score: int = 5,
        notes: str = ""
    ) -> Optional[StudySession]:
        """Stops active timer, logs the study session, and updates associated task hours."""
        if not self.is_active:
            return None

        total_seconds = self.get_elapsed_seconds()
        duration_minutes = round(total_seconds / 60.0, 2)

        start_iso = datetime.fromtimestamp(
            time.time() - total_seconds
        ).isoformat()
        end_iso = datetime.now().isoformat()

        session = StudySession(
            subject=self.current_subject,
            task_id=self.current_task_id,
            duration_minutes=duration_minutes,
            start_time=start_iso,
            end_time=end_iso,
            focus_score=max(1, min(5, focus_score)),
            session_type=self.session_mode,
            notes=notes
        )

        self.sessions.append(session)
        self.save_sessions()

        # Update task actual hours if linked
        if self.current_task_id and self.current_task_id in self.planner.tasks:
            task = self.planner.tasks[self.current_task_id]
            task.actual_hours = round(task.actual_hours + (duration_minutes / 60.0), 2)
            if task.status == "Pending":
                task.status = "In Progress"
            self.planner.save()

        if self.session_mode == "pomodoro":
            self.pomodoros_completed_today += 1

        # Reset active state
        self.is_active = False
        self.is_paused = False
        self.pomodoro_state = "IDLE"
        self.accumulated_seconds = 0.0

        return session

    def cancel_session(self) -> None:
        """Cancels active timer without saving."""
        self.is_active = False
        self.is_paused = False
        self.pomodoro_state = "IDLE"
        self.accumulated_seconds = 0.0

    # ---------------- Manual Logging ----------------
    def log_manual_session(
        self,
        subject: str,
        duration_minutes: float,
        session_date: Optional[str] = None,
        task_id: Optional[str] = None,
        focus_score: int = 5,
        notes: str = ""
    ) -> StudySession:
        """Logs a completed study session manually (e.g. studied offline/library)."""
        target_date = session_date or date.today().isoformat()
        start_iso = f"{target_date}T10:00:00"
        end_iso = f"{target_date}T11:00:00"

        session = StudySession(
            subject=subject,
            duration_minutes=max(1.0, float(duration_minutes)),
            start_time=start_iso,
            end_time=end_iso,
            task_id=task_id,
            focus_score=max(1, min(5, focus_score)),
            session_type="manual",
            notes=notes
        )

        self.sessions.append(session)
        self.save_sessions()

        if task_id and task_id in self.planner.tasks:
            task = self.planner.tasks[task_id]
            task.actual_hours = round(task.actual_hours + (duration_minutes / 60.0), 2)
            if task.status == "Pending":
                task.status = "In Progress"
            self.planner.save()

        return session

    # ---------------- Query Sessions ----------------
    def get_sessions(
        self,
        subject: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> List[StudySession]:
        """Retrieves filtered list of recorded study sessions."""
        res = self.sessions
        if subject:
            res = [s for s in res if s.subject.lower() == subject.lower()]
        if start_date:
            res = [s for s in res if s.session_date >= start_date]
        if end_date:
            res = [s for s in res if s.session_date <= end_date]
        return sorted(res, key=lambda s: s.start_time, reverse=True)
