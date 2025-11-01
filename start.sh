#!/bin/bash
# Easy launcher for Family Meal Planner

echo "======================================================================"
echo "🍽️  Family Meal Planner - Starting..."
echo "======================================================================"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  No .env file found. Creating from template..."
    cp .env.example .env
    echo "✓ Created .env file"
    echo "⚠️  Please add your ANTHROPIC_API_KEY to .env"
    echo ""
fi

# Check if database exists
if [ ! -f meal_planner.db ]; then
    echo "📊 No database found. Initializing..."
    python3 setup.py
    echo ""
fi

# Check if port 5000 is available
if lsof -Pi :5000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "⚠️  Port 5000 is in use (probably AirPlay on macOS)"
    echo "🚀 Starting on port 5001 instead..."
    PORT=5001
else
    echo "🚀 Starting on port 5000..."
    PORT=5000
fi

echo ""
echo "======================================================================"
echo "✨ Your Family Meal Planner is ready!"
echo "======================================================================"
echo ""
echo "📱 Open in your browser:"
echo "   http://localhost:$PORT"
echo ""
echo "⌨️  Press Ctrl+C to stop the server"
echo ""
echo "======================================================================"
echo ""

# Start the app
PORT=$PORT python3 app.py
