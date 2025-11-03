#!/bin/bash
echo "============================================================"
echo "Monitoring Railway Deployment - Migration Timing Fix"
echo "============================================================"
echo ""
echo "This deployment should fix the 'no such column: m.difficulty' error"
echo "by running migrations during the DEPLOY phase when the persistent"
echo "volume is mounted, instead of during the BUILD phase."
echo ""
echo "Expected timeline:"
echo "  - Build phase: 2-3 minutes (React build)"
echo "  - Deploy phase: 30-60 seconds (migrations + gunicorn start)"
echo "  - Total: 3-4 minutes"
echo ""
echo "Starting checks in 60 seconds..."
sleep 60

for i in {1..15}; do
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Check $i/15 ($(date +%H:%M:%S))"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    # Test the meal plan endpoint (was failing with "no such column")
    PLAN_RESULT=$(curl -s "https://web-production-09493.up.railway.app/api/plan/week?start_date=2025-11-03" 2>&1)
    
    if echo "$PLAN_RESULT" | grep -q '"success": true'; then
        echo "✅ MEAL PLAN ENDPOINT: WORKING!"
        echo "   The 'difficulty' column now exists in the database"
    elif echo "$PLAN_RESULT" | grep -q "no such column: m.difficulty"; then
        echo "⏳ MEAL PLAN ENDPOINT: Still failing (migrations haven't run yet)"
    elif echo "$PLAN_RESULT" | grep -q "Application failed to respond"; then
        echo "🔄 RAILWAY: Deployment in progress (app not responding yet)"
    else
        ERROR=$(echo "$PLAN_RESULT" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('error', 'Unknown')[:80])" 2>/dev/null || echo "Connection error")
        echo "⚠️  MEAL PLAN ENDPOINT: $ERROR"
    fi
    
    # Check if we're done
    if echo "$PLAN_RESULT" | grep -q '"success": true'; then
        echo ""
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "🎉 DEPLOYMENT SUCCESSFUL!"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo ""
        echo "The meal plan page should now load correctly!"
        echo ""
        echo "✅ Migrations ran successfully"
        echo "✅ Database schema updated"
        echo "✅ 'difficulty' column now exists"
        echo ""
        echo "You can now:"
        echo "  • View meal plans"
        echo "  • Add new recipes"
        echo "  • Use all features"
        echo ""
        exit 0
    fi
    
    if [ $i -lt 15 ]; then
        echo "Waiting 20 seconds before next check..."
        sleep 20
    fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "⏱️  Deployment taking longer than expected (6+ minutes)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "This could mean:"
echo "  • Railway is still building/deploying (check dashboard)"
echo "  • There may be a build error (check Railway logs)"
echo ""
echo "Check: https://railway.app/project"
