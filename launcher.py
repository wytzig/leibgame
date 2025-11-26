import http.server
import socketserver
import webbrowser
import os
import time
import threading
import subprocess
import sys

# Configuratie
PORT = 8000
DIRECTORY = "."

class ReusableTCPServer(socketserver.TCPServer):
    allow_reuse_address = True

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

def start_server():
    """Start de HTTP server in een aparte thread."""
    with ReusableTCPServer(("", PORT), Handler) as httpd:
        print(f"Server gestart op http://localhost:{PORT}")
        print("Druk op Ctrl+C om te stoppen.")
        httpd.serve_forever()

def open_browser(url):
    """Open browser met fallback opties voor Linux."""
    try:
        # Probeer eerst de standaard webbrowser
        webbrowser.open(url)
    except Exception as e:
        print(f"Standaard methode mislukt: {e}")
        # Fallback voor Linux: probeer direct xdg-open
        try:
            subprocess.Popen(['xdg-open', url], 
                           stdout=subprocess.DEVNULL, 
                           stderr=subprocess.DEVNULL)
            print("Browser geopend via xdg-open")
        except Exception as e2:
            print(f"xdg-open mislukt: {e2}")
            print(f"Open handmatig: {url}")

def main():
    print("--- Leib Weissman Game Launcher ---")
    
    # Navigeer naar de map van het script
    script_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(script_dir)
    print(f"Werkmap ingesteld op: {script_dir}")
    
    print("Bezig met starten...")
    
    if not os.path.exists("index.html"):
        print("FOUT: index.html niet gevonden in deze map!")
        input("Druk op Enter om af te sluiten...")
        return

    # Start server thread
    server_thread = threading.Thread(target=start_server)
    server_thread.daemon = True
    server_thread.start()

    time.sleep(1)

    url = f"http://localhost:{PORT}"
    print(f"Browser openen op {url}")
    open_browser(url)

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n✅ Spel afgesloten.")

if __name__ == "__main__":
    main()