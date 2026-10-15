# 🎓 StudyFlow - Smart Study Planner & Time Management System

[![Python Version](https://img.shields.io/badge/Python-3.8%2B-blue.svg)](https://www.python.org/)
[![Technologies](https://img.shields.io/badge/Stack-HTML5%20%7C%20CSS3%20%7C%20JS%20%7C%20Python-orange.svg)](#architecture)
[![Dependencies](https://img.shields.io/badge/Dependencies-0%20(Pure%20Standard%20Library)-success.svg)](#installation)
[![Footprint](https://img.shields.io/badge/Size-%3C%20200%20KB%20(Target%20%3C%203%20GB)-brightgreen.svg)](#footprint--performance)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

An elegant, distraction-free **Study Planner and Time Management System** crafted specifically for students to organize academic tasks, track study hours with high precision, and optimize study efficiency.

Built with **clean HTML, CSS, JavaScript, and Python** — designed to be lightweight, zero-dependency, and immediately deployable to your GitHub portfolio.

---

## 🌟 Key Features

### ⏱️ 1. Intelligent Time Management
- **Integrated Pomodoro Timer:** 25-minute focus sprints, 50-minute deep work blocks, and 5-minute/15-minute scheduled breaks.
- **Open Stopwatch Mode:** Flexible tracking for open-ended problem solving and research sessions.
- **Direct Task Attribution:** Time spent during sessions automatically increments the actual hours logged against specific academic tasks.
- **Web Audio Chimes:** Built-in synthesizer chimes (using the Web Audio API) alert you when focus sessions conclude—no external audio files needed.
- **Session Focus Rating:** Rate mental focus (1 to 5 stars) after each session to track distraction patterns over time.
- **Offline / Manual Time Logger:** Log offline study hours (e.g. library books, group study) in seconds.

### 📋 2. Academic Task & Deadline Planner
- **Full Task Lifecycle:** Create, edit, prioritize, and check off academic assignments, readings, and lab work.
- **Eisenhower Priority Matrix:** Automatic 4-quadrant sorting (`Q1: Do First`, `Q2: Schedule`, `Q3: Quick Wins`, `Q4: Low Priority`) based on urgency and priority.
- **Subject-Specific Organization:** Group tasks by subject (Mathematics, Computer Science, Physics, Literature, etc.).
- **Live Search & Status Filtering:** Filter by status (Pending, In Progress, Completed), priority (High, Medium, Low), or keyword.
- **Overdue Detection:** Visual alerts for tasks approaching or past their deadlines.

### 📈 3. Efficiency Analytics & Insights
- **7-Day Visual Study Chart:** Interactive daily hours breakdown tracking study velocity throughout the week.
- **Subject Target vs. Actual Hours:** Real-time visual progress bars comparing actual time spent against weekly target goals.
- **Time Efficiency Index (0–100):** Algorithmic composite score calculating goal achievement, study consistency, and average focus quality.
- **Study Streak Counter:** Tracks consecutive days of focused study to build long-term momentum.
- **Smart Time Coach:** Proactive tips alerting you to neglected subjects, upcoming deadlines, and fatigue/break reminders.

### 💾 4. Portable Dual-Mode Persistence
- **Zero-Dependency Python Backend:** Standard library `http.server` handles local persistence in `study_data.json` with atomic writes.
- **Browser LocalStorage Fallback:** Works completely offline even if opened directly in a browser without launching the server.
- **Export & Import JSON:** One-click backup and restore for your study logs and task lists.

---

## 🪶 Footprint & Performance

- **Ultra-lightweight:** Entire project footprint is **under 200 KB** (less than 0.007% of a 3 GB limit).
- **No heavy frameworks:** Zero `node_modules`, zero virtual environment bloat, zero pip installs.
- **Instant startup:** Launches in less than 0.2 seconds.

---

## 🚀 Quick Start Guide

### Prerequisites
- Python 3.8 or higher (No `pip install` required!)
- Any modern web browser (Chrome, Edge, Firefox, Safari)

### Run the Application

Clone the repository and run:

```bash
# Clone the repository
git clone https://github.com/your-username/study-planner.git
cd study-planner

# Launch the app (auto-opens in your browser)
python main.py
```

*Alternatively, you can also launch with:*
```bash
python "Study  planner.py"
```

### Optional Modes

```bash
# Interactive Terminal (CLI) Mode:
python main.py --cli

# Desktop GUI (Tkinter) Mode:
python main.py --gui

# Run Unit Tests:
python -m unittest discover tests
```

---

## 📂 Project Structure

```
Study Planner/
├── index.html              # Modern, responsive semantic HTML5 frontend
├── styles.css              # Custom CSS3 stylesheet (Dark/Light themes, responsive grid)
├── app.js                  # Vanilla JavaScript (Timer, tasks, analytics, Web Audio)
├── server.py               # Zero-dependency Python server with local JSON API
├── main.py                 # Standard entry point script
├── Study  planner.py       # Direct runner script
├── study_data.json         # Local data store (created automatically)
├── study_planner/          # Modular Python package
│   ├── __init__.py
│   ├── models.py           # Subject, Task, StudySession data models
│   ├── storage.py          # Atomic JSON persistence manager
│   ├── planner.py          # Core academic planning engine & Eisenhower matrix
│   ├── time_tracker.py     # Time tracking & session attribution logic
│   ├── analytics.py        # Efficiency scoring, streak tracking & recommendations
│   ├── cli.py              # Interactive Terminal CLI dashboard
│   └── gui.py              # Desktop Tkinter GUI interface
├── tests/
│   ├── __init__.py
│   └── test_planner.py     # Unit test suite
├── requirements.txt        # Documentation of 0 external dependencies
├── .gitignore              # Standard Python gitignore
├── LICENSE                 # MIT License
└── README.md               # Documentation
```

---

## 💡 How StudyFlow Helps Students Use Time Efficiently

1. **Combats Parkinson's Law:** By estimating hours before starting and tracking actual minutes spent, students learn how long tasks actually take.
2. **Eliminates Decision Fatigue:** The Eisenhower Matrix groups what needs to be done immediately vs. what should be scheduled for later.
3. **Prevents Cognitive Burnout:** The Pomodoro cadence enforces necessary rest periods to keep memory consolidation sharp.
4. **Maintains Subject Balance:** Visual deficit bars prevent spending 90% of time on preferred subjects while neglecting harder coursework.

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! Feel free to check the [issues page](https://github.com/your-username/study-planner/issues).

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

