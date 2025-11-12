#!/usr/bin/env python3
"""
One-time script to create error_logs table in production
"""

import sqlite3
import os

db_path = os.getenv('DATABASE_PATH', 'meal_planner.db')
print(f"Connecting to database: {db_path}")

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

try:
    # Check if table already exists
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='error_logs'")
    if cursor.fetchone():
        print("✓ error_logs table already exists")
    else:
        # Create error_logs table
        print("Creating error_logs table...")
        cursor.execute("""
            CREATE TABLE error_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                error_type VARCHAR(50) NOT NULL,
                message TEXT NOT NULL,
                stack_trace TEXT,
                component VARCHAR(255),
                url VARCHAR(500),
                user_id INTEGER,
                session_id VARCHAR(255),
                browser_info TEXT,
                metadata TEXT,
                resolved BOOLEAN DEFAULT 0,
                resolved_at DATETIME,
                resolved_by VARCHAR(255),
                notes TEXT,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
            )
        """)

        # Create indexes
        cursor.execute("CREATE INDEX idx_error_logs_timestamp ON error_logs(timestamp DESC)")
        cursor.execute("CREATE INDEX idx_error_logs_type ON error_logs(error_type)")
        cursor.execute("CREATE INDEX idx_error_logs_resolved ON error_logs(resolved)")
        cursor.execute("CREATE INDEX idx_error_logs_user ON error_logs(user_id)")

        conn.commit()
        print("✓ Created error_logs table with indexes")

except sqlite3.Error as e:
    conn.rollback()
    print(f"✗ Error: {e}")
    raise
finally:
    conn.close()

print("Migration complete!")
