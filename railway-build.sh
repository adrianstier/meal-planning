#!/bin/bash
# Build script for Railway deployment
# Builds React frontend and copies to Flask's static serving directory

set -e

echo "=== Building React frontend ==="
cd client
npm install
CI=false npm run build
cd ..

echo "=== Copying build to templates/static ==="
rm -rf templates/static/client
mkdir -p templates/static/client
cp -r client/build/* templates/static/client/

echo "=== Build complete ==="
ls -la templates/static/client/
