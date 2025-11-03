#!/bin/bash
echo "Monitoring Railway deployment status..."
echo "This will take 3-5 minutes for the full deployment to complete."
echo ""

for i in {1..20}; do
    echo "Check $i/20 ($(date +%H:%M:%S)):"
    
    # Test recipe adding endpoint
    RECIPE_TEST=$(curl -s -X POST https://web-production-09493.up.railway.app/api/meals \
      -H "Content-Type: application/json" \
      -d '{"name":"Deployment Test","meal_type":"snack","ingredients":"test","image_url":"/test.jpg"}' 2>&1)
    
    if echo "$RECIPE_TEST" | grep -q '"success": true'; then
        echo "  ✅ Recipe adding: WORKING"
    elif echo "$RECIPE_TEST" | grep -q "no column"; then
        echo "  ⏳ Recipe adding: Migrations pending..."
    else
        echo "  ⚠️  Recipe adding: $(echo "$RECIPE_TEST" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('error', 'Unknown error')[:50])" 2>/dev/null || echo "Error")"
    fi
    
    # Test meal plan endpoint
    PLAN_TEST=$(curl -s https://web-production-09493.up.railway.app/api/plan/week 2>&1)
    
    if echo "$PLAN_TEST" | grep -q '"success": true'; then
        echo "  ✅ Meal plan loading: WORKING"
    else
        echo "  ⚠️  Meal plan: $(echo "$PLAN_TEST" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('error', 'Error')[:50])" 2>/dev/null || echo "Error")"
    fi
    
    # Check if both are working
    if echo "$RECIPE_TEST" | grep -q '"success": true' && echo "$PLAN_TEST" | grep -q '"success": true'; then
        echo ""
        echo "🎉 DEPLOYMENT COMPLETE! Both recipe adding and meal planning are working!"
        echo ""
        echo "You can now:"
        echo "  1. Add recipes with images"
        echo "  2. View meal plans"
        echo "  3. Use the Bento box feature"
        echo ""
        exit 0
    fi
    
    echo ""
    
    if [ $i -lt 20 ]; then
        sleep 15
    fi
done

echo ""
echo "⏱️  Deployment is taking longer than expected."
echo "This could mean:"
echo "  - Railway is still building (check Railway dashboard)"
echo "  - There's a build error (check Railway logs)"
echo ""
echo "You can check the status at: https://railway.app/project"
