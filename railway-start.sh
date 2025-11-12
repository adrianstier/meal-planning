#!/bin/bash
# Railway start script - runs migrations before starting gunicorn
echo "🔄 Running migrations before starting app..."

# Get the correct database path (handles Railway persistent volume)
DB_PATH=$(python3 get_db_path.py)
echo "📊 Database path: $DB_PATH"

# Run all migrations
echo "🔄 Running multi-user authentication migration..."
python3 database/migrations/add_multi_user_support.py "$DB_PATH" || echo "⚠️  Multi-user migration skipped"

echo "🔄 Resetting admin password to known value..."
python3 database/migrations/reset_admin_password.py "$DB_PATH" || echo "⚠️  Password reset skipped"

echo "✅ Migrations complete! Starting gunicorn..."
# Increase timeout to 180 seconds for AI recipe parsing (default is 30s)
exec gunicorn app:app --timeout 180 --workers 1 --log-level info
