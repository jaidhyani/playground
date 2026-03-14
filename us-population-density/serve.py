#!/usr/bin/env python3
"""HTTP server with Range request support (required by PMTiles)."""

import http.server
import os
import sys

class RangeHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def do_GET(self):
        # Strip conditional headers so we never return 304 through a reverse proxy
        if 'If-Modified-Since' in self.headers:
            del self.headers['If-Modified-Since']
        if 'If-None-Match' in self.headers:
            del self.headers['If-None-Match']

        path = self.translate_path(self.path)
        if os.path.isfile(path) and self.headers.get("Range"):
            self._serve_range(path)
        else:
            super().do_GET()

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Range")
        self.end_headers()

    def _serve_range(self, path):
        file_size = os.path.getsize(path)
        range_header = self.headers["Range"]

        try:
            range_spec = range_header.replace("bytes=", "")
            start_str, end_str = range_spec.split("-")
            start = int(start_str) if start_str else 0
            end = int(end_str) if end_str else file_size - 1
        except (ValueError, AttributeError):
            self.send_error(416, "Invalid range")
            return

        if start >= file_size:
            self.send_error(416, "Range not satisfiable")
            return

        end = min(end, file_size - 1)
        length = end - start + 1

        self.send_response(206)
        self.send_header("Content-Type", self.guess_type(path))
        self.send_header("Content-Range", f"bytes {start}-{end}/{file_size}")
        self.send_header("Content-Length", str(length))
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Expose-Headers", "Content-Range, Content-Length")
        self.end_headers()

        with open(path, "rb") as f:
            f.seek(start)
            self.wfile.write(f.read(length))

import socket

class DualStackHTTPServer(http.server.HTTPServer):
    address_family = socket.AF_INET6

    def server_bind(self):
        self.socket.setsockopt(socket.IPPROTO_IPV6, socket.IPV6_V6ONLY, 0)
        super().server_bind()

if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    server = DualStackHTTPServer(("::", port), RangeHTTPRequestHandler)
    print(f"Serving on http://[::] (IPv4+IPv6) port {port}")
    server.serve_forever()
