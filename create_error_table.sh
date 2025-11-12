#!/bin/bash
# Emergency script to create error_logs table
# This runs during Railway build process

echo "🔧 Creating error_logs table in production database..."

python3 << 'PYTHON_SCRIPT'
import sqlite3
import os

# Get database path
db_path = os.getenv('DATABASE_PATH', '/app/data/meal_planner.db')
if not os.path.exists(db_path):
    db_path = 'meal_planner.db'

print(f"Database path: {db_path}")

try:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Check if table exists
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='error_logs'")
    if cursor.fetchone():
        print("✅ error_logs table already exists")
    else:
        print("📝 Creating error_logs table...")
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

        cursor.execute("CREATE INDEX idx_error_logs_timestamp ON error_logs(timestamp DESC)")
        cursor.execute("CREATE INDEX idx_error_logs_type ON error_logs(error_type)")
        cursor.execute("CREATE INDEX idx_error_logs_resolved ON error_logs(resolved)")
        cursor.execute("CREATE INDEX idx_error_logs_user ON error_logs(user_id)")

        conn.commit()
        print("✅ error_logs table created successfully!")

    conn.close()
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
    exit(1)

print("✅ Done!")
PYTHON_SCRIPT

echo "Finished error_logs table setup"
