#!/usr/bin/env python3
"""Helper script to get the database path for Railway migrations"""
import os
import sys

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from meal_planner import get_db_path

if __name__ == '__main__':
    print(get_db_path())
