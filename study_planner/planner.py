"""Core planner logic for managing subjects, tasks, and study priorities."""

from __future__ import annotations
from typing import List, Optional, Dict, Any
from datetime import datetime, date, timedelta
from .models import Subject, Task, DailyGoal, generate_id
from .storage import StorageManager, DEFAULT_FILE


class StudyPlanner:
    """Manages subjects, academic tasks, priorities, and deadlines."""

    def __init__(self, storage_manager: Optional[StorageManager] = None) -> None:
        self.storage = storage_manager or StorageManager()
        self.subjects: Dict[str, Subject] = {}
        self.tasks: Dict[str, Task] = {}
        self.daily_goals: Dict[str, DailyGoal] = {}
        self.load()

    def load(self) -> None:
        """Loads planner data from storage."""
        raw = self.storage.load_data()
        self.subjects = {s["id"]: Subject.from_dict(s) for s in raw.get("subjects", [])}
        self.tasks = {t["id"]: Task.from_dict(t) for t in raw.get("tasks", [])}
        self.daily_goals = {k: DailyGoal.from_dict(v) for k, v in raw.get("daily_goals", {}).items()}

    def save(self) -> None:
        """Saves current state to storage while preserving sessions."""
        existing_raw = self.storage.load_data()
        existing_raw["subjects"] = [s.to_dict() for s in self.subjects.values()]
        existing_raw["tasks"] = [t.to_dict() for t in self.tasks.values()]
        existing_raw["daily_goals"] = {k: v.to_dict() for k, v in self.daily_goals.items()}
        self.storage.save_data(existing_raw)

    # ---------------- Subject Management ----------------
    def add_subject(self, name: str, target_weekly_hours: float = 5.0, color: str = "#4A90E2") -> Subject:
        """Adds a new subject."""
        # Check if subject with same name exists
        for sub in self.subjects.values():
            if sub.name.lower() == name.lower():
                sub.target_weekly_hours = target_weekly_hours
                sub.color = color
                self.save()
                return sub
        subject = Subject(name=name, target_weekly_hours=target_weekly_hours, color=color)
        self.subjects[subject.id] = subject
        self.save()
        return subject

    def remove_subject(self, subject_id: str) -> bool:
        """Removes a subject by ID."""
        if subject_id in self.subjects:
            del self.subjects[subject_id]
            self.save()
            return True
        return False

    def get_all_subjects(self) -> List[Subject]:
        """Returns list of subjects sorted alphabetically."""
        return sorted(self.subjects.values(), key=lambda s: s.name.lower())

    def get_subject_names(self) -> List[str]:
        """Returns list of subject names."""
        return [s.name for s in self.get_all_subjects()]

    # ---------------- Task Management ----------------
    def add_task(
        self,
        title: str,
        subject: str,
        due_date: str,
        estimated_hours: float = 1.0,
        priority: str = "Medium",
        notes: str = ""
    ) -> Task:
        """Creates and stores a new academic task."""
        # Ensure subject exists
        if subject not in [s.name for s in self.subjects.values()]:
            self.add_subject(subject)

        task = Task(
            title=title,
            subject=subject,
            due_date=due_date,
            estimated_hours=max(0.25, estimated_hours),
            priority=priority,
            notes=notes
        )
        self.tasks[task.id] = task
        self.save()
        return task

    def update_task_status(self, task_id: str, status: str) -> Optional[Task]:
        """Updates task status ('Pending', 'In Progress', 'Completed')."""
        task = self.tasks.get(task_id)
        if not task:
            return None
        task.status = status
        if status == "Completed":
            task.completed_at = datetime.now().isoformat()
        else:
            task.completed_at = None
        self.save()
        return task

    def delete_task(self, task_id: str) -> bool:
        """Deletes a task by ID."""
        if task_id in self.tasks:
            del self.tasks[task_id]
            self.save()
            return True
        return False

    def get_tasks(
        self,
        status: Optional[str] = None,
        subject: Optional[str] = None,
        priority: Optional[str] = None
    ) -> List[Task]:
        """Filter and retrieve tasks."""
        results = list(self.tasks.values())
        if status:
            results = [t for t in results if t.status.lower() == status.lower()]
        if subject:
            results = [t for t in results if t.subject.lower() == subject.lower()]
        if priority:
            results = [t for t in results if t.priority.lower() == priority.lower()]

        # Sort: Overdue & high priority first, then due date
        def sort_key(t: Task):
            is_done = 1 if t.status == "Completed" else 0
            prio_weight = {"high": 0, "medium": 1, "low": 2}.get(t.priority.lower(), 1)
            return (is_done, prio_weight, t.due_date)

        return sorted(results, key=sort_key)

    def get_upcoming_tasks(self, days_ahead: int = 7) -> List[Task]:
        """Returns non-completed tasks due within next N days."""
        today = date.today()
        limit = today + timedelta(days=days_ahead)
        upcoming = []
        for task in self.tasks.values():
            if task.status == "Completed":
                continue
            try:
                due = datetime.strptime(task.due_date, "%Y-%m-%d").date()
                if today <= due <= limit or due < today:
                    upcoming.append(task)
            except ValueError:
                continue
        return sorted(upcoming, key=lambda t: t.due_date)

    def get_eisenhower_matrix(self) -> Dict[str, List[Task]]:
        """Categorizes pending tasks into Eisenhower quadrants based on priority & urgency."""
        today = date.today()
        soon_threshold = today + timedelta(days=3)

        q1_urgent_important = []      # Do First: High priority + due within 3 days or overdue
        q2_not_urgent_important = []  # Schedule: High priority + due later, or Medium priority
        q3_urgent_not_important = []  # Delegate / Quick: Low priority + due soon
        q4_neither = []               # Don't stress: Low priority + due later

        for task in self.get_tasks():
            if task.status == "Completed":
                continue
            try:
                due = datetime.strptime(task.due_date, "%Y-%m-%d").date()
                is_urgent = due <= soon_threshold
            except ValueError:
                is_urgent = False

            is_important = task.priority.lower() in ("high", "medium")

            if is_urgent and is_important:
                q1_urgent_important.append(task)
            elif (not is_urgent) and is_important:
                q2_not_urgent_important.append(task)
            elif is_urgent and (not is_important):
                q3_urgent_not_important.append(task)
            else:
                q4_neither.append(task)

        return {
            "Q1_Do_First": q1_urgent_important,
            "Q2_Schedule": q2_not_urgent_important,
            "Q3_Delegate_Or_Quick": q3_urgent_not_important,
            "Q4_Low_Priority": q4_neither,
        }

    # ---------------- Daily Goals ----------------
    def set_daily_goal(self, target_hours: float, target_date: Optional[str] = None, notes: str = "") -> DailyGoal:
        """Sets a target study hours goal for a specific date."""
        target_date = target_date or date.today().isoformat()
        goal = DailyGoal(date=target_date, target_hours=max(0.5, target_hours), notes=notes)
        self.daily_goals[target_date] = goal
        self.save()
        return goal

    def get_daily_goal(self, target_date: Optional[str] = None) -> float:
        """Retrieves target study hours for a date, default 3.0 hrs."""
        target_date = target_date or date.today().isoformat()
        if target_date in self.daily_goals:
            return self.daily_goals[target_date].target_hours
        return 3.0
