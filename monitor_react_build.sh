#!/bin/bash
echo "🔍 Monitoring Railway React Build Deployment"
echo "=============================================="
echo ""
echo "Current bundle: main.ee4964d5.js (OLD - no AuthContext)"
echo ""
echo "Waiting for bundle hash to change..."
echo "This means Railway has:"
echo "  1. Run npm install"
echo "  2. Run npm build (creates NEW bundle with AuthContext)"
echo "  3. Copied to templates/"
echo "  4. Deployed new version"
echo ""
echo "Expected time: 3-5 minutes"
echo ""

for i in {1..12}; do
    echo -n "Check $i/12 ($(date +%H:%M:%S)): "
    
    # Get current bundle hash
    BUNDLE=$(curl -s "https://web-production-09493.up.railway.app/" | grep -o 'static/js/main\.[^"]*\.js' | head -1)
    
    if [ "$BUNDLE" = "static/js/main.ee4964d5.js" ]; then
        echo "Still OLD bundle (main.ee4964d5.js) - waiting..."
    elif [ -n "$BUNDLE" ]; then
        echo "✅ NEW BUNDLE DETECTED: $BUNDLE"
        echo ""
        echo "Verifying AuthContext exists in new bundle..."
        
        # Check if AuthContext is in the new bundle
        AUTH_CHECK=$(curl -s "https://web-production-09493.up.railway.app/$BUNDLE" | grep -o "AuthContext" | head -1)
        
        if [ "$AUTH_CHECK" = "AuthContext" ]; then
            echo "✅ AuthContext CONFIRMED in new bundle!"
            echo ""
            echo "🎉 DEPLOYMENT SUCCESSFUL!"
            echo ""
            echo "Next steps:"
            echo "  1. Open your web app: https://web-production-09493.up.railway.app"
            echo "  2. Do a HARD REFRESH:"
            echo "     • Mac: Cmd + Shift + R"
            echo "     • Windows: Ctrl + Shift + R"
            echo "     • Or right-click refresh button → 'Empty Cache and Hard Reload'"
            echo "  3. You should see the LOGIN PAGE"
            echo "  4. Login with: admin / OwtvQubm2H9BP0qE"
            echo ""
            exit 0
        else
            echo "⚠️  New bundle found but AuthContext missing (unexpected)"
            echo "Bundle: $BUNDLE"
        fi
    else
        echo "⚠️  No bundle found (Railway may be deploying)"
    fi
    
    if [ $i -lt 12 ]; then
        sleep 30
    fi
done

echo ""
echo "⏱️  Deployment taking longer than 6 minutes"
echo ""
echo "Please check your Railway dashboard:"
echo "  • Build Logs: Should show 'npm install' and 'npm run build' output"
echo "  • Deploy Logs: Should show successful deployment"
echo ""
echo "If you see 'cached 0ms' in Build Logs, the cache issue persists."
