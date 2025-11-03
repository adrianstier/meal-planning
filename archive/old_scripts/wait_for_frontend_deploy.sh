#!/bin/bash
echo "Waiting for Railway to rebuild React frontend..."
echo "This will take 3-5 minutes (React build is slow)"
echo ""

for i in {1..20}; do
    echo -n "Check $i/20: "
    
    # Check if the service-worker has been updated (indicates new build)
    TIMESTAMP=$(curl -s -I https://web-production-09493.up.railway.app/service-worker.js | grep -i "last-modified" || echo "No timestamp")
    
    echo "Last-Modified: $TIMESTAMP"
    
    if [ $i -lt 20 ]; then
        sleep 30
    fi
done

echo ""
echo "✅ Deployment should be complete now!"
echo "Try refreshing the web app with a hard refresh (Cmd+Shift+R on Mac, Ctrl+Shift+R on Windows)"
echo "If you still see errors, wait 1-2 more minutes and try again"
