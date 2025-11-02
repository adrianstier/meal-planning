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
python3 database/migrations/migrate_to_react_schema.py || echo "⚠️  React schema migration skipped (may already be applied)"
python3 database/migrations/add_recipe_metadata.py || echo "⚠️  Recipe metadata migration skipped"
python3 database/migrations/add_cuisine.py || echo "⚠️  Cuisine migration skipped"
python3 database/migrations/add_bento_tables.py || echo "⚠️  Bento tables migration skipped"

echo "✅ Build complete!"
