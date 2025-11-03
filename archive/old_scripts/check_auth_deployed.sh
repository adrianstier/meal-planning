#!/bin/bash
echo "================================================"
echo "Checking for Authentication Deployment"
echo "================================================"
echo ""
echo "Watching for changes every 15 seconds..."
echo "This will detect when Railway deploys the auth code."
echo ""

OLD_BUNDLE="main.ee4964d5.js"

for i in {1..20}; do
    echo -n "Check $i/20 ($(date +%H:%M:%S)): "
    
    # Get current bundle filename
    CURRENT_BUNDLE=$(curl -s "https://web-production-09493.up.railway.app/" | grep -o 'static/js/main\.[^"]*\.js' | head -1)
    
    if [ "$CURRENT_BUNDLE" != "$OLD_BUNDLE" ] && [ -n "$CURRENT_BUNDLE" ]; then
        echo ""
        echo "================================================"
        echo "✅ NEW DEPLOYMENT DETECTED!"
        echo "================================================"
        echo ""
        echo "Old bundle: $OLD_BUNDLE"
        echo "New bundle: $CURRENT_BUNDLE"
        echo ""
        echo "The authentication code should now be live!"
        echo ""
        echo "Next steps:"
        echo "1. Open Chrome DevTools (F12)"
        echo "2. Right-click refresh button"
        echo "3. Select 'Empty Cache and Hard Reload'"
        echo "4. You should see the login page!"
        echo ""
        echo "Login credentials:"
        echo "  Username: admin"
        echo "  Password: OwtvQubm2H9BP0qE"
        echo ""
        exit 0
    else
        echo "Still old build ($CURRENT_BUNDLE)"
    fi
    
    if [ $i -lt 20 ]; then
        sleep 15
    fi
done

echo ""
echo "================================================"
echo "⏱️  No new deployment detected after 5 minutes"
echo "================================================"
echo ""
echo "Railway may not have auto-deploy configured."
echo "Please manually click 'Redeploy' in Railway dashboard."
echo ""
