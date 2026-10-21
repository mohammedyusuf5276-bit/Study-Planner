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

### 💾 4. Per-Account Cloud Persistence
- **Private accounts:** Email and password accounts keep each user's study data separate.
- **Cross-device sync:** Tasks, subjects, sessions, and goals are stored in Neon Postgres and load after sign-in.
- **Export & Import JSON:** One-click backup and restore for your study logs and task lists.

---

## 🪶 Footprint & Performance

- **Ultra-lightweight:** Entire project footprint is **under 200 KB** (less than 0.007% of a 3 GB limit).
- **Small deployment:** A static frontend and one lightweight Neon serverless driver, with no frontend framework.
- **Instant startup:** Launches in less than 0.2 seconds.

---

## 🚀 Quick Start Guide

### Prerequisites
- Node.js 20 or higher for the Vercel web app and API.
- A Neon Postgres database with the schema in `database/schema.sql` applied.
- Any modern web browser (Chrome, Edge, Firefox, Safari).

### Run the Application

For the account-backed web app, configure `DATABASE_URL` and `SESSION_SECRET` in Vercel, then deploy using the steps below. To run the Vercel app locally, link the project with the Vercel CLI, pull its environment variables, and run `npx vercel dev`.

The Python CLI and desktop GUI are still available separately:

```bash
# Clone the repository
git clone https://github.com/your-username/study-planner.git
cd study-planner

# Launch the CLI
python main.py --cli
```

*The legacy Python static server is not used for account-backed web mode.*
*Alternatively, you can launch the desktop GUI with:*
```bash
python main.py --gui
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

## Deploy to Vercel

StudyFlow uses Vercel for the website and Neon Postgres for accounts and per-user progress. For a new database, run [`database/schema.sql`](database/schema.sql) in the Neon SQL Editor. For an existing StudyFlow database, also run [`database/add_display_name.sql`](database/add_display_name.sql) to add names to current accounts and [`database/add_admin_role.sql`](database/add_admin_role.sql) to add account roles and promote Mohammed Yusuf's account. Add these Vercel Project Environment Variables for Production and Preview:

- `DATABASE_URL`: Neon connection string.
- `SESSION_SECRET`: a random secret with at least 32 characters. Generate one with `node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"`.

To deploy:

1. Push this repository to GitHub.
2. In Vercel, choose **Add New → Project** and import the repository.
3. Keep the project root as the Root Directory and the framework preset as **Other**. The checked-in `vercel.json` builds the static site, while the `api/` directory provides account and data endpoints.
4. Add the two environment variables in **Settings → Environment Variables**, then redeploy.

Each account has a display name shown below the StudyFlow icon and starts from the shared sample baseline in `app.js`, then saves its own independent copy keyed to its user ID. To clear all accounts' saved progress and reseed them from that baseline at next sign-in, run [`database/reset_progress_to_defaults.sql`](database/reset_progress_to_defaults.sql) in Neon. This keeps account logins but discards saved task/session changes. Previous browser-only progress is not imported.

Accounts with the `admin` role see the Admin tab, where they can create accounts, list account names, emails, roles, and creation dates, or issue a password reset. Passwords are stored as salted hashes and cannot be viewed. Creating an account or resetting its password generates a password shown once in the Admin tab; share it securely. The admin API checks the role in Neon on every request.

Users can create accounts from the sign-in screen. Each email can have one account, and passwords are stored as salted hashes. Users can choose **Remember my email**; password saving is handled by their browser's password manager. To create two disposable demo accounts for checking sign-in and per-user progress, install dependencies, set `DATABASE_URL` to your Neon connection string, and run `npm run seed-demo-users`. The script prints randomly generated credentials once; keep them private. It refuses to overwrite existing demo accounts. The administrator can create a named account interactively with `npm run create-user`, or reset a user's password with `npm run reset-password`. The reset command requires the Neon database connection, prompts for the account email, and hides the temporary password while you type it. Share that temporary password securely and ask the user to change it using their password manager. Neon stores only the new salt and hash; it cannot reveal the password later. Keep `DATABASE_URL` private and run administrative commands only on a trusted machine.

