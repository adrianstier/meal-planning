"""
Vercel Serverless Function Entry Point
Wraps the Flask application for Vercel deployment
"""

import sys
import os
import traceback

# Add project root to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Set environment variable to indicate we're on Vercel
os.environ['VERCEL'] = '1'

from flask import Flask, jsonify
from flask_cors import CORS

# Create a debug app first
debug_app = Flask(__name__)
CORS(debug_app)

initialization_error = None

try:
    from dotenv import load_dotenv
    load_dotenv()

    # Import the main Flask app
    from app import app

    # Export for Vercel
    handler = app

except Exception as e:
    # Capture the full traceback
    initialization_error = traceback.format_exc()

    @debug_app.route('/api/<path:path>', methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'])
    def error_handler(path):
        return jsonify({
            'success': False,
            'error': 'Application failed to initialize',
            'details': initialization_error,
            'path': path
        }), 500

    handler = debug_app
