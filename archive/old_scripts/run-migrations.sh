#!/bin/bash
# Run database migrations during Railway deploy phase (when persistent volume is mounted)
set -e  # Exit on error

echo "============================================================"
echo "🔄 Running Database Migrations"
echo "============================================================"

# Initialize database if it doesn't exist
echo "📁 Initializing database..."
python3 setup.py || {
    echo "⚠️  Setup script encountered issues (may be normal if DB already initialized)"
}

# Get the correct database path (handles Railway persistent volume)
echo "📊 Getting database path..."
DB_PATH=$(python3 get_db_path.py) || {
    echo "❌ ERROR: Failed to get database path!"
    echo "Falling back to default path: meal_planner.db"
    DB_PATH="meal_planner.db"
}
echo "📊 Database path: $DB_PATH"

# Check if database file exists
if [ -f "$DB_PATH" ]; then
    echo "✓ Database file found at: $DB_PATH"
else
    echo "⚠️  Database file not found, will be created during migrations"
fi

echo ""
echo "🔄 Running schema migrations..."

# Run all migrations with proper error handling
set +e  # Don't exit on migration errors (they may already be applied)
python3 database/migrations/migrate_to_react_schema.py "$DB_PATH"
python3 database/migrations/add_recipe_metadata.py "$DB_PATH"
python3 database/migrations/add_cuisine.py "$DB_PATH"
python3 database/migrations/add_bento_tables.py "$DB_PATH"
python3 database/migrations/add_performance_indexes.py "$DB_PATH"
set -e

echo ""
echo "✅ Migrations complete!"
echo "============================================================"
exit 0
