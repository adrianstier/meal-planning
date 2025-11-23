"""
Vercel Serverless Function Entry Point
Wraps the Flask application for Vercel deployment
"""

import sys
import os

# Add project root to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from flask import Flask, request, jsonify, session
from flask_cors import CORS
from dotenv import load_dotenv
import secrets

# Load environment variables
load_dotenv()

# Import the main Flask app
from app import app

# Vercel handler
def handler(request):
    """Vercel serverless function handler"""
    return app(request.environ, lambda s, h: None)

# For local testing
if __name__ == "__main__":
    app.run(debug=True, port=5001)
