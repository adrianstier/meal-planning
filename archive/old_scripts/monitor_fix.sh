#!/bin/bash
echo "Monitoring Railway deployment with database migration fix..."
echo "Waiting 30 seconds for deployment to start..."
sleep 30

for i in {1..40}; do
    echo -n "Check $i/40: "
    
    RESULT=$(curl -s "https://web-production-09493.up.railway.app/api/plan/week?start_date=2025-11-03" 2>&1)
    
    if echo "$RESULT" | grep -q '"success": true'; then
        echo "✅ SUCCESS!"
        echo ""
        echo "🎉 Meal plan loading is now WORKING!"
        echo "The database migrations have been applied successfully."
        echo ""
        exit 0
    elif echo "$RESULT" | grep -q "no such column"; then
        echo "⏳ Still migrating..."
    else
        echo "⏳ Building/deploying..."
    fi
    
    [ $i -lt 40 ] && sleep 15
done

echo ""
echo "⏱️  Still deploying. Check Railway dashboard."
