#!/bin/bash
echo "=========================================="
echo "Monitoring Bento Integration Deployment"
echo "=========================================="
echo "Start time: $(date)"
echo ""
echo "Changes being deployed:"
echo "  • Quick Add feature for Bento page (70+ items)"
echo "  • Bento generation integration in meal plan"
echo "  • Backend support for generating bentos with meal plans"
echo ""

CURRENT_BUNDLE=$(curl -s "https://web-production-09493.up.railway.app/" | grep -o 'static/js/main\.[^"]*\.js' | head -1)
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
        echo "🎉 BENTO INTEGRATION DEPLOYED!"
        echo "=========================================="
        echo ""
        echo "New features available:"
        echo "  1. Bento Page: Quick Add section with 70+ common items"
        echo "  2. Meal Plan Page: Checkbox to generate bentos alongside meals"
        echo "  3. Backend: Automatic bento generation for weekdays"
        echo ""
        echo "To use:"
        echo "  • Visit the Bento page to quickly add lunch items"
        echo "  • Generate a meal plan and check 'Generate bento box lunches'"
        echo "  • Optionally add child's name for bento plans"
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
echo "Check Railway dashboard for build logs."
