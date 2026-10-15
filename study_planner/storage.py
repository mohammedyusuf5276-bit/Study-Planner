"""Persistent storage management for Study Planner using JSON."""

from __future__ import annotations
import json
import os
from typing import Dict, Any, List
from .models import Subject, Task, StudySession, DailyGoal

DEFAULT_FILE = "study_data.json"


class StorageManager:
    """Handles loading and saving planner data to disk."""

    def __init__(self, filepath: str = DEFAULT_FILE) -> None:
        self.filepath = filepath

    def default_dataset(self) -> Dict[str, Any]:
        """Provides starting sample subjects for a newly created planner."""
        return {
            "subjects": [
                {"id": "sub_frontend", "name": "FRONTEND", "target_weekly_hours": 8.0, "color": "#3b82f6"},
                {"id": "sub_dsa", "name": "DSA", "target_weekly_hours": 8.0, "color": "#10b981"},
                {"id": "sub_icp", "name": "ICP", "target_weekly_hours": 6.0, "color": "#f59e0b"},
                {"id": "sub_maths", "name": "MATHS", "target_weekly_hours": 6.0, "color": "#8b5cf6"},
            ],
            "tasks": [
                {
                    "id": "t_fe_1",
                    "title": "Build Responsive CSS Flexbox & Grid Dashboard",
                    "subject": "FRONTEND",
                    "due_date": "2026-10-18",
                    "estimated_hours": 3.0,
                    "actual_hours": 1.0,
                    "priority": "High",
                    "status": "In Progress",
                    "created_at": "2026-10-15T10:00:00",
                    "notes": "Modern responsive layout, CSS variables, and clean components."
                },
                {
                    "id": "t_dsa_1",
                    "title": "Solve 5 LeetCode Binary Tree & Graph Problems",
                    "subject": "DSA",
                    "due_date": "2026-10-19",
                    "estimated_hours": 3.5,
                    "actual_hours": 0.0,
                    "priority": "High",
                    "status": "Pending",
                    "created_at": "2026-10-15T10:00:00",
                    "notes": "BFS, DFS traversal and lowest common ancestor."
                }
            ],
            "sessions": [],
            "daily_goals": {}
        }

    def load_data(self) -> Dict[str, Any]:
        """Loads data from file or initializes if missing."""
        if not os.path.exists(self.filepath):
            data = self.default_dataset()
            self.save_data(data)
            return data

        try:
            with open(self.filepath, "r", encoding="utf-8") as f:
                data = json.load(f)
                # Ensure all root keys exist
                if "subjects" not in data:
                    data["subjects"] = []
                if "tasks" not in data:
                    data["tasks"] = []
                if "sessions" not in data:
                    data["sessions"] = []
                if "daily_goals" not in data:
                    data["daily_goals"] = {}
                return data
        except (json.JSONDecodeError, OSError):
            data = self.default_dataset()
            self.save_data(data)
            return data

    def save_data(self, data: Dict[str, Any]) -> None:
        """Atomically saves data to disk."""
        tmp_path = f"{self.filepath}.tmp"
        with open(tmp_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        os.replace(tmp_path, self.filepath)
