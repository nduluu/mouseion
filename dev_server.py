"""Local dev server: static files with caching disabled so edits show up on reload.

Pages have plain addresses (/iliad/ita-monti/1/7, see js/router.js), so any
address that isn't a file is answered with index.html, as the real host must
do too (on Cloudflare Pages that is automatic when there is no 404.html; on
Netlify a _redirects line "/*  /index.html  200").
"""
import http.server
import os


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        super().end_headers()

    def send_head(self):
        path = self.translate_path(self.path)
        last = self.path.split("?")[0].rstrip("/").split("/")[-1]
        if not os.path.exists(path) and "." not in last:
            self.path = "/index.html"  # a page address: the app shows it
        return super().send_head()


if __name__ == "__main__":
    http.server.test(HandlerClass=NoCacheHandler, port=4173)
