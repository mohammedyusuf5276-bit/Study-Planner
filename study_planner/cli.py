"""Interactive Terminal / Command Line Interface for Study Planner."""

from __future__ import annotations
import sys
import time
from datetime import datetime, date
from typing import Optional
from .planner import StudyPlanner
from .time_tracker import TimeTracker
from .analytics import StudyAnalytics
from .models import Task


# Terminal colors (ANSI)
class Colors:
    HEADER = "\033[95m"
    BLUE = "\033[94m"
    CYAN = "\033[96m"
    GREEN = "\033[92m"
    YELLOW = "\033[93m"
    RED = "\033[91m"
    BOLD = "\033[1m"
    UNDERLINE = "\033[4m"
    END = "\033[0m"


def clear_screen() -> None:
    # Print clean separator
    print("\n" + "=" * 65 + "\n")


class StudyPlannerCLI:
    """CLI Controller for Study Planner & Time Management."""

    def __init__(self, planner: StudyPlanner, tracker: TimeTracker, analytics: StudyAnalytics) -> None:
        self.planner = planner
        self.tracker = tracker
        self.analytics = analytics

    def display_header(self) -> None:
        eff = self.analytics.get_efficiency_report()
        print(f"{Colors.BOLD}{Colors.CYAN}================================================================={Colors.END}")
        print(f"{Colors.BOLD}{Colors.BLUE}     🎓 SMART STUDY PLANNER & TIME MANAGEMENT SYSTEM ⏱️          {Colors.END}")
        print(f"{Colors.BOLD}{Colors.CYAN}================================================================={Colors.END}")
        print(
            f" Today: {Colors.BOLD}{date.today().strftime('%A, %b %d, %Y')}{Colors.END} | "
            f"Today's Study: {Colors.GREEN}{eff['today_hours']:.1f}h / {eff['today_goal']:.1f}h ({eff['today_goal_pct']}%){Colors.END} | "
            f"Streak: 🔥 {Colors.YELLOW}{eff['current_streak']} days{Colors.END}"
        )
        print(
            f" Week Study: {Colors.CYAN}{eff['week_hours']:.1f}h / {eff['weekly_target_hours']:.1f}h{Colors.END} | "
            f"Efficiency Score: {Colors.BOLD}{eff['efficiency_score']}/100{Colors.END} | "
            f"Focus: ⭐ {eff['avg_focus']}/5.0"
        )
        print("-" * 65)

    def run(self) -> None:
        """Main CLI loop."""
        if sys.platform == "win32":
            try:
                sys.stdout.reconfigure(encoding="utf-8")
            except Exception:
                pass
        while True:
            self.display_header()
            print(f"{Colors.BOLD}Main Menu:{Colors.END}")
            print(f" {Colors.GREEN}1.{Colors.END} 📋 View Tasks & Academic Deadlines")
            print(f" {Colors.GREEN}2.{Colors.END} ➕ Add New Task")
            print(f" {Colors.GREEN}3.{Colors.END} ✅ Update Task Status / Complete Task")
            print(f" {Colors.GREEN}4.{Colors.END} ⏱️  Start Pomodoro Focus Timer (25/50 min)")
            print(f" {Colors.GREEN}5.{Colors.END} ⏳ Start Open Stopwatch Study Session")
            print(f" {Colors.GREEN}6.{Colors.END} ✍️  Log Past Study Hours Manually")
            print(f" {Colors.GREEN}7.{Colors.END} 📊 View Time Analytics, Charts & Smart Tips")
            print(f" {Colors.GREEN}8.{Colors.END} 🎯 Set Daily Study Goal")
            print(f" {Colors.GREEN}9.{Colors.END} 📚 Manage Subjects & Weekly Targets")
            print(f" {Colors.RED}0.{Colors.END} 🚪 Exit")
            print("-" * 65)

            choice = input(f"{Colors.BOLD}Select an option [0-9]: {Colors.END}").strip()

            if choice == "1":
                self.view_tasks_menu()
            elif choice == "2":
                self.add_task_menu()
            elif choice == "3":
                self.update_task_menu()
            elif choice == "4":
                self.start_pomodoro_menu()
            elif choice == "5":
                self.start_stopwatch_menu()
            elif choice == "6":
                self.manual_log_menu()
            elif choice == "7":
                self.view_analytics_menu()
            elif choice == "8":
                self.set_daily_goal_menu()
            elif choice == "9":
                self.manage_subjects_menu()
            elif choice == "0":
                print(f"\n{Colors.GREEN}Keep up the great work! Happy studying! 🚀{Colors.END}\n")
                break
            else:
                print(f"{Colors.RED}Invalid selection. Please choose 0 to 9.{Colors.END}\n")

    # ---------------- Menu Handlers ----------------
    def view_tasks_menu(self) -> None:
        clear_screen()
        print(f"{Colors.BOLD}📋 Task List & Deadlines:{Colors.END}\n")
        tasks = self.planner.get_tasks()
        if not tasks:
            print("No tasks found. Press 2 in the main menu to add your first task!")
        else:
            print(f"{'ID':<10} {'Title':<28} {'Subject':<14} {'Due Date':<12} {'Prio':<8} {'Status':<11} {'Est/Act'}")
            print("-" * 92)
            for t in tasks:
                prio_color = Colors.RED if t.priority == "High" else (Colors.YELLOW if t.priority == "Medium" else Colors.BLUE)
                status_color = Colors.GREEN if t.status == "Completed" else (Colors.CYAN if t.status == "In Progress" else Colors.YELLOW)
                due_info = t.due_date
                if t.is_overdue:
                    due_info += f" {Colors.RED}[OVERDUE]{Colors.END}"
                print(
                    f"{t.id:<10} {t.title[:26]:<28} {t.subject[:12]:<14} {due_info:<12} "
                    f"{prio_color}{t.priority:<8}{Colors.END} {status_color}{t.status:<11}{Colors.END} "
                    f"{t.estimated_hours:.1f}h/{t.actual_hours:.1f}h"
                )

        # Eisenhower Quadrants Overview
        print("\n" + "=" * 65)
        print(f"{Colors.BOLD}⚡ Eisenhower Priority Matrix:{Colors.END}")
        matrix = self.planner.get_eisenhower_matrix()
        q1 = matrix["Q1_Do_First"]
        q2 = matrix["Q2_Schedule"]
        print(f" • {Colors.RED}Q1: Do First (Urgent & Important):{Colors.END} {len(q1)} tasks")
        for t in q1[:3]:
            print(f"     - [{t.subject}] {t.title} (Due: {t.due_date})")
        print(f" • {Colors.YELLOW}Q2: Schedule (Important):{Colors.END} {len(q2)} tasks")
        for t in q2[:3]:
            print(f"     - [{t.subject}] {t.title} (Due: {t.due_date})")

        input(f"\n{Colors.CYAN}Press Enter to return to main menu...{Colors.END}")

    def add_task_menu(self) -> None:
        clear_screen()
        print(f"{Colors.BOLD}➕ Add New Task:{Colors.END}\n")
        title = input("Task Title: ").strip()
        if not title:
            print(f"{Colors.RED}Title cannot be empty.{Colors.END}")
            return

        subjects = self.planner.get_subject_names()
        print("\nAvailable Subjects:")
        for idx, sub in enumerate(subjects, 1):
            print(f"  {idx}. {sub}")
        sub_choice = input(f"Choose Subject number [1-{len(subjects)}] or type new subject: ").strip()

        if sub_choice.isdigit() and 1 <= int(sub_choice) <= len(subjects):
            subject = subjects[int(sub_choice) - 1]
        else:
            subject = sub_choice if sub_choice else "General"

        today_str = date.today().isoformat()
        due_date = input(f"Due Date (YYYY-MM-DD) [default: {today_str}]: ").strip() or today_str
        est_str = input("Estimated Study Hours [default: 1.5]: ").strip() or "1.5"
        try:
            estimated_hours = float(est_str)
        except ValueError:
            estimated_hours = 1.5

        prio_choice = input("Priority (H=High, M=Medium, L=Low) [default: M]: ").strip().upper()
        prio_map = {"H": "High", "M": "Medium", "L": "Low"}
        priority = prio_map.get(prio_choice, "Medium")

        notes = input("Optional Notes/Chapters: ").strip()

        task = self.planner.add_task(
            title=title,
            subject=subject,
            due_date=due_date,
            estimated_hours=estimated_hours,
            priority=priority,
            notes=notes
        )
        print(f"\n{Colors.GREEN}✓ Task '{task.title}' added successfully! (ID: {task.id}){Colors.END}\n")
        time.sleep(1)

    def update_task_menu(self) -> None:
        clear_screen()
        print(f"{Colors.BOLD}✅ Update Task Status:{Colors.END}\n")
        tasks = self.planner.get_tasks()
        if not tasks:
            print("No tasks available to update.")
            return

        for idx, t in enumerate(tasks, 1):
            print(f"  {idx}. [{t.status}] {t.title} ({t.subject}) - ID: {t.id}")

        choice = input(f"\nEnter task number [1-{len(tasks)}]: ").strip()
        if not choice.isdigit() or not (1 <= int(choice) <= len(tasks)):
            print(f"{Colors.RED}Invalid selection.{Colors.END}")
            return

        task = tasks[int(choice) - 1]
        print("\nSelect New Status:")
        print("  1. In Progress")
        print("  2. Completed")
        print("  3. Pending")
        print("  4. Delete Task")

        st_choice = input("Choice [1-4]: ").strip()
        if st_choice == "1":
            self.planner.update_task_status(task.id, "In Progress")
            print(f"{Colors.GREEN}✓ Task set to In Progress.{Colors.END}")
        elif st_choice == "2":
            self.planner.update_task_status(task.id, "Completed")
            print(f"{Colors.GREEN}🎉 Congratulations on completing '{task.title}'!{Colors.END}")
        elif st_choice == "3":
            self.planner.update_task_status(task.id, "Pending")
            print(f"{Colors.GREEN}✓ Task set to Pending.{Colors.END}")
        elif st_choice == "4":
            self.planner.delete_task(task.id)
            print(f"{Colors.RED}✓ Task deleted.{Colors.END}")
        time.sleep(1)

    def start_pomodoro_menu(self) -> None:
        clear_screen()
        print(f"{Colors.BOLD}⏱️ Start Pomodoro Focus Session:{Colors.END}\n")
        subjects = self.planner.get_subject_names()
        for idx, s in enumerate(subjects, 1):
            print(f"  {idx}. {s}")
        sub_choice = input(f"Choose Subject [1-{len(subjects)}]: ").strip()
        subject = subjects[int(sub_choice) - 1] if sub_choice.isdigit() and 1 <= int(sub_choice) <= len(subjects) else "General"

        # Ask to link task
        pending_tasks = [t for t in self.planner.get_tasks() if t.status != "Completed" and t.subject == subject]
        task_id = None
        if pending_tasks:
            print(f"\nLink this focus session to a task in {subject}?")
            for idx, t in enumerate(pending_tasks, 1):
                print(f"  {idx}. {t.title}")
            print(f"  0. No specific task / general review")
            t_choice = input("Choice: ").strip()
            if t_choice.isdigit() and 1 <= int(t_choice) <= len(pending_tasks):
                task_id = pending_tasks[int(t_choice) - 1].id

        minutes_str = input("Focus Duration in minutes [default: 25]: ").strip() or "25"
        try:
            minutes = int(minutes_str)
        except ValueError:
            minutes = 25

        self.tracker.start_pomodoro(subject=subject, task_id=task_id, work_minutes=minutes)
        print(f"\n{Colors.GREEN}🚀 Pomodoro started for {minutes} minutes on {subject}!{Colors.END}")
        print("Press Ctrl+C at any time to pause/finish session early.\n")

        try:
            target_sec = minutes * 60
            while not self.tracker.is_target_reached():
                rem = int(self.tracker.get_remaining_seconds())
                mins, secs = divmod(rem, 60)
                sys.stdout.write(f"\r⏳ Focus Time Remaining: {Colors.BOLD}{Colors.YELLOW}{mins:02d}:{secs:02d}{Colors.END} | Subject: {subject} ")
                sys.stdout.flush()
                time.sleep(1)
            print(f"\n\n{Colors.GREEN}🔔 TIME'S UP! Excellent focus sprint!{Colors.END}")
        except KeyboardInterrupt:
            print(f"\n\n{Colors.YELLOW}Session paused/interrupted.{Colors.END}")

        focus_rating_str = input("\nRate your focus level (1=Distracted, 5=Deep Focus) [default: 5]: ").strip() or "5"
        try:
            focus_rating = int(focus_rating_str)
        except ValueError:
            focus_rating = 5

        notes = input("Session Notes (what did you accomplish?): ").strip()
        session = self.tracker.finish_session(focus_score=focus_rating, notes=notes)
        if session:
            print(f"{Colors.GREEN}✓ Logged {session.duration_minutes:.1f} minutes to {subject}. Keep it up!{Colors.END}\n")
        time.sleep(1.5)

    def start_stopwatch_menu(self) -> None:
        clear_screen()
        print(f"{Colors.BOLD}⏳ Start Open Stopwatch Study Session:{Colors.END}\n")
        subjects = self.planner.get_subject_names()
        for idx, s in enumerate(subjects, 1):
            print(f"  {idx}. {s}")
        sub_choice = input(f"Choose Subject [1-{len(subjects)}]: ").strip()
        subject = subjects[int(sub_choice) - 1] if sub_choice.isdigit() and 1 <= int(sub_choice) <= len(subjects) else "General"

        self.tracker.start_stopwatch(subject=subject)
        print(f"\n{Colors.GREEN}⏱️ Stopwatch running for {subject}!{Colors.END}")
        print("Press Ctrl+C when you have finished your study session.\n")

        try:
            while True:
                elapsed = int(self.tracker.get_elapsed_seconds())
                mins, secs = divmod(elapsed, 60)
                hours, mins = divmod(mins, 60)
                sys.stdout.write(f"\rStudying {subject}: {Colors.BOLD}{Colors.GREEN}{hours:02d}:{mins:02d}:{secs:02d}{Colors.END} (Press Ctrl+C to Stop) ")
                sys.stdout.flush()
                time.sleep(1)
        except KeyboardInterrupt:
            print(f"\n\n{Colors.YELLOW}Stopping session...{Colors.END}")

        focus_rating_str = input("Rate your focus level (1-5) [default: 5]: ").strip() or "5"
        try:
            focus_rating = int(focus_rating_str)
        except ValueError:
            focus_rating = 5

        notes = input("Session notes: ").strip()
        session = self.tracker.finish_session(focus_score=focus_rating, notes=notes)
        if session:
            print(f"\n{Colors.GREEN}✓ Session saved: {session.duration_hours:.2f} hours recorded for {subject}!{Colors.END}")
        time.sleep(1.5)

    def manual_log_menu(self) -> None:
        clear_screen()
        print(f"{Colors.BOLD}✍️ Log Past Study Session Manually:{Colors.END}\n")
        subjects = self.planner.get_subject_names()
        for idx, s in enumerate(subjects, 1):
            print(f"  {idx}. {s}")
        sub_choice = input(f"Select Subject [1-{len(subjects)}]: ").strip()
        subject = subjects[int(sub_choice) - 1] if sub_choice.isdigit() and 1 <= int(sub_choice) <= len(subjects) else "General"

        mins_str = input("Duration in minutes (e.g. 60 for 1 hr): ").strip()
        try:
            minutes = float(mins_str)
        except ValueError:
            print(f"{Colors.RED}Invalid duration.{Colors.END}")
            return

        date_str = input(f"Date (YYYY-MM-DD) [default: {date.today().isoformat()}]: ").strip() or date.today().isoformat()
        focus_str = input("Focus score (1-5) [default: 4]: ").strip() or "4"
        notes = input("Notes / topics covered: ").strip()

        session = self.tracker.log_manual_session(
            subject=subject,
            duration_minutes=minutes,
            session_date=date_str,
            focus_score=int(focus_str) if focus_str.isdigit() else 4,
            notes=notes
        )
        print(f"\n{Colors.GREEN}✓ Recorded {session.duration_hours:.2f} hours on {session.session_date} for {subject}!{Colors.END}\n")
        time.sleep(1)

    def view_analytics_menu(self) -> None:
        clear_screen()
        eff = self.analytics.get_efficiency_report()
        breakdown = self.analytics.get_subject_breakdown(days=7)
        tips = self.analytics.get_time_management_recommendations()

        print(f"{Colors.BOLD}📊 TIME MANAGEMENT & STUDY ANALYTICS REPORT{Colors.END}")
        print("=" * 65)
        print(
            f"• All-Time Hours: {self.analytics.get_all_time_hours():.1f}h  |  "
            f"Total Sessions: {eff['total_sessions']}  |  "
            f"Avg Focus: {eff['avg_focus']}/5.0\n"
            f"• Streak: 🔥 {eff['current_streak']} days (Best: {eff['longest_streak']} days)  |  "
            f"Efficiency Score: {eff['efficiency_score']}/100"
        )
        print("-" * 65)

        # ASCII Chart
        print(self.analytics.render_ascii_daily_chart(days=7))
        print("-" * 65)

        # Subject breakdown
        print(f"\n{Colors.BOLD}📚 Subject Weekly Targets & Progress:{Colors.END}")
        for name, data in breakdown.items():
            spent = data["hours_spent"]
            target = data["target_weekly_hours"]
            pct = data["percentage_of_target"]
            bar_len = int(pct / 10.0)
            bar = "■" * bar_len + "□" * (10 - bar_len)
            print(f"  {name:<22} [{bar}] {spent:>4.1f}h / {target:>4.1f}h ({pct:>5.1f}%) | Focus: ⭐ {data['avg_focus']}")

        print("-" * 65)
        print(f"{Colors.BOLD}💡 Time Management & Efficiency Recommendations:{Colors.END}")
        for tip in tips:
            print(f"  {tip}")

        input(f"\n{Colors.CYAN}Press Enter to return to main menu...{Colors.END}")

    def set_daily_goal_menu(self) -> None:
        clear_screen()
        today_iso = date.today().isoformat()
        current_goal = self.planner.get_daily_goal(today_iso)
        print(f"{Colors.BOLD}🎯 Set Daily Study Goal:{Colors.END}")
        print(f"Current target for today: {current_goal} hours\n")

        target_str = input("New daily target hours (e.g. 4.0): ").strip()
        try:
            target = float(target_str)
            self.planner.set_daily_goal(target_hours=target, target_date=today_iso)
            print(f"{Colors.GREEN}✓ Daily goal updated to {target} hours!{Colors.END}\n")
        except ValueError:
            print(f"{Colors.RED}Invalid number.{Colors.END}\n")
        time.sleep(1)

    def manage_subjects_menu(self) -> None:
        clear_screen()
        print(f"{Colors.BOLD}📚 Manage Subjects:{Colors.END}\n")
        subjects = self.planner.get_all_subjects()
        for idx, sub in enumerate(subjects, 1):
            print(f"  {idx}. {sub.name:<24} Target: {sub.target_weekly_hours} hrs/week")

        print("\nOptions: [A] Add Subject  [E] Edit Target Hours  [R] Remove Subject  [B] Back")
        action = input("Select: ").strip().upper()

        if action == "A":
            name = input("Subject Name: ").strip()
            target_str = input("Weekly Target Hours (e.g. 6.0): ").strip() or "5.0"
            if name:
                self.planner.add_subject(name, float(target_str) if target_str.replace('.', '', 1).isdigit() else 5.0)
                print(f"{Colors.GREEN}✓ Added {name}!{Colors.END}")
        elif action == "E":
            sub_idx = input(f"Choose Subject [1-{len(subjects)}]: ").strip()
            if sub_idx.isdigit() and 1 <= int(sub_idx) <= len(subjects):
                sub = subjects[int(sub_idx) - 1]
                new_tgt = input(f"New weekly target hours for {sub.name}: ").strip()
                if new_tgt.replace('.', '', 1).isdigit():
                    sub.target_weekly_hours = float(new_tgt)
                    self.planner.save()
                    print(f"{Colors.GREEN}✓ Updated {sub.name} target.{Colors.END}")
        elif action == "R":
            sub_idx = input(f"Choose Subject to remove [1-{len(subjects)}]: ").strip()
            if sub_idx.isdigit() and 1 <= int(sub_idx) <= len(subjects):
                sub = subjects[int(sub_idx) - 1]
                self.planner.remove_subject(sub.id)
                print(f"{Colors.GREEN}✓ Removed {sub.name}.{Colors.END}")
        time.sleep(1)
