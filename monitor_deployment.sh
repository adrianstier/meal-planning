#!/bin/bash
echo "Monitoring Railway deployment..."
echo "Checking every 15 seconds..."

for i in {1..20}; do
    echo ""
    echo "Check $i/20:"
    
    # Test if columns exist
    RESULT=$(curl -s -X POST https://web-production-09493.up.railway.app/api/meals \
      -H "Content-Type: application/json" \
      -d '{"name":"Deploy Test","meal_type":"snack","ingredients":"test","image_url":"/test.jpg"}' \
      | python3 -c "import json,sys; d=json.load(sys.stdin); print('SUCCESS' if d.get('success') else d.get('error','UNKNOWN'))")
    
    if [ "$RESULT" = "SUCCESS" ]; then
        echo "✅ DEPLOYMENT COMPLETE - Migrations ran successfully!"
        echo "You can now add recipes with images!"
        exit 0
    elif echo "$RESULT" | grep -q "no column"; then
        echo "⏳ Still waiting... (migrations haven't run yet)"
    else
        echo "Status: $RESULT"
    fi
    
    if [ $i -lt 20 ]; then
        sleep 15
    fi
done

echo ""
echo "⏱️  Deployment taking longer than expected (5 minutes)"
echo "Check Railway dashboard or try again in a few minutes"
