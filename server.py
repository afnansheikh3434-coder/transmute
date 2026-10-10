import http.server
import socketserver
import os
import sys

# Read PORT from environment variable (Render sets this dynamically, e.g. 10000 or a random port)
PORT = int(os.environ.get("PORT", 8080))
HOST = "0.0.0.0"
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

def run():
    os.chdir(DIRECTORY)
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer((HOST, PORT), Handler) as httpd:
        print(f"Server started on http://{HOST}:{PORT}")
        sys.stdout.flush()
        httpd.serve_forever()

if __name__ == "__main__":
    try:
        run()
    except KeyboardInterrupt:
        print("Server shutdown requested.")
