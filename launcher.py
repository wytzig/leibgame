import http.server
import socketserver
import webbrowser
import os
import time
import threading

# Configuratie
PORT = 8000
DIRECTORY = "."

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

def start_server():
    """Start de HTTP server in een aparte thread."""
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        print(f"Server gestart op http://localhost:{PORT}")
        print("Druk op Ctrl+C om te stoppen.")
        httpd.serve_forever()

def main():
    print("--- Leib Weissman Game Launcher ---")
    
    # 1. CRUCIALE FIX: Verander de huidige werkmap naar de map van dit script
    # Dit zorgt ervoor dat de server de bestanden (index.html, main.js, etc.) vindt.
    script_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(script_dir)
    print(f"Werkmap ingesteld op: {script_dir}")
    
    print("Bezig met starten...")
    
    # Controleer of index.html bestaat
    if not os.path.exists("index.html"):
        print("FOUT: index.html niet gevonden in de map. Controleer of het bestand er staat.")
        input("Druk op Enter om af te sluiten...")
        return

    # Start server thread
    server_thread = threading.Thread(target=start_server)
    server_thread.daemon = True
    server_thread.start()

    # Wacht even zodat de server kan opspinnen
    time.sleep(1)

    # Open browser
    url = f"http://localhost:{PORT}"
    print(f"Browser openen op {url}")
    webbrowser.open(url)

    # Houd het script draaiende
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nSpel afgesloten.")

if __name__ == "__main__":
    main()