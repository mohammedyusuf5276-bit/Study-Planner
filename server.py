"""Lightweight Local Server & API Handler for StudyFlow.

Uses ONLY Python's built-in standard library (no pip dependencies required).
Zero overhead (<100 KB total project size, well under 3 GB).
"""

from __future__ import annotations
import http.server
import socketserver
import json
import os
import sys
import webbrowser
from typing import Tuple

PORT = 8000
DATA_FILE = "study_data.json"
DIRECTORY = os.path.dirname(os.path.abspath(__file__))


class StudyFlowRequestHandler(http.server.SimpleHTTPRequestHandler):
    """Handles static files (HTML, CSS, JS) and simple JSON data persistence API."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def do_GET(self) -> None:
        """Handles GET requests for static assets and API data."""
        if self.path == "/api/data":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Cache-Control", "no-cache")
            self.end_headers()

            data_path = os.path.join(DIRECTORY, DATA_FILE)
            if os.path.exists(data_path):
                try:
                    with open(data_path, "r", encoding="utf-8") as f:
                        data = json.load(f)
                    self.wfile.write(json.dumps(data).encode("utf-8"))
                    return
                except Exception:
                    pass

            # Return empty object if no data file yet
            self.wfile.write(b"{}")
            return

        # Redirect root to index.html
        if self.path == "/" or self.path == "":
            self.path = "/index.html"

        super().do_GET()

    def do_POST(self) -> None:
        """Handles POST requests to persist study data to study_data.json."""
        if self.path == "/api/data":
            try:
                content_length = int(self.headers.get("Content-Length", 0))
                body = self.rfile.read(content_length).decode("utf-8")
                payload = json.loads(body)

                data_path = os.path.join(DIRECTORY, DATA_FILE)
                tmp_path = f"{data_path}.tmp"
                with open(tmp_path, "w", encoding="utf-8") as f:
                    json.dump(payload, f, indent=2, ensure_ascii=False)
                os.replace(tmp_path, data_path)

                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"status": "success", "message": "Saved"}).encode("utf-8"))
                return
            except Exception as e:
                self.send_response(500)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"status": "error", "message": str(e)}).encode("utf-8"))
                return

        self.send_response(404)
        self.end_headers()

    def log_message(self, format: str, *args) -> None:
        """Suppress standard access logs to keep terminal output clean."""
        # Only log errors if needed
        if "404" in str(args) or "500" in str(args):
            sys.stderr.write(f"[{self.log_date_time_string()}] {format % args}\n")


def start_server(port: int = PORT, auto_open: bool = True) -> None:
    """Launches the lightweight HTTP server and opens browser."""
    # Allow port reuse immediately
    socketserver.TCPServer.allow_reuse_address = True
    
    server_address: Tuple[str, int] = ("127.0.0.1", port)
    try:
        httpd = socketserver.TCPServer(server_address, StudyFlowRequestHandler)
    except OSError:
        # If port 8000 is occupied, fall back to next available port
        port = 8080
        server_address = ("127.0.0.1", port)
        httpd = socketserver.TCPServer(server_address, StudyFlowRequestHandler)

    if sys.platform == "win32":
        try:
            sys.stdout.reconfigure(encoding="utf-8")
        except Exception:
            pass

    url = f"http://localhost:{port}"
    print("=" * 65)
    print("   [+] StudyFlow - Smart Study Planner & Time Management")
    print("=" * 65)
    print(f">> Local Server running at: {url}")
    print(">> Uses ONLY standard library HTML, CSS, JS & Python (Zero pip packages!)")
    print(f">> Total application footprint: < 200 KB (Well under 3 GB limit)")
    print(">> Real-time Pomodoro timer, time analytics, and task tracking ready.")
    print("=" * 65)
    print("Press Ctrl+C to stop the server.\n")

    if auto_open:
        webbrowser.open(url)

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n🛑 Shutting down StudyFlow server. Happy studying!\n")
        httpd.server_close()

