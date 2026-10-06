#!/usr/bin/env python3
"""Tiny local web server for the RadicalMediaPh site.

Usage:  python serve.py [port]      (default port: 8000)
Then open http://localhost:8000
Press Ctrl+C to stop.
"""

import http.server
import os
import socketserver
import sys
import threading
import webbrowser

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
ROOT = os.path.dirname(os.path.abspath(__file__))


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    # serve 404.html for unknown paths
    def send_error(self, code, message=None, explain=None):
        if code == 404:
            page = os.path.join(ROOT, "404.html")
            if os.path.exists(page):
                with open(page, "rb") as fh:
                    body = fh.read()
                self.send_response(404)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                return
        super().send_error(code, message, explain)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, fmt, *args):
        sys.stdout.write("  %s\n" % (fmt % args))


class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


if __name__ == "__main__":
    url = "http://localhost:%d/" % PORT
    try:
        with Server(("", PORT), Handler) as httpd:
            print("\n  RadicalMediaPh is running at %s" % url)
            print("  Serving files from: %s" % ROOT)
            print("  Press Ctrl+C to stop.\n")
            threading.Timer(1.0, lambda: webbrowser.open(url)).start()
            httpd.serve_forever()
    except OSError as err:
        print("\n  Could not start on port %d (%s)." % (PORT, err))
        print("  Try another port, e.g.:  python serve.py 8080\n")
    except KeyboardInterrupt:
        print("\n  Stopped.\n")
