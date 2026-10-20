#!/usr/bin/env python3
"""Local dev server: serves this folder on your network with caching disabled.

    python3 serve.py          # then open the printed address on your phone/laptop
    python3 serve.py 9000     # custom port

Not needed in production: GitHub Pages serves the same static files.
"""
import http.server
import os
import socket
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
ROOT = os.path.dirname(os.path.abspath(__file__))


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, fmt, *args):
        pass  # keep the terminal quiet


def lan_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("10.255.255.255", 1))  # no packets are sent; just picks the outgoing interface
        return s.getsockname()[0]
    except OSError:
        return "127.0.0.1"
    finally:
        s.close()


class Server(http.server.ThreadingHTTPServer):
    # The page loads ~16 modules at once; the default backlog of 5 makes some requests fail
    request_queue_size = 64
    daemon_threads = True


if __name__ == "__main__":
    server = Server(("0.0.0.0", PORT), NoCacheHandler)
    print(f"Guess My Mess is up:\n  this computer:  http://localhost:{PORT}\n  other devices:  http://{lan_ip()}:{PORT}  (same Wi-Fi)")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
