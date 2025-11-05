#!/bin/bash
echo "=========================================="
echo "Monitoring Authentication Fix Deployment"
echo "=========================================="
echo "Start time: $(date)"
echo ""
echo "Changes being deployed:"
echo "  • proxy configuration in package.json (for local dev)"
echo "  • withCredentials in axios config (for session cookies)"
echo ""

# Get current bundle to compare
CURRENT_BUNDLE=$(curl -s "https://web-production-09493.up.railway.app/" 2>/dev/null | grep -o 'static/js/main\.[^"]*\.js' | head -1)
echo "Current JS bundle: $CURRENT_BUNDLE"
echo ""

for i in {1..12}; do
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Check $i/12 - $(date +%H:%M:%S)"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    NEW_BUNDLE=$(curl -s "https://web-production-09493.up.railway.app/" 2>/dev/null | grep -o 'static/js/main\.[^"]*\.js' | head -1)
    
    if [ -z "$NEW_BUNDLE" ]; then
        echo "  Status: App not responding (deploying...)"
    elif [ "$NEW_BUNDLE" = "$CURRENT_BUNDLE" ]; then
        echo "  Status: Still old deployment ($CURRENT_BUNDLE)"
    else
        echo "  ✅ NEW DEPLOYMENT DETECTED!"
        echo "  Old bundle: $CURRENT_BUNDLE"
        echo "  New bundle: $NEW_BUNDLE"
        echo ""
        echo "=========================================="
        echo "🎉 AUTHENTICATION FIX DEPLOYED!"
        echo "=========================================="
        echo ""
        echo "The withCredentials fix has been deployed."
        echo "Session cookies should now work correctly in production."
        echo ""
        echo "To test:"
        echo "  1. Visit https://web-production-09493.up.railway.app"
        echo "  2. Login with your credentials"
        echo "  3. Verify meal plans and other pages load correctly"
        echo ""
        exit 0
    fi
    
    if [ $i -lt 12 ]; then
        echo "  Waiting 30 seconds..."
        sleep 30
    fi
done

echo ""
echo "=========================================="
echo "⏱️  Timeout after 6 minutes"
echo "=========================================="
echo "Deployment may still be in progress."
echo "Check Railway dashboard for build status."
