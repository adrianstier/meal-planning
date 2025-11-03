#!/bin/bash
echo "Monitoring Railway deployment..."
echo "Waiting for database migrations to complete..."
echo ""

for i in {1..30}; do
    echo -n "Check $i/30 ($(date +%H:%M:%S)): "
    
    # Test the meal plan endpoint that requires 'difficulty' column
    RESULT=$(curl -s "https://web-production-09493.up.railway.app/api/plan/week?start_date=2025-11-03" 2>&1)
    
    if echo "$RESULT" | grep -q '"success": true'; then
        echo "✅ SUCCESS!"
        echo ""
        echo "🎉 Railway deployment complete!"
        echo "The meal plan page should now work correctly."
        echo ""
        echo "The issue was:"
        echo "  - Railway database was missing the 'difficulty' column"
        echo "  - Migration has now been applied"
        echo ""
        exit 0
    elif echo "$RESULT" | grep -q "no such column: m.difficulty"; then
        echo "⏳ Migrations still pending..."
    elif echo "$RESULT" | grep -q "Internal Server Error"; then
        echo "⏳ Build in progress..."
    else
        ERROR=$(echo "$RESULT" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('error', 'Unknown')[:60])" 2>/dev/null || echo "Building...")
        echo "Status: $ERROR"
    fi
    
    if [ $i -lt 30 ]; then
        sleep 10
    fi
done

echo ""
echo "⏱️  Deployment is taking longer than expected (5 minutes)."
echo ""
echo "This is normal for Railway deployments with React builds."
echo "Check Railway dashboard for build status: https://railway.app/project"
