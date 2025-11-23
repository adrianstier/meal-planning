"""
Vercel Serverless Function Entry Point
Wraps the Flask application for Vercel deployment
"""

from flask import Flask, jsonify

app = Flask(__name__)

import sys
import os
import traceback

# Add project root to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Set environment variable to indicate we're on Vercel
os.environ['VERCEL'] = '1'

initialization_error = None
main_app = None

try:
    from flask_cors import CORS
    CORS(app)

    from dotenv import load_dotenv
    load_dotenv()

    # Import the main Flask app
    from app import app as main_app

    # Use the main app as the handler
    handler = main_app

except Exception as e:
    # Capture the full traceback
    initialization_error = traceback.format_exc()

    @app.route('/api/<path:path>', methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'])
    def error_handler(path):
        return jsonify({
            'success': False,
            'error': 'Application failed to initialize',
            'details': initialization_error,
            'path': path
        }), 500

    @app.route('/', methods=['GET'])
    def root():
        return jsonify({
            'status': 'error',
            'error': initialization_error
        }), 500

    handler = app
