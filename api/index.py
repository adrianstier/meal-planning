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

# Import the main Flask app - Vercel expects this to be named 'app'
from app import app

# Vercel will automatically use 'app' as the WSGI application
