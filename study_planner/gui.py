"""Modern Graphical User Interface (GUI) for Study Planner & Time Management."""

from __future__ import annotations
import tkinter as tk
from tkinter import ttk, messagebox
from datetime import datetime, date, timedelta
from typing import Optional
from .planner import StudyPlanner
from .time_tracker import TimeTracker
from .analytics import StudyAnalytics


class StudyPlannerGUI:
    """Tkinter-based GUI for Study Planner & Time Management System."""

    def __init__(self, root: tk.Tk, planner: StudyPlanner, tracker: TimeTracker, analytics: StudyAnalytics) -> None:
        self.root = root
        self.planner = planner
        self.tracker = tracker
        self.analytics = analytics

        self.root.title("🎓 Smart Study Planner & Time Management System")
        self.root.geometry("1024x720")
        self.root.minsize(880, 600)

        # Apply modern style
        self.style = ttk.Style()
        self.style.theme_use("clam")
        self.setup_styles()

        # Timer state
        self.timer_running = False
        self.timer_seconds_left = 25 * 60
        self.timer_mode = "pomodoro"  # "pomodoro" or "stopwatch"
        self.stopwatch_seconds = 0

        self.build_ui()
        self.refresh_all()

    def setup_styles(self) -> None:
        """Configures ttk styles for clean visual appearance."""
        self.style.configure(".", font=("Segoe UI", 10))
        self.style.configure("TNotebook.Tab", font=("Segoe UI", 11, "bold"), padding=[15, 6])
        self.style.configure("Header.TLabel", font=("Segoe UI", 16, "bold"), foreground="#1a365d")
        self.style.configure("SubHeader.TLabel", font=("Segoe UI", 12, "bold"), foreground="#2d3748")
        self.style.configure("CardTitle.TLabel", font=("Segoe UI", 10), foreground="#718096")
        self.style.configure("CardValue.TLabel", font=("Segoe UI", 20, "bold"), foreground="#2b6cb0")
        self.style.configure("Success.TLabel", font=("Segoe UI", 11, "bold"), foreground="#2f855a")
        self.style.configure("Warning.TLabel", font=("Segoe UI", 11, "bold"), foreground="#c53030")

    def build_ui(self) -> None:
        """Constructs the tabbed interface."""
        # Top banner
        header_frame = tk.Frame(self.root, bg="#2b6cb0", height=60)
        header_frame.pack(fill="x", side="top")

        lbl_title = tk.Label(
            header_frame,
            text="🎓 SMART STUDY PLANNER & TIME TRACKER",
            bg="#2b6cb0",
            fg="white",
            font=("Segoe UI", 15, "bold")
        )
        lbl_title.pack(side="left", padx=20, pady=12)

        self.lbl_streak_banner = tk.Label(
            header_frame,
            text="🔥 Streak: 0 days | Efficiency: 100/100",
            bg="#2b6cb0",
            fg="#e2e8f0",
            font=("Segoe UI", 11, "bold")
        )
        self.lbl_streak_banner.pack(side="right", padx=20, pady=12)

        # Notebook tabs
        self.notebook = ttk.Notebook(self.root)
        self.notebook.pack(fill="both", expand=True, padx=12, pady=12)

        # Tab 1: Dashboard
        self.tab_dashboard = ttk.Frame(self.notebook)
        self.notebook.add(self.tab_dashboard, text=" 📊 Dashboard ")
        self.build_dashboard_tab()

        # Tab 2: Tasks & Deadlines
        self.tab_tasks = ttk.Frame(self.notebook)
        self.notebook.add(self.tab_tasks, text=" 📋 Tasks & Priorities ")
        self.build_tasks_tab()

        # Tab 3: Pomodoro & Study Timer
        self.tab_timer = ttk.Frame(self.notebook)
        self.notebook.add(self.tab_timer, text=" ⏱️ Study Timer & Pomodoro ")
        self.build_timer_tab()

        # Tab 4: Analytics & Insights
        self.tab_analytics = ttk.Frame(self.notebook)
        self.notebook.add(self.tab_analytics, text=" 📈 Time Analytics ")
        self.build_analytics_tab()

    # ---------------- Dashboard Tab ----------------
    def build_dashboard_tab(self) -> None:
        # KPI Metric Cards container
        cards_frame = ttk.Frame(self.tab_dashboard)
        cards_frame.pack(fill="x", padx=15, pady=15)

        for i in range(4):
            cards_frame.columnconfigure(i, weight=1)

        # Card 1: Today's Hours
        self.c1 = ttk.LabelFrame(cards_frame, text="Today's Study", padding=10)
        self.c1.grid(row=0, column=0, sticky="nsew", padx=6)
        self.lbl_today_val = ttk.Label(self.c1, text="0.0h / 3.0h", style="CardValue.TLabel")
        self.lbl_today_val.pack()
        self.lbl_today_sub = ttk.Label(self.c1, text="0% of daily goal", style="CardTitle.TLabel")
        self.lbl_today_sub.pack()

        # Card 2: Week Hours
        self.c2 = ttk.LabelFrame(cards_frame, text="Weekly Progress", padding=10)
        self.c2.grid(row=0, column=1, sticky="nsew", padx=6)
        self.lbl_week_val = ttk.Label(self.c2, text="0.0h / 22.0h", style="CardValue.TLabel")
        self.lbl_week_val.pack()
        self.lbl_week_sub = ttk.Label(self.c2, text="0% of weekly goal", style="CardTitle.TLabel")
        self.lbl_week_sub.pack()

        # Card 3: Efficiency Index
        self.c3 = ttk.LabelFrame(cards_frame, text="Efficiency Score", padding=10)
        self.c3.grid(row=0, column=2, sticky="nsew", padx=6)
        self.lbl_eff_val = ttk.Label(self.c3, text="85 / 100", style="CardValue.TLabel")
        self.lbl_eff_val.pack()
        self.lbl_eff_sub = ttk.Label(self.c3, text="Focus & Goal blend", style="CardTitle.TLabel")
        self.lbl_eff_sub.pack()

        # Card 4: Study Streak
        self.c4 = ttk.LabelFrame(cards_frame, text="Active Streak", padding=10)
        self.c4.grid(row=0, column=3, sticky="nsew", padx=6)
        self.lbl_streak_val = ttk.Label(self.c4, text="🔥 0 Days", style="CardValue.TLabel")
        self.lbl_streak_val.pack()
        self.lbl_streak_sub = ttk.Label(self.c4, text="Best: 0 Days", style="CardTitle.TLabel")
        self.lbl_streak_sub.pack()

        # Lower Split: Recommendations (Left) & Upcoming Tasks (Right)
        split_frame = ttk.Frame(self.tab_dashboard)
        split_frame.pack(fill="both", expand=True, padx=15, pady=5)
        split_frame.columnconfigure(0, weight=1)
        split_frame.columnconfigure(1, weight=1)

        # Smart Coaching
        coach_frame = ttk.LabelFrame(split_frame, text="💡 Smart Time-Management Coaching", padding=12)
        coach_frame.grid(row=0, column=0, sticky="nsew", padx=(0, 8), pady=5)
        self.txt_tips = tk.Text(coach_frame, wrap="word", height=14, font=("Segoe UI", 10), bg="#f8fafc", relief="flat")
        self.txt_tips.pack(fill="both", expand=True)

        # Upcoming tasks list
        tasks_dash_frame = ttk.LabelFrame(split_frame, text="⚡ Priority Tasks Due Soon", padding=12)
        tasks_dash_frame.grid(row=0, column=1, sticky="nsew", padx=(8, 0), pady=5)

        self.tree_dash_tasks = ttk.Treeview(
            tasks_dash_frame,
            columns=("Subject", "Title", "Due", "Priority"),
            show="headings",
            height=8
        )
        self.tree_dash_tasks.heading("Subject", text="Subject")
        self.tree_dash_tasks.heading("Title", text="Task Title")
        self.tree_dash_tasks.heading("Due", text="Due Date")
        self.tree_dash_tasks.heading("Priority", text="Priority")
        self.tree_dash_tasks.column("Subject", width=100)
        self.tree_dash_tasks.column("Title", width=180)
        self.tree_dash_tasks.column("Due", width=90)
        self.tree_dash_tasks.column("Priority", width=75)
        self.tree_dash_tasks.pack(fill="both", expand=True)

    # ---------------- Tasks Tab ----------------
    def build_tasks_tab(self) -> None:
        # Controls Frame (Add / Status / Filter)
        ctrl_frame = ttk.Frame(self.tab_tasks)
        ctrl_frame.pack(fill="x", padx=15, pady=10)

        btn_add = ttk.Button(ctrl_frame, text="➕ Add New Task", command=self.open_add_task_dialog)
        btn_add.pack(side="left", padx=5)

        btn_complete = ttk.Button(ctrl_frame, text="✅ Mark Completed", command=self.mark_selected_task_complete)
        btn_complete.pack(side="left", padx=5)

        btn_progress = ttk.Button(ctrl_frame, text="▶️ Set In Progress", command=lambda: self.set_selected_task_status("In Progress"))
        btn_progress.pack(side="left", padx=5)

        btn_delete = ttk.Button(ctrl_frame, text="🗑️ Delete Task", command=self.delete_selected_task)
        btn_delete.pack(side="left", padx=5)

        # Filter
        ttk.Label(ctrl_frame, text="Filter:").pack(side="left", padx=(20, 5))
        self.combo_filter = ttk.Combobox(ctrl_frame, values=["All Tasks", "Pending", "In Progress", "Completed"], state="readonly", width=14)
        self.combo_filter.set("All Tasks")
        self.combo_filter.bind("<<ComboboxSelected>>", lambda e: self.refresh_tasks_table())
        self.combo_filter.pack(side="left", padx=5)

        # Tasks Table
        table_frame = ttk.Frame(self.tab_tasks)
        table_frame.pack(fill="both", expand=True, padx=15, pady=5)

        cols = ("ID", "Title", "Subject", "Due Date", "Priority", "Status", "Est. Hours", "Act. Hours")
        self.tree_tasks = ttk.Treeview(table_frame, columns=cols, show="headings", selectmode="browse")

        for col in cols:
            self.tree_tasks.heading(col, text=col)

        self.tree_tasks.column("ID", width=65, anchor="center")
        self.tree_tasks.column("Title", width=220)
        self.tree_tasks.column("Subject", width=120)
        self.tree_tasks.column("Due Date", width=100, anchor="center")
        self.tree_tasks.column("Priority", width=80, anchor="center")
        self.tree_tasks.column("Status", width=95, anchor="center")
        self.tree_tasks.column("Est. Hours", width=80, anchor="center")
        self.tree_tasks.column("Act. Hours", width=80, anchor="center")

        scroll = ttk.Scrollbar(table_frame, orient="vertical", command=self.tree_tasks.yview)
        self.tree_tasks.configure(yscrollcommand=scroll.set)
        self.tree_tasks.pack(side="left", fill="both", expand=True)
        scroll.pack(side="right", fill="y")

    # ---------------- Timer Tab ----------------
    def build_timer_tab(self) -> None:
        timer_container = ttk.Frame(self.tab_timer, padding=20)
        timer_container.pack(fill="both", expand=True)

        # Subject selection
        sub_frame = ttk.Frame(timer_container)
        sub_frame.pack(pady=10)
        ttk.Label(sub_frame, text="Select Subject:", font=("Segoe UI", 11, "bold")).pack(side="left", padx=8)
        self.combo_timer_subject = ttk.Combobox(sub_frame, values=self.planner.get_subject_names(), state="readonly", width=22)
        if self.planner.get_subject_names():
            self.combo_timer_subject.set(self.planner.get_subject_names()[0])
        self.combo_timer_subject.pack(side="left", padx=8)

        # Preset interval buttons
        preset_frame = ttk.Frame(timer_container)
        preset_frame.pack(pady=10)
        ttk.Button(preset_frame, text="25m Pomodoro", command=lambda: self.set_timer_preset(25, "pomodoro")).pack(side="left", padx=6)
        ttk.Button(preset_frame, text="50m Deep Work", command=lambda: self.set_timer_preset(50, "pomodoro")).pack(side="left", padx=6)
        ttk.Button(preset_frame, text="5m Short Break", command=lambda: self.set_timer_preset(5, "break")).pack(side="left", padx=6)
        ttk.Button(preset_frame, text="Open Stopwatch", command=lambda: self.set_timer_preset(0, "stopwatch")).pack(side="left", padx=6)

        # Big Digital Clock Display
        self.lbl_clock = tk.Label(
            timer_container,
            text="25:00",
            font=("Segoe UI", 68, "bold"),
            fg="#2b6cb0",
            bg="#f0f4f8",
            padx=40,
            pady=15,
            relief="solid",
            bd=1
        )
        self.lbl_clock.pack(pady=20)

        self.lbl_timer_status = ttk.Label(timer_container, text="Ready to focus. Eliminate distractions!", font=("Segoe UI", 11, "italic"))
        self.lbl_timer_status.pack(pady=5)

        # Action Buttons
        btn_action_frame = ttk.Frame(timer_container)
        btn_action_frame.pack(pady=15)

        self.btn_start = tk.Button(
            btn_action_frame,
            text="▶ Start Focus",
            command=self.toggle_timer,
            bg="#319795",
            fg="white",
            font=("Segoe UI", 12, "bold"),
            padx=20,
            pady=8,
            relief="flat"
        )
        self.btn_start.pack(side="left", padx=10)

        self.btn_finish = tk.Button(
            btn_action_frame,
            text="💾 Save Session",
            command=self.finish_and_save_session,
            bg="#2b6cb0",
            fg="white",
            font=("Segoe UI", 12, "bold"),
            padx=20,
            pady=8,
            relief="flat"
        )
        self.btn_finish.pack(side="left", padx=10)

        self.btn_reset = tk.Button(
            btn_action_frame,
            text="🔄 Reset",
            command=self.reset_timer,
            bg="#a0aec0",
            fg="white",
            font=("Segoe UI", 12, "bold"),
            padx=15,
            pady=8,
            relief="flat"
        )
        self.btn_reset.pack(side="left", padx=10)

        # Focus rating slider
        focus_frame = ttk.Frame(timer_container)
        focus_frame.pack(pady=10)
        ttk.Label(focus_frame, text="Session Focus Rating (1=Distracted, 5=Laser Focus):", font=("Segoe UI", 10)).pack(side="left", padx=8)
        self.slider_focus = tk.Scale(focus_frame, from_=1, to=5, orient="horizontal", length=180)
        self.slider_focus.set(5)
        self.slider_focus.pack(side="left", padx=8)

    # ---------------- Analytics Tab ----------------
    def build_analytics_tab(self) -> None:
        container = ttk.Frame(self.tab_analytics, padding=15)
        container.pack(fill="both", expand=True)

        # Top section: Canvas chart for 7-day study history
        chart_frame = ttk.LabelFrame(container, text="📊 Study Hours (Last 7 Days)", padding=10)
        chart_frame.pack(fill="x", pady=5)

        self.canvas_chart = tk.Canvas(chart_frame, height=180, bg="#ffffff", highlightthickness=0)
        self.canvas_chart.pack(fill="x", expand=True)

        # Bottom section: Subject progress bars & manual log button
        bottom_frame = ttk.Frame(container)
        bottom_frame.pack(fill="both", expand=True, pady=10)
        bottom_frame.columnconfigure(0, weight=3)
        bottom_frame.columnconfigure(1, weight=2)

        # Subject breakdown
        sub_progress_frame = ttk.LabelFrame(bottom_frame, text="📚 Subject Weekly Targets vs Actuals", padding=10)
        sub_progress_frame.grid(row=0, column=0, sticky="nsew", padx=(0, 8))

        self.txt_subject_breakdown = tk.Text(sub_progress_frame, wrap="word", height=10, font=("Consolas", 10), bg="#f8fafc", relief="flat")
        self.txt_subject_breakdown.pack(fill="both", expand=True)

        # Manual Log Box
        manual_frame = ttk.LabelFrame(bottom_frame, text="✍️ Quick Manual Time Log", padding=10)
        manual_frame.grid(row=0, column=1, sticky="nsew", padx=(8, 0))

        ttk.Label(manual_frame, text="Subject:").pack(anchor="w", pady=(2, 0))
        self.combo_manual_sub = ttk.Combobox(manual_frame, values=self.planner.get_subject_names(), state="readonly")
        if self.planner.get_subject_names():
            self.combo_manual_sub.set(self.planner.get_subject_names()[0])
        self.combo_manual_sub.pack(fill="x", pady=4)

        ttk.Label(manual_frame, text="Minutes Studied:").pack(anchor="w", pady=(4, 0))
        self.entry_manual_mins = ttk.Entry(manual_frame)
        self.entry_manual_mins.insert(0, "60")
        self.entry_manual_mins.pack(fill="x", pady=4)

        ttk.Label(manual_frame, text="Notes:").pack(anchor="w", pady=(4, 0))
        self.entry_manual_notes = ttk.Entry(manual_frame)
        self.entry_manual_notes.pack(fill="x", pady=4)

        btn_log_manual = ttk.Button(manual_frame, text="Log Study Time", command=self.submit_manual_log)
        btn_log_manual.pack(pady=10)

    # ---------------- Timer Logic ----------------
    def set_timer_preset(self, minutes: int, mode: str) -> None:
        if self.timer_running:
            if not messagebox.askyesno("Timer Active", "A study session is currently running. Switch preset and reset?"):
                return
            self.timer_running = False
            self.btn_start.config(text="▶ Start Focus", bg="#319795")

        self.timer_mode = mode
        if mode == "stopwatch":
            self.stopwatch_seconds = 0
            self.lbl_clock.config(text="00:00:00")
            self.lbl_timer_status.config(text="Stopwatch mode: tracks open-ended deep work.")
        elif mode == "break":
            self.timer_seconds_left = minutes * 60
            self.lbl_clock.config(text=f"{minutes:02d}:00")
            self.lbl_timer_status.config(text="Break time! Relax, stretch, and hydrate.")
        else:
            self.timer_seconds_left = minutes * 60
            self.lbl_clock.config(text=f"{minutes:02d}:00")
            self.lbl_timer_status.config(text=f"{minutes}-minute Pomodoro sprint. Stay focused!")

    def toggle_timer(self) -> None:
        sub = self.combo_timer_subject.get() or "General"
        if not self.timer_running:
            self.timer_running = True
            self.btn_start.config(text="⏸ Pause", bg="#dd6b20")
            if self.timer_mode == "pomodoro":
                self.tracker.start_pomodoro(subject=sub, work_minutes=int(self.timer_seconds_left / 60))
            elif self.timer_mode == "stopwatch":
                self.tracker.start_stopwatch(subject=sub)
            self.lbl_timer_status.config(text=f"Focusing on {sub}... Stay in the zone!")
            self.run_timer_tick()
        else:
            self.timer_running = False
            self.btn_start.config(text="▶ Resume", bg="#319795")
            self.tracker.pause()
            self.lbl_timer_status.config(text="Timer paused.")

    def run_timer_tick(self) -> None:
        if not self.timer_running:
            return

        if self.timer_mode in ("pomodoro", "break"):
            if self.timer_seconds_left > 0:
                self.timer_seconds_left -= 1
                mins, secs = divmod(self.timer_seconds_left, 60)
                self.lbl_clock.config(text=f"{mins:02d}:{secs:02d}")
                self.root.after(1000, self.run_timer_tick)
            else:
                self.timer_running = False
                self.btn_start.config(text="▶ Start Focus", bg="#319795")
                self.lbl_clock.config(text="00:00")
                messagebox.showinfo("Session Finished", "🔔 Time is up! Outstanding focus sprint!")
                self.finish_and_save_session()
        else:  # Stopwatch
            self.stopwatch_seconds += 1
            hrs, rem = divmod(self.stopwatch_seconds, 3600)
            mins, secs = divmod(rem, 60)
            self.lbl_clock.config(text=f"{hrs:02d}:{mins:02d}:{secs:02d}")
            self.root.after(1000, self.run_timer_tick)

    def finish_and_save_session(self) -> None:
        if self.tracker.is_active:
            focus_val = int(self.slider_focus.get())
            session = self.tracker.finish_session(focus_score=focus_val, notes="Session completed via GUI timer")
            self.timer_running = False
            self.btn_start.config(text="▶ Start Focus", bg="#319795")
            if session:
                messagebox.showinfo("Session Saved", f"✓ Logged {session.duration_minutes:.1f} minutes for {session.subject}!")
            self.refresh_all()
        else:
            messagebox.showinfo("No Active Session", "No running session to save. Start a timer first!")

    def reset_timer(self) -> None:
        self.timer_running = False
        self.btn_start.config(text="▶ Start Focus", bg="#319795")
        self.tracker.cancel_session()
        self.set_timer_preset(25, "pomodoro")

    # ---------------- Manual Log & Task Handlers ----------------
    def submit_manual_log(self) -> None:
        sub = self.combo_manual_sub.get() or "General"
        try:
            mins = float(self.entry_manual_mins.get())
        except ValueError:
            messagebox.showerror("Error", "Please enter a valid number of minutes.")
            return

        notes = self.entry_manual_notes.get()
        self.tracker.log_manual_session(subject=sub, duration_minutes=mins, notes=notes)
        messagebox.showinfo("Success", f"Logged {mins / 60.0:.2f} hours for {sub}!")
        self.entry_manual_notes.delete(0, tk.END)
        self.refresh_all()

    def open_add_task_dialog(self) -> None:
        dlg = tk.Toplevel(self.root)
        dlg.title("Add New Task")
        dlg.geometry("420x400")
        dlg.transient(self.root)
        dlg.grab_set()

        ttk.Label(dlg, text="Task Title:", font=("Segoe UI", 10, "bold")).pack(anchor="w", padx=20, pady=(15, 2))
        ent_title = ttk.Entry(dlg, width=40)
        ent_title.pack(padx=20, fill="x")

        ttk.Label(dlg, text="Subject:", font=("Segoe UI", 10, "bold")).pack(anchor="w", padx=20, pady=(10, 2))
        cmb_sub = ttk.Combobox(dlg, values=self.planner.get_subject_names(), state="readonly")
        if self.planner.get_subject_names():
            cmb_sub.set(self.planner.get_subject_names()[0])
        cmb_sub.pack(padx=20, fill="x")

        ttk.Label(dlg, text="Due Date (YYYY-MM-DD):", font=("Segoe UI", 10, "bold")).pack(anchor="w", padx=20, pady=(10, 2))
        ent_due = ttk.Entry(dlg)
        ent_due.insert(0, (date.today() + timedelta(days=2)).isoformat())
        ent_due.pack(padx=20, fill="x")

        ttk.Label(dlg, text="Estimated Hours:", font=("Segoe UI", 10, "bold")).pack(anchor="w", padx=20, pady=(10, 2))
        ent_est = ttk.Entry(dlg)
        ent_est.insert(0, "2.0")
        ent_est.pack(padx=20, fill="x")

        ttk.Label(dlg, text="Priority:", font=("Segoe UI", 10, "bold")).pack(anchor="w", padx=20, pady=(10, 2))
        cmb_prio = ttk.Combobox(dlg, values=["High", "Medium", "Low"], state="readonly")
        cmb_prio.set("Medium")
        cmb_prio.pack(padx=20, fill="x")

        def save_task():
            title = ent_title.get().strip()
            if not title:
                messagebox.showerror("Error", "Title cannot be empty.", parent=dlg)
                return
            sub = cmb_sub.get() or "General"
            due = ent_due.get().strip()
            try:
                est = float(ent_est.get())
            except ValueError:
                est = 1.5
            prio = cmb_prio.get()
            self.planner.add_task(title=title, subject=sub, due_date=due, estimated_hours=est, priority=prio)
            dlg.destroy()
            self.refresh_all()

        btn_save = ttk.Button(dlg, text="Save Task", command=save_task)
        btn_save.pack(pady=20)

    def mark_selected_task_complete(self) -> None:
        sel = self.tree_tasks.selection()
        if not sel:
            messagebox.showinfo("Select Task", "Please select a task from the list.")
            return
        task_id = self.tree_tasks.item(sel[0])["values"][0]
        self.planner.update_task_status(str(task_id), "Completed")
        self.refresh_all()

    def set_selected_task_status(self, status: str) -> None:
        sel = self.tree_tasks.selection()
        if not sel:
            messagebox.showinfo("Select Task", "Please select a task from the list.")
            return
        task_id = self.tree_tasks.item(sel[0])["values"][0]
        self.planner.update_task_status(str(task_id), status)
        self.refresh_all()

    def delete_selected_task(self) -> None:
        sel = self.tree_tasks.selection()
        if not sel:
            messagebox.showinfo("Select Task", "Please select a task from the list.")
            return
        task_id = self.tree_tasks.item(sel[0])["values"][0]
        if messagebox.askyesno("Confirm Delete", "Are you sure you want to delete this task?"):
            self.planner.delete_task(str(task_id))
            self.refresh_all()

    # ---------------- Refresh & Redraw ----------------
    def refresh_all(self) -> None:
        self.refresh_dashboard()
        self.refresh_tasks_table()
        self.refresh_analytics_tab()
        # Update comboboxes
        sub_names = self.planner.get_subject_names()
        self.combo_timer_subject["values"] = sub_names
        self.combo_manual_sub["values"] = sub_names

    def refresh_dashboard(self) -> None:
        eff = self.analytics.get_efficiency_report()
        self.lbl_streak_banner.config(text=f"🔥 Streak: {eff['current_streak']} days | Efficiency: {eff['efficiency_score']}/100")
        self.lbl_today_val.config(text=f"{eff['today_hours']:.1f}h / {eff['today_goal']:.1f}h")
        self.lbl_today_sub.config(text=f"{eff['today_goal_pct']}% of daily target")

        self.lbl_week_val.config(text=f"{eff['week_hours']:.1f}h / {eff['weekly_target_hours']:.1f}h")
        self.lbl_week_sub.config(text=f"{eff['weekly_target_pct']}% of weekly target")

        self.lbl_eff_val.config(text=f"{eff['efficiency_score']} / 100")
        self.lbl_eff_sub.config(text=f"Avg Focus: {eff['avg_focus']}/5.0")

        self.lbl_streak_val.config(text=f"🔥 {eff['current_streak']} Days")
        self.lbl_streak_sub.config(text=f"Best Streak: {eff['longest_streak']} Days")

        # Tips
        tips = self.analytics.get_time_management_recommendations()
        self.txt_tips.delete("1.0", tk.END)
        for t in tips:
            self.txt_tips.insert(tk.END, f"{t}\n\n")

        # Upcoming tasks
        for item in self.tree_dash_tasks.get_children():
            self.tree_dash_tasks.delete(item)
        upcoming = self.planner.get_upcoming_tasks(days_ahead=7)
        for t in upcoming:
            self.tree_dash_tasks.insert("", tk.END, values=(t.subject, t.title, t.due_date, t.priority))

    def refresh_tasks_table(self) -> None:
        filt = self.combo_filter.get()
        status_filter = None if filt == "All Tasks" else filt
        tasks = self.planner.get_tasks(status=status_filter)

        for item in self.tree_tasks.get_children():
            self.tree_tasks.delete(item)

        for t in tasks:
            self.tree_tasks.insert(
                "",
                tk.END,
                values=(
                    t.id,
                    t.title,
                    t.subject,
                    t.due_date,
                    t.priority,
                    t.status,
                    f"{t.estimated_hours:.1f}h",
                    f"{t.actual_hours:.1f}h"
                )
            )

    def refresh_analytics_tab(self) -> None:
        # Draw Canvas Chart for last 7 days
        self.canvas_chart.delete("all")
        width = self.canvas_chart.winfo_width() or 700
        height = 180
        padding = 40

        today = date.today()
        days_data = []
        max_h = 1.0
        for i in range(6, -1, -1):
            d = today - timedelta(days=i)
            h = self.analytics.get_hours_today(d.isoformat())
            days_data.append((d.strftime("%a"), h))
            if h > max_h:
                max_h = h

        bar_width = (width - padding * 2) / 7 - 15
        for idx, (day_name, hours) in enumerate(days_data):
            x0 = padding + idx * ((width - padding * 2) / 7) + 5
            x1 = x0 + bar_width
            bar_h = (hours / max_h) * (height - 60)
            y1 = height - 30
            y0 = y1 - bar_h

            color = "#3182ce" if hours > 0 else "#e2e8f0"
            self.canvas_chart.create_rectangle(x0, y0, x1, y1, fill=color, outline="")
            self.canvas_chart.create_text((x0 + x1) / 2, y1 + 15, text=day_name, font=("Segoe UI", 9))
            if hours > 0:
                self.canvas_chart.create_text((x0 + x1) / 2, y0 - 10, text=f"{hours:.1f}h", font=("Segoe UI", 9, "bold"))

        # Subject breakdown text
        breakdown = self.analytics.get_subject_breakdown(days=7)
        self.txt_subject_breakdown.delete("1.0", tk.END)
        self.txt_subject_breakdown.insert(tk.END, f"{'Subject':<22} {'Progress':<14} {'Spent / Target':<16} {'Focus'}\n")
        self.txt_subject_breakdown.insert(tk.END, "-" * 62 + "\n")
        for name, data in breakdown.items():
            spent = data["hours_spent"]
            tgt = data["target_weekly_hours"]
            pct = data["percentage_of_target"]
            bar_len = int(pct / 10.0)
            bar = "■" * bar_len + "□" * (10 - bar_len)
            self.txt_subject_breakdown.insert(
                tk.END,
                f"{name:<22} [{bar}] {spent:>4.1f}h / {tgt:>4.1f}h  {pct:>5.1f}%  ⭐ {data['avg_focus']}\n"
            )


def launch_gui(planner: StudyPlanner, tracker: TimeTracker, analytics: StudyAnalytics) -> None:
    """Launches the Tkinter GUI mainloop."""
    root = tk.Tk()
    app = StudyPlannerGUI(root, planner, tracker, analytics)
    root.mainloop()
