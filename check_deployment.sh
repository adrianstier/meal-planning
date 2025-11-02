#!/bin/bash
echo "Waiting for Railway to pick up deployment..."
echo "This typically takes 30-60 seconds to start, then 2-3 minutes to complete"
echo ""

for i in {1..30}; do
    echo -n "Check $i/30: "
    
    RESULT=$(curl -s -X POST https://web-production-09493.up.railway.app/api/meals \
      -H "Content-Type: application/json" \
      -d '{"name":"Deploy Test","meal_type":"snack","ingredients":"test","image_url":"/test.jpg"}' \
      2>&1 | python3 -c "import json,sys; 
try:
    d=json.load(sys.stdin)
    print('SUCCESS' if d.get('success') else d.get('error','UNKNOWN'))
except:
    print('PARSING_ERROR')" 2>&1)
    
    if [ "$RESULT" = "SUCCESS" ]; then
        echo "✅ MIGRATIONS COMPLETE!"
        echo ""
        echo "Running comprehensive test suite..."
        python3 comprehensive_test_suite.py
        exit 0
    elif echo "$RESULT" | grep -q "no column"; then
        echo "⏳ Still building/migrating..."
    else
        echo "Status: $RESULT"
    fi
    
    if [ $i -lt 30 ]; then
        sleep 20
    fi
done

echo ""
echo "⏱️  Deployment still in progress after 10 minutes"
echo "Check Railway dashboard for build status"
