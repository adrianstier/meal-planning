#!/bin/bash
# Build script for Railway deployment
# Builds React frontend and copies to Flask's static serving directory

set -e

echo "=== Building React frontend ==="
cd client
npm install
CI=false npm run build
cd ..

echo "=== Copying build to templates ==="
# Create templates/static directory if it doesn't exist (it's gitignored)
mkdir -p templates/static

# Copy static files (js, css, media) to templates/static
rm -rf templates/static/js templates/static/css templates/static/media
cp -r client/build/static/* templates/static/

# Copy root files to templates
cp client/build/index.html templates/
cp client/build/manifest.json templates/ 2>/dev/null || true
cp client/build/favicon.ico templates/ 2>/dev/null || true
cp client/build/logo192.png templates/ 2>/dev/null || true
cp client/build/logo512.png templates/ 2>/dev/null || true
cp client/build/robots.txt templates/ 2>/dev/null || true
cp client/build/asset-manifest.json templates/ 2>/dev/null || true

echo "=== Build complete ==="
echo "Static files:"
ls -la templates/static/
echo ""
echo "Root files:"
ls -la templates/index.html templates/manifest.json 2>/dev/null || true
