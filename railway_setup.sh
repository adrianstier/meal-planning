#!/bin/bash
# Railway setup script - runs database migrations before starting the app

echo "🚀 Railway Setup: Running database migrations..."

# Run React schema migration if needed
if [ -f "migrate_to_react_schema.py" ]; then
    echo "Running React schema migration..."
    python3 migrate_to_react_schema.py
else
    echo "⚠️  migrate_to_react_schema.py not found"
fi

echo "✅ Setup complete!"
