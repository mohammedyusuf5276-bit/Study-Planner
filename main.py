"""StudyFlow - Main Entry Point.

Run:
  python main.py          -> Launches the HTML/CSS/JS web app in your browser
  python main.py --cli    -> Launches the interactive command line interface
  python main.py --gui    -> Launches the desktop Tkinter interface
"""

import sys
from server import start_server


def main():
    if "--cli" in sys.argv:
        from study_planner.planner import StudyPlanner
        from study_planner.time_tracker import TimeTracker
        from study_planner.analytics import StudyAnalytics
        from study_planner.cli import StudyPlannerCLI

        planner = StudyPlanner()
        tracker = TimeTracker(planner=planner)
        analytics = StudyAnalytics(planner=planner, tracker=tracker)
        cli = StudyPlannerCLI(planner, tracker, analytics)
        cli.run()
    elif "--gui" in sys.argv:
        from study_planner.planner import StudyPlanner
        from study_planner.time_tracker import TimeTracker
        from study_planner.analytics import StudyAnalytics
        from study_planner.gui import launch_gui

        planner = StudyPlanner()
        tracker = TimeTracker(planner=planner)
        analytics = StudyAnalytics(planner=planner, tracker=tracker)
        launch_gui(planner, tracker, analytics)
    else:
        auto_open = "--no-browser" not in sys.argv
        start_server(auto_open=auto_open)


if __name__ == "__main__":
    main()

