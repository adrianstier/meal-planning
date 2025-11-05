#!/bin/bash
echo "=========================================="
echo "Monitoring Render Password Synchronization"
echo "=========================================="
echo ""
echo "Waiting for Render to detect GitHub push and redeploy..."
echo "This typically takes 2-3 minutes."
echo ""
echo "Changes deployed:"
echo "  • Password reset migration added to setup.py"
echo "  • Admin password will be reset to: OwtvQubm2H9BP0qE"
echo ""
echo "Starting checks in 90 seconds (to allow Render build to start)..."
sleep 90

for i in {1..12}; do
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Check $i/12 - $(date +%H:%M:%S)"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    # Test login with the Railway password
    LOGIN_RESULT=$(curl -s -X POST "https://meal-planning-3xub.onrender.com/api/auth/login" \
      -H "Content-Type: application/json" \
      -d '{"username":"admin","password":"OwtvQubm2H9BP0qE"}' 2>&1)
    
    if echo "$LOGIN_RESULT" | grep -q '"success": true'; then
        echo "✅ PASSWORD SYNC SUCCESSFUL!"
        echo ""
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "🎉 RENDER DEPLOYMENT COMPLETE!"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo ""
        echo "Admin password has been synchronized across both deployments!"
        echo ""
        echo "Login credentials (works on BOTH platforms):"
        echo "  Username: admin"
        echo "  Password: OwtvQubm2H9BP0qE"
        echo ""
        echo "Render URL: https://meal-planning-3xub.onrender.com"
        echo "Railway URL: https://web-production-09493.up.railway.app"
        echo ""
        exit 0
    elif echo "$LOGIN_RESULT" | grep -q '"error": "Invalid username or password"'; then
        echo "⏳ Migration hasn't run yet (password still different)"
    elif echo "$LOGIN_RESULT" | grep -q "Application failed to respond\|timeout\|502\|503"; then
        echo "🔄 Render deployment in progress (app not responding)"
    else
        ERROR=$(echo "$LOGIN_RESULT" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('error', 'Unknown')[:80])" 2>/dev/null || echo "Connection error")
        echo "⚠️  Status: $ERROR"
    fi
    
    if [ $i -lt 12 ]; then
        echo "Waiting 30 seconds before next check..."
        sleep 30
    fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "⏱️  Deployment taking longer than expected"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Possible reasons:"
echo "  • Render build queue is backed up"
echo "  • Render hasn't detected the GitHub push yet"
echo "  • There may be a build error"
echo ""
echo "Check your Render dashboard for deployment status:"
echo "https://dashboard.render.com/"
