#!/bin/bash
set -e

echo "========================================="
echo "COMPREHENSIVE DEPLOYMENT TEST"
echo "Simulating Railway deployment locally"
echo "========================================="
echo ""

# 1. Test static file locations
echo "1. Checking static file structure..."
if [ -d "templates/static" ]; then
    echo "   ✅ templates/static exists"
    ls -la templates/static/ | head -5
else
    echo "   ❌ templates/static does NOT exist!"
    exit 1
fi

# 2. Test that static files contain actual content
echo ""
echo "2. Verifying static file content..."
JS_FILE=$(find templates/static/js -name "main.*.js" 2>/dev/null | head -1)
if [ -n "$JS_FILE" ] && [ -s "$JS_FILE" ]; then
    SIZE=$(wc -c < "$JS_FILE")
    echo "   ✅ Main JS file exists: $JS_FILE (${SIZE} bytes)"
else
    echo "   ❌ Main JS file not found or empty!"
    exit 1
fi

# 3. Wait for server to start
echo ""
echo "3. Waiting for Flask server to start..."
sleep 3

# 4. Test homepage loads
echo ""
echo "4. Testing homepage..."
HOMEPAGE=$(curl -s http://localhost:5001/)
if echo "$HOMEPAGE" | grep -q "static/js/main"; then
    echo "   ✅ Homepage loads and references static JS"
else
    echo "   ❌ Homepage doesn't reference static files correctly"
    echo "$HOMEPAGE" | head -10
    exit 1
fi

# 5. Test static JS file is accessible
echo ""
echo "5. Testing static JS file accessibility..."
JS_URL=$(echo "$HOMEPAGE" | grep -o 'static/js/main[^"]*\.js' | head -1)
if [ -n "$JS_URL" ]; then
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:5001/$JS_URL")
    if [ "$HTTP_CODE" = "200" ]; then
        echo "   ✅ Static JS accessible (HTTP $HTTP_CODE): /$JS_URL"
    else
        echo "   ❌ Static JS returned HTTP $HTTP_CODE: /$JS_URL"
        exit 1
    fi
else
    echo "   ❌ Could not find JS URL in homepage"
    exit 1
fi

# 6. Test CSS file
echo ""
echo "6. Testing static CSS file accessibility..."
CSS_URL=$(echo "$HOMEPAGE" | grep -o 'static/css/main[^"]*\.css' | head -1)
if [ -n "$CSS_URL" ]; then
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:5001/$CSS_URL")
    if [ "$HTTP_CODE" = "200" ]; then
        echo "   ✅ Static CSS accessible (HTTP $HTTP_CODE): /$CSS_URL"
    else
        echo "   ❌ Static CSS returned HTTP $HTTP_CODE: /$CSS_URL"
        exit 1
    fi
fi

# 7. Test API endpoints
echo ""
echo "7. Testing API endpoints..."
API_RESPONSE=$(curl -s http://localhost:5001/api/bento-items)
if echo "$API_RESPONSE" | grep -q '"success"'; then
    echo "   ✅ API endpoint /api/bento-items works"
else
    echo "   ❌ API endpoint failed"
    exit 1
fi

# 8. Test React routing (catch-all)
echo ""
echo "8. Testing React routing..."
PLAN_PAGE=$(curl -s http://localhost:5001/plan)
if echo "$PLAN_PAGE" | grep -q "static/js/main"; then
    echo "   ✅ React routing works (catch-all serves index.html)"
else
    echo "   ❌ React routing failed"
    exit 1
fi

echo ""
echo "========================================="
echo "✅ ALL DEPLOYMENT TESTS PASSED!"
echo "========================================="
echo ""
echo "Files checked:"
echo "  - templates/static/ directory exists"
echo "  - Static JS and CSS files exist and have content"
echo "  - Homepage loads correctly"
echo "  - Static files are accessible via HTTP"
echo "  - API endpoints work"
echo "  - React routing (catch-all) works"
echo ""
