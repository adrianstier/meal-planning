#!/bin/bash
# Quick script to check if Railway deployment is complete and working

URL="https://web-production-09493.up.railway.app/api/plan/generate-week"

echo "🔍 Checking Railway deployment status..."
echo "================================================"
echo ""

for i in {1..10}; do
    echo "Attempt $i/10: Testing Generate Week endpoint..."

    response=$(curl -s -X POST "$URL" \
        -H "Content-Type: application/json" \
        -d '{"start_date": "2025-11-02", "num_days": 7, "meal_types": ["dinner"]}')

    # Check if response contains "no such column"
    if echo "$response" | grep -q "no such column: cuisine"; then
        echo "❌ Still showing old error (deployment not complete)"
        echo "   Response: $response"
    elif echo "$response" | grep -q '"success": true'; then
        echo "✅ SUCCESS! Buttons are working!"
        echo "   Response: $response"
        echo ""
        echo "================================================"
        echo "🎉 DEPLOYMENT COMPLETE - BUTTONS FIXED!"
        echo "================================================"
        exit 0
    else
        echo "⚠️  Unexpected response: $response"
    fi

    if [ $i -lt 10 ]; then
        echo "   Waiting 15 seconds before next check..."
        echo ""
        sleep 15
    fi
done

echo ""
echo "================================================"
echo "⏳ Deployment still in progress after 2.5 minutes"
echo "================================================"
echo ""
echo "Next steps:"
echo "1. Check Railway dashboard: https://railway.app/dashboard"
echo "2. Look at deployment logs for errors"
echo "3. Run this script again in a few minutes"
echo ""
echo "Or manually trigger with: railway redeploy"
