#!/bin/bash
# Railway build script - builds React app during deployment
# Build timestamp: 2025-11-03 15:28:00 UTC - FORCE REBUILD - Responsive Nav

echo "🏗️  Building React app..."
echo "🔄 Clearing npm cache to force fresh build..."
cd client
rm -rf node_modules/.cache
rm -rf build
cd ..
cd client
npm install
npm run build
cd ..

echo "📦 Copying build files..."
# Preserve recipe_images folder if it exists
if [ -d "templates/static/recipe_images" ]; then
  echo "📸 Preserving existing recipe images..."
  mv templates/static/recipe_images /tmp/recipe_images_backup
fi

rm -rf templates/static
mkdir -p templates
cp -r client/build/static templates/

# Restore recipe_images folder
if [ -d "/tmp/recipe_images_backup" ]; then
  mkdir -p templates/static/recipe_images
  mv /tmp/recipe_images_backup/* templates/static/recipe_images/ 2>/dev/null || true
  rm -rf /tmp/recipe_images_backup
else
  mkdir -p templates/static/recipe_images
fi

echo "📄 Copying index.html, manifest, and assets to templates folder..."
cp client/build/index.html templates/index.html
cp client/build/manifest.json templates/manifest.json 2>/dev/null || true
cp client/build/favicon.ico templates/favicon.ico 2>/dev/null || true
cp client/build/logo192.png templates/logo192.png 2>/dev/null || true
cp client/build/logo512.png templates/logo512.png 2>/dev/null || true

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
python3 database/migrations/add_multi_user_support.py "$DB_PATH" || echo "⚠️  Multi-user migration skipped"
python3 database/migrations/add_error_logs.py "$DB_PATH" || echo "⚠️  Error logs migration skipped"
python3 database/migrations/add_subscriptions.py "$DB_PATH" || echo "⚠️  Subscriptions migration skipped"
python3 database/migrations/add_nutrition_tracking.py "$DB_PATH" || echo "⚠️  Nutrition tracking migration skipped"
python3 database/migrations/add_restaurants.py "$DB_PATH" || echo "⚠️  Restaurants migration skipped"
python3 database/migrations/add_user_id_to_leftovers_inventory.py "$DB_PATH" || echo "⚠️  Leftovers inventory migration skipped"
python3 database/migrations/add_csa_boxes.py "$DB_PATH" || echo "⚠️  CSA boxes migration skipped"

echo "🔧 Running emergency error_logs table creation..."
chmod +x create_error_table.sh
bash create_error_table.sh || echo "⚠️  Emergency table creation had issues"

echo "✅ Build complete!"
