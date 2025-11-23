"""
Vercel Serverless Function Entry Point
Wraps the Flask application for Vercel deployment
"""

import sys
import os

# Add project root to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Import the main Flask app
from app import app

# Vercel Python runtime expects either:
# 1. A WSGI app named 'app' (which we have)
# 2. Or a handler function

# Export the Flask app for Vercel's WSGI handler
handler = app
