"""Unit tests for StudyPlanner and TimeTracker."""

import unittest
import os
import tempfile
import json
from study_planner.models import Subject, Task, StudySession
from study_planner.storage import StorageManager
from study_planner.planner import StudyPlanner
from study_planner.time_tracker import TimeTracker
from study_planner.analytics import StudyAnalytics


class TestStudyPlanner(unittest.TestCase):

    def setUp(self):
        self.temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".json")
        self.temp_file.close()
        self.storage = StorageManager(self.temp_file.name)
        self.planner = StudyPlanner(self.storage)
        self.tracker = TimeTracker(self.storage, self.planner)
        self.analytics = StudyAnalytics(self.planner, self.tracker)

    def tearDown(self):
        if os.path.exists(self.temp_file.name):
            os.remove(self.temp_file.name)

    def test_add_subject(self):
        sub = self.planner.add_subject("Chemistry", target_weekly_hours=7.0)
        self.assertEqual(sub.name, "Chemistry")
        self.assertEqual(sub.target_weekly_hours, 7.0)
        self.assertIn("Chemistry", self.planner.get_subject_names())

    def test_add_and_complete_task(self):
        task = self.planner.add_task(
            title="Read Chapter 1",
            subject="Mathematics",
            due_date="2026-10-25",
            estimated_hours=2.0,
            priority="High"
        )
        self.assertEqual(task.status, "Pending")
        self.assertEqual(task.priority, "High")

        # Update status
        updated = self.planner.update_task_status(task.id, "Completed")
        self.assertIsNotNone(updated)
        self.assertEqual(updated.status, "Completed")
        self.assertIsNotNone(updated.completed_at)

    def test_eisenhower_matrix(self):
        # Urgent task (due soon) + High priority -> Q1
        self.planner.add_task("Urgent Exam Prep", "Mathematics", "2026-10-16", priority="High")
        # Distant task + High priority -> Q2
        self.planner.add_task("Final Project", "Computer Science", "2026-11-20", priority="High")

        matrix = self.planner.get_eisenhower_matrix()
        self.assertIn("Q1_Do_First", matrix)
        self.assertIn("Q2_Schedule", matrix)
        self.assertGreaterEqual(len(matrix["Q1_Do_First"]), 1)

    def test_time_tracking_and_task_sync(self):
        task = self.planner.add_task("Coding Lab", "Computer Science", "2026-10-20", estimated_hours=3.0)
        self.assertEqual(task.actual_hours, 0.0)

        # Log 90-minute session linked to task
        session = self.tracker.log_manual_session(
            subject="Computer Science",
            duration_minutes=90,
            task_id=task.id,
            focus_score=5
        )
        self.assertEqual(session.duration_hours, 1.5)

        # Verify task actual hours was automatically updated
        refreshed_task = self.planner.tasks[task.id]
        self.assertEqual(refreshed_task.actual_hours, 1.5)
        self.assertEqual(refreshed_task.status, "In Progress")

    def test_analytics_and_efficiency_score(self):
        self.tracker.log_manual_session("Mathematics", 60, focus_score=5)
        eff = self.analytics.get_efficiency_report()
        self.assertGreater(eff["today_hours"], 0)
        self.assertGreater(eff["efficiency_score"], 0)
        self.assertLessEqual(eff["efficiency_score"], 100)

        tips = self.analytics.get_time_management_recommendations()
        self.assertIsInstance(tips, list)
        self.assertGreater(len(tips), 0)


if __name__ == "__main__":
    unittest.main()

