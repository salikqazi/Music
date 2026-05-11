#!/usr/bin/env python3
"""
Dev server — injects a unique timestamp into every script/CSS URL so the proxy
at code-salik.salikqazi.com can never serve a stale cached asset on refresh.
"""
import http.server, socketserver, time, re, os

PORT = 8765
WEB_DIR = os.path.dirname(os.path.abspath(__file__))

# Matches  src="..." and href="..."  for local JS / CSS assets (not http URLs)
ASSET_RE = re.compile(r'((?:src|href)=")((?!https?://)[^"]+\.(js|css))"')

class BustingHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=WEB_DIR, **kwargs)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def do_GET(self):
        # Only rewrite index.html — strip any ?v=... query so the file is found
        clean_path = self.path.split('?')[0]
        if clean_path in ('/', '/index.html'):
            self._serve_html()
        else:
            # Strip cache-bust query before passing to SimpleHTTPRequestHandler
            self.path = clean_path
            super().do_GET()

    def _serve_html(self):
        html_path = os.path.join(WEB_DIR, 'index.html')
        with open(html_path, 'rb') as f:
            html = f.read().decode('utf-8')

        v = str(int(time.time()))
        html = ASSET_RE.sub(lambda m: f'{m.group(1)}{m.group(2)}?v={v}"', html)
        body = html.encode('utf-8')

        self.send_response(200)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        pass  # silence request noise

with socketserver.TCPServer(('', PORT), BustingHandler) as httpd:
    httpd.allow_reuse_address = True
    print(f'Serving on http://localhost:{PORT}  (cache-busting)')
    httpd.serve_forever()
