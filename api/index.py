"""
Vercel Serverless Function Entry Point
Wraps the Flask application for Vercel deployment using WSGI
"""

from http.server import BaseHTTPRequestHandler
from io import BytesIO
import sys
import os
import traceback
import json

# Add project root to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Set environment variable to indicate we're on Vercel
os.environ['VERCEL'] = '1'

# Try to import the Flask app
flask_app = None
initialization_error = None

try:
    from dotenv import load_dotenv
    load_dotenv()

    from app import app as flask_app
except Exception as e:
    initialization_error = traceback.format_exc()


class handler(BaseHTTPRequestHandler):
    def do_request(self):
        # If Flask app failed to initialize, return error
        if flask_app is None:
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            error_response = {
                'success': False,
                'error': 'Application failed to initialize',
                'details': initialization_error
            }
            self.wfile.write(json.dumps(error_response).encode())
            return

        # Build WSGI environment
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length) if content_length > 0 else b''

        environ = {
            'REQUEST_METHOD': self.command,
            'SCRIPT_NAME': '',
            'PATH_INFO': self.path.split('?')[0],
            'QUERY_STRING': self.path.split('?')[1] if '?' in self.path else '',
            'CONTENT_TYPE': self.headers.get('Content-Type', ''),
            'CONTENT_LENGTH': str(content_length),
            'SERVER_NAME': 'vercel',
            'SERVER_PORT': '443',
            'SERVER_PROTOCOL': 'HTTP/1.1',
            'wsgi.version': (1, 0),
            'wsgi.url_scheme': 'https',
            'wsgi.input': BytesIO(body),
            'wsgi.errors': sys.stderr,
            'wsgi.multithread': False,
            'wsgi.multiprocess': False,
            'wsgi.run_once': True,
        }

        # Add HTTP headers
        for key, value in self.headers.items():
            key = key.upper().replace('-', '_')
            if key not in ('CONTENT_TYPE', 'CONTENT_LENGTH'):
                environ[f'HTTP_{key}'] = value

        # Capture response
        response_started = []
        response_headers = []

        def start_response(status, headers, exc_info=None):
            response_started.append(status)
            response_headers.extend(headers)
            return lambda s: None

        # Call Flask app
        try:
            response_body = b''.join(flask_app(environ, start_response))
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            error_response = {
                'success': False,
                'error': str(e),
                'traceback': traceback.format_exc()
            }
            self.wfile.write(json.dumps(error_response).encode())
            return

        # Parse status code
        status_code = int(response_started[0].split(' ')[0]) if response_started else 500

        # Send response
        self.send_response(status_code)
        for header_name, header_value in response_headers:
            self.send_header(header_name, header_value)
        self.end_headers()
        self.wfile.write(response_body)

    def do_GET(self):
        self.do_request()

    def do_POST(self):
        self.do_request()

    def do_PUT(self):
        self.do_request()

    def do_DELETE(self):
        self.do_request()

    def do_OPTIONS(self):
        self.do_request()

    def do_PATCH(self):
        self.do_request()
