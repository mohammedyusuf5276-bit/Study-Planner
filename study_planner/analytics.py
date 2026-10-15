"""Study Analytics & Time Management Insights Engine.

Calculates study metrics, goal tracking, focus scores, subject distribution,
streaks, and actionable efficiency recommendations.
"""

from __future__ import annotations
from typing import Dict, Any, List, Tuple, Optional
from datetime import datetime, date, timedelta
from .models import StudySession, Task, Subject
from .planner import StudyPlanner
from .time_tracker import TimeTracker


class StudyAnalytics:
    """Computes time efficiency metrics and actionable coaching recommendations."""

    def __init__(self, planner: StudyPlanner, tracker: TimeTracker) -> None:
        self.planner = planner
        self.tracker = tracker

    # ---------------- Basic Metrics ----------------
    def get_hours_today(self, target_date: Optional[str] = None) -> float:
        """Returns total hours studied on a specific day (default today)."""
        target = target_date or date.today().isoformat()
        sessions = [s for s in self.tracker.sessions if s.session_date == target]
        total_mins = sum(s.duration_minutes for s in sessions)
        return round(total_mins / 60.0, 2)

    def get_hours_in_range(self, start_date: str, end_date: str) -> float:
        """Returns total hours studied between two dates (inclusive)."""
        sessions = [s for s in self.tracker.sessions if start_date <= s.session_date <= end_date]
        total_mins = sum(s.duration_minutes for s in sessions)
        return round(total_mins / 60.0, 2)

    def get_current_week_hours(self) -> float:
        """Returns total hours studied in the current week (Monday to Sunday)."""
        today = date.today()
        start_of_week = today - timedelta(days=today.weekday())
        return self.get_hours_in_range(start_of_week.isoformat(), today.isoformat())

    def get_all_time_hours(self) -> float:
        """Returns total study hours logged in the system."""
        total_mins = sum(s.duration_minutes for s in self.tracker.sessions)
        return round(total_mins / 60.0, 2)

    # ---------------- Subject Breakdown ----------------
    def get_subject_breakdown(self, days: int = 7) -> Dict[str, Dict[str, Any]]:
        """Returns study hours per subject over the last N days with weekly targets."""
        start_date = (date.today() - timedelta(days=days - 1)).isoformat()
        end_date = date.today().isoformat()
        recent_sessions = [s for s in self.tracker.sessions if start_date <= s.session_date <= end_date]

        breakdown: Dict[str, Dict[str, Any]] = {}
        for sub in self.planner.get_all_subjects():
            breakdown[sub.name] = {
                "hours_spent": 0.0,
                "target_weekly_hours": sub.target_weekly_hours,
                "percentage_of_target": 0.0,
                "sessions_count": 0,
                "avg_focus": 0.0,
                "color": sub.color
            }

        focus_totals: Dict[str, List[int]] = {}
        for s in recent_sessions:
            if s.subject not in breakdown:
                breakdown[s.subject] = {
                    "hours_spent": 0.0,
                    "target_weekly_hours": 5.0,
                    "percentage_of_target": 0.0,
                    "sessions_count": 0,
                    "avg_focus": 0.0,
                    "color": "#999999"
                }
            breakdown[s.subject]["hours_spent"] += s.duration_minutes / 60.0
            breakdown[s.subject]["sessions_count"] += 1
            focus_totals.setdefault(s.subject, []).append(s.focus_score)

        for name, data in breakdown.items():
            data["hours_spent"] = round(data["hours_spent"], 2)
            target = data["target_weekly_hours"]
            if target > 0:
                data["percentage_of_target"] = round(min(100.0, (data["hours_spent"] / target) * 100), 1)
            f_scores = focus_totals.get(name, [])
            data["avg_focus"] = round(sum(f_scores) / len(f_scores), 1) if f_scores else 5.0

        return breakdown

    # ---------------- Streak Tracking ----------------
    def get_study_streak(self) -> Dict[str, int]:
        """Calculates current consecutive study day streak and longest streak."""
        if not self.tracker.sessions:
            return {"current_streak": 0, "longest_streak": 0}

        study_dates = set(s.session_date for s in self.tracker.sessions if s.duration_minutes >= 15.0)
        today = date.today()
        yesterday = today - timedelta(days=1)

        # Check current streak
        current_streak = 0
        check_date = today if today.isoformat() in study_dates else yesterday
        while check_date.isoformat() in study_dates:
            current_streak += 1
            check_date -= timedelta(days=1)

        # Calculate longest streak
        sorted_dates = sorted([datetime.strptime(d, "%Y-%m-%d").date() for d in study_dates])
        longest_streak = 0
        temp_streak = 0
        prev_date: Optional[date] = None

        for d in sorted_dates:
            if prev_date is None or d == prev_date + timedelta(days=1):
                temp_streak += 1
            elif d > prev_date + timedelta(days=1):
                temp_streak = 1
            longest_streak = max(longest_streak, temp_streak)
            prev_date = d

        return {
            "current_streak": current_streak,
            "longest_streak": max(longest_streak, current_streak)
        }

    # ---------------- Efficiency & Focus Metrics ----------------
    def get_efficiency_report(self) -> Dict[str, Any]:
        """Computes comprehensive time management and planning efficiency metrics."""
        today_iso = date.today().isoformat()
        today_hours = self.get_hours_today(today_iso)
        today_goal = self.planner.get_daily_goal(today_iso)
        daily_goal_pct = round(min(100.0, (today_hours / today_goal) * 100), 1) if today_goal > 0 else 100.0

        week_hours = self.get_current_week_hours()
        total_weekly_target = sum(s.target_weekly_hours for s in self.planner.get_all_subjects())
        weekly_target_pct = round(min(100.0, (week_hours / total_weekly_target) * 100), 1) if total_weekly_target > 0 else 0.0

        # Average focus rating
        all_focus = [s.focus_score for s in self.tracker.sessions]
        avg_focus = round(sum(all_focus) / len(all_focus), 1) if all_focus else 5.0

        # Estimation accuracy on completed tasks
        completed_tasks = [t for t in self.planner.tasks.values() if t.status == "Completed"]
        estimation_ratio = 1.0
        if completed_tasks:
            total_est = sum(t.estimated_hours for t in completed_tasks)
            total_act = sum(t.actual_hours for t in completed_tasks)
            if total_est > 0:
                # 1.0 means perfect estimation, >1.0 means student took longer than estimated
                estimation_ratio = round(total_act / total_est, 2)

        # Efficiency Score (out of 100)
        # Weighted blend of goal completion, average focus, and consistency
        streak_info = self.get_study_streak()
        streak_factor = min(20, streak_info["current_streak"] * 4)  # up to 20 pts
        focus_factor = (avg_focus / 5.0) * 40                       # up to 40 pts
        goal_factor = (min(100.0, daily_goal_pct) / 100.0) * 40     # up to 40 pts
        efficiency_score = int(round(streak_factor + focus_factor + goal_factor))

        return {
            "today_hours": today_hours,
            "today_goal": today_goal,
            "today_goal_pct": daily_goal_pct,
            "week_hours": week_hours,
            "weekly_target_hours": round(total_weekly_target, 1),
            "weekly_target_pct": weekly_target_pct,
            "avg_focus": avg_focus,
            "total_sessions": len(self.tracker.sessions),
            "current_streak": streak_info["current_streak"],
            "longest_streak": streak_info["longest_streak"],
            "estimation_ratio": estimation_ratio,
            "efficiency_score": max(0, min(100, efficiency_score)),
        }

    # ---------------- Smart Recommendations ----------------
    def get_time_management_recommendations(self) -> List[str]:
        """Generates smart recommendations to help students use time efficiently."""
        tips: List[str] = []
        eff = self.get_efficiency_report()
        breakdown = self.get_subject_breakdown(days=7)
        upcoming = self.planner.get_upcoming_tasks(days_ahead=3)

        # 1. Daily study goal status
        if eff["today_hours"] < eff["today_goal"]:
            remaining = round(eff["today_goal"] - eff["today_hours"], 1)
            tips.append(f"⏱️ You are {remaining}h away from today's study goal ({eff['today_goal']}h). A 25-minute Pomodoro session will keep your momentum.")
        else:
            tips.append(f"🎯 Great job! You hit today's study target ({eff['today_hours']}h / {eff['today_goal']}h).")

        # 2. Urgent upcoming tasks
        overdue_tasks = [t for t in self.planner.get_tasks() if t.is_overdue]
        if overdue_tasks:
            tips.append(f"⚠️ You have {len(overdue_tasks)} overdue task(s)! Prioritize '{overdue_tasks[0].title}' first.")
        elif upcoming:
            urgent = upcoming[0]
            tips.append(f"📅 Priority alert: '{urgent.title}' ({urgent.subject}) is due in {urgent.days_remaining} day(s). Allocate time for it today.")

        # 3. Neglected subjects check
        neglected = []
        for name, data in breakdown.items():
            if data["target_weekly_hours"] > 0 and data["percentage_of_target"] < 35.0:
                neglected.append((name, data["percentage_of_target"]))

        if neglected:
            sub_name, pct = sorted(neglected, key=lambda x: x[1])[0]
            tips.append(f"📚 Subject balance: '{sub_name}' is currently at only {pct}% of its weekly goal. Dedicate your next study block here.")

        # 4. Estimation accuracy feedback
        ratio = eff["estimation_ratio"]
        if ratio > 1.3:
            tips.append("💡 Tasks are taking ~30% longer than estimated. Break tasks into smaller sub-tasks for sharper focus and accuracy.")
        elif ratio < 0.7 and eff["total_sessions"] > 5:
            tips.append("🚀 You are finishing tasks faster than expected! Consider challenging yourself with deeper review or extra problem sets.")

        # 5. Focus & Rest guidance
        if eff["avg_focus"] < 3.5:
            tips.append("🧘 Focus rating is below average. Try studying in full-screen with your phone in another room using 25-minute Pomodoro sprints.")
        else:
            tips.append("✨ High focus detected! Maintain regular 5-minute hydration breaks to sustain cognitive endurance.")

        return tips

    # ---------------- ASCII Chart for Terminal / CLI ----------------
    def render_ascii_daily_chart(self, days: int = 7) -> str:
        """Renders an ASCII horizontal bar chart of study hours for the last N days."""
        today = date.today()
        lines = []
        lines.append("📊 Last 7 Days Study Hours:")
        max_hours = 0.1

        day_data = []
        for i in range(days - 1, -1, -1):
            d = today - timedelta(days=i)
            hrs = self.get_hours_today(d.isoformat())
            day_name = d.strftime("%a %d")
            day_data.append((day_name, hrs))
            if hrs > max_hours:
                max_hours = hrs

        scale = 20.0 / max(max_hours, 4.0)  # max bar width = 20 chars

        for day_name, hrs in day_data:
            bar_len = int(hrs * scale)
            bar = "█" * bar_len
            lines.append(f"  {day_name:>6}: {bar:<20} {hrs:>4.1f} hrs")

        return "\n".join(lines)
