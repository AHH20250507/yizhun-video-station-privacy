import http.server

PORT = 8795

class NoCacheHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

class ReusableThreadingHTTPServer(http.server.ThreadingHTTPServer):
    allow_reuse_address = True
    daemon_threads = True
    block_on_close = False


with ReusableThreadingHTTPServer(("127.0.0.1", PORT), NoCacheHTTPRequestHandler) as httpd:
    print(f"Serving threaded HTTP with No-Cache headers on port {PORT}...")
    httpd.serve_forever()
