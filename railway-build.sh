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

echo "✅ Build complete!"
