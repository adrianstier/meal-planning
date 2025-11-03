#!/bin/bash
# Railway build script - builds React app during deployment

echo "🏗️  Building React app..."
cd client
npm install
npm run build
cd ..

echo "📦 Copying build files..."
rm -rf templates/static
mkdir -p templates
cp -r client/build/static templates/

echo "📄 Copying index.html and manifest to templates folder..."
cp client/build/index.html templates/index.html
cp client/build/manifest.json templates/manifest.json 2>/dev/null || true

echo "🔄 Running database migrations..."
python3 setup.py || echo "⚠️  Setup script encountered issues (may be normal if DB already initialized)"

echo "🔄 Running additional migrations..."
# Get the correct database path (handles Railway persistent volume)
DB_PATH=$(python3 get_db_path.py)
echo "📊 Database path: $DB_PATH"

python3 database/migrations/migrate_to_react_schema.py "$DB_PATH" || echo "⚠️  React schema migration skipped (may already be applied)"
python3 database/migrations/add_recipe_metadata.py "$DB_PATH" || echo "⚠️  Recipe metadata migration skipped"
python3 database/migrations/add_cuisine.py "$DB_PATH" || echo "⚠️  Cuisine migration skipped"
python3 database/migrations/add_bento_tables.py "$DB_PATH" || echo "⚠️  Bento tables migration skipped"
python3 database/migrations/add_performance_indexes.py "$DB_PATH" || echo "⚠️  Performance indexes migration skipped"

echo "✅ Build complete!"
