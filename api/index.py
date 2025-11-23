"""
Vercel Serverless Function Entry Point
Wraps the Flask application for Vercel deployment
"""

import sys
import os

# Add project root to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Set environment variable to indicate we're on Vercel
os.environ['VERCEL'] = '1'

from dotenv import load_dotenv

# Load environment variables
load_dotenv()

try:
    # Import the main Flask app
    from app import app

    # Export for Vercel
    handler = app

except Exception as e:
    # If import fails, create a minimal Flask app that shows the error
    from flask import Flask, jsonify

    app = Flask(__name__)
    error_message = str(e)

    @app.route('/api/<path:path>', methods=['GET', 'POST', 'PUT', 'DELETE'])
    def error_handler(path):
        return jsonify({
            'success': False,
            'error': f'Application failed to initialize: {error_message}',
            'path': path
        }), 500

    handler = app
