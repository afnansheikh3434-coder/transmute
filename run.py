import http.server
import socketserver
import webbrowser
import os
import sys

# Support PORT from environment variable (default: 8080) and listen on all interfaces
PORT = int(os.environ.get("PORT", 8080))
HOST = "0.0.0.0"
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

def start_server():
    os.chdir(DIRECTORY)
    is_cloud = "PORT" in os.environ or "RENDER" in os.environ
    
    # Allow socket address reuse to prevent 'Address already in use' errors on restarts
    socketserver.TCPServer.allow_reuse_address = True
    
    with socketserver.TCPServer((HOST, PORT), Handler) as httpd:
        print(f"=======================================================")
        print(f"  TRANSMUTE - Discipline & Mastery Hub")
        print(f"  Listening on: http://{HOST}:{PORT}")
        print(f"=======================================================")
        
        # Open browser automatically only when running locally, not in cloud containers
        if not is_cloud:
            try:
                webbrowser.open(f"http://localhost:{PORT}")
            except Exception:
                pass
                
        httpd.serve_forever()

if __name__ == "__main__":
    try:
        start_server()
    except KeyboardInterrupt:
        print("\nServer stopped. Stay focused!")

