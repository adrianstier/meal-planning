#!/bin/bash
echo "Monitoring Railway deployment for static file fix..."
echo "Waiting 90 seconds for build to start..."
sleep 90

for i in {1..20}; do
    echo ""
    echo "Check $i/20 - $(date +%H:%M:%S)"
    
    # Test if static JS file is accessible
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" https://web-production-09493.up.railway.app/static/js/main.ee4964d5.js)
    
    if [ "$HTTP_CODE" = "200" ]; then
        echo "✅ DEPLOYMENT SUCCESSFUL!"
        echo "   Static files are now being served correctly (HTTP 200)"
        echo ""
        echo "Testing homepage..."
        curl -s https://web-production-09493.up.railway.app/ | grep -q "main.ee4964d5.js" && echo "   ✅ Homepage loads and references React app"
        echo ""
        echo "🎉 Bento Box feature is now live!"
        echo "   Visit: https://web-production-09493.up.railway.app/bento"
        exit 0
    elif [ "$HTTP_CODE" = "404" ]; then
        echo "   ⏳ Still waiting... (HTTP 404 - deployment in progress)"
    else
        echo "   ⚠️  Unexpected HTTP code: $HTTP_CODE"
    fi
    
    if [ $i -lt 20 ]; then
        sleep 15
    fi
done

echo ""
echo "⏱️  Deployment taking longer than expected"
echo "Check Railway dashboard or wait a few more minutes"
