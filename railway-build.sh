#!/bin/bash
# Railway build script - builds React app during deployment

echo "🏗️  Building React app..."
cd client
npm install
npm run build
cd ..

echo "📦 Copying build files..."
rm -rf static/css static/js static/media
cp -r client/build/* static/

echo "✅ Build complete!"
