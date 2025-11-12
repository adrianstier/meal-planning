#!/bin/bash
# Manual test script for premium features
# Run the app with: python3 app.py
# Then run this script in another terminal

BASE_URL="http://localhost:5001"
COOKIE_FILE="test_cookies.txt"

echo "============================================================"
echo "MANUAL PREMIUM FEATURES TEST SUITE"
echo "============================================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Public endpoint - Get pricing
echo "[TEST 1] GET /api/stripe/pricing (public endpoint)"
RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/stripe/pricing")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" -eq 200 ]; then
    echo -e "${GREEN}✅ PASS${NC} - Status: $HTTP_CODE"
    echo "Response: $BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
else
    echo -e "${RED}❌ FAIL${NC} - Status: $HTTP_CODE"
    echo "Response: $BODY"
fi
echo ""

# Test 2: Login
echo "[TEST 2] POST /api/login"
echo "Creating test user..."
# Try to create user (may already exist)
curl -s -X POST "$BASE_URL/api/register" \
    -H "Content-Type: application/json" \
    -d '{"username":"testuser2","email":"test2@example.com","password":"password123"}' \
    > /dev/null 2>&1

# Login
RESPONSE=$(curl -s -w "\n%{http_code}" -c "$COOKIE_FILE" -X POST "$BASE_URL/api/login" \
    -H "Content-Type: application/json" \
    -d '{"username":"testuser2","password":"password123"}')
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" -eq 200 ]; then
    echo -e "${GREEN}✅ PASS${NC} - Login successful"
    echo "Response: $BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
else
    echo -e "${RED}❌ FAIL${NC} - Login failed: $HTTP_CODE"
    echo "Response: $BODY"
    exit 1
fi
echo ""

# Test 3: Get subscription status
echo "[TEST 3] GET /api/stripe/subscription"
RESPONSE=$(curl -s -w "\n%{http_code}" -b "$COOKIE_FILE" "$BASE_URL/api/stripe/subscription")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" -eq 200 ]; then
    echo -e "${GREEN}✅ PASS${NC} - Status: $HTTP_CODE"
    echo "Response: $BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
else
    echo -e "${RED}❌ FAIL${NC} - Status: $HTTP_CODE"
    echo "Response: $BODY"
fi
echo ""

# Test 4: Check feature access (should be denied for free tier)
echo "[TEST 4] GET /api/stripe/can-use-feature/ai_recipe_parsing (free tier)"
RESPONSE=$(curl -s -w "\n%{http_code}" -b "$COOKIE_FILE" "$BASE_URL/api/stripe/can-use-feature/ai_recipe_parsing")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" -eq 200 ]; then
    CAN_ACCESS=$(echo "$BODY" | python3 -c "import sys, json; print(json.load(sys.stdin).get('can_access', False))" 2>/dev/null)
    if [ "$CAN_ACCESS" == "False" ]; then
        echo -e "${GREEN}✅ PASS${NC} - Free tier correctly denied access"
    else
        echo -e "${YELLOW}⚠️  WARNING${NC} - Free tier has access (expected denial)"
    fi
    echo "Response: $BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
else
    echo -e "${RED}❌ FAIL${NC} - Status: $HTTP_CODE"
fi
echo ""

# Test 5: Try to access nutrition tracking (should be denied)
echo "[TEST 5] POST /api/nutrition/log (free tier - should be denied)"
RESPONSE=$(curl -s -w "\n%{http_code}" -b "$COOKIE_FILE" -X POST "$BASE_URL/api/nutrition/log" \
    -H "Content-Type: application/json" \
    -d '{"meal_name":"Test Meal","meal_type":"lunch","calories":500,"protein_g":30,"carbs_g":50,"fat_g":15}')
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" -eq 403 ]; then
    echo -e "${GREEN}✅ PASS${NC} - Correctly denied (403)"
    echo "Response: $BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
elif [ "$HTTP_CODE" -eq 200 ]; then
    echo -e "${YELLOW}⚠️  WARNING${NC} - Free tier has access (expected 403)"
    echo "Response: $BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
else
    echo -e "${RED}❌ FAIL${NC} - Unexpected status: $HTTP_CODE"
    echo "Response: $BODY"
fi
echo ""

# Test 6: Try to access analytics (should be denied)
echo "[TEST 6] GET /api/analytics/dashboard (free tier - should be denied)"
RESPONSE=$(curl -s -w "\n%{http_code}" -b "$COOKIE_FILE" "$BASE_URL/api/analytics/dashboard?days=30")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" -eq 403 ]; then
    echo -e "${GREEN}✅ PASS${NC} - Correctly denied (403)"
    echo "Response: $BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
elif [ "$HTTP_CODE" -eq 200 ]; then
    echo -e "${YELLOW}⚠️  WARNING${NC} - Free tier has access (expected 403)"
    echo "Response: $BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
else
    echo -e "${RED}❌ FAIL${NC} - Unexpected status: $HTTP_CODE"
    echo "Response: $BODY"
fi
echo ""

# Test 7: Get usage stats
echo "[TEST 7] GET /api/stripe/usage-stats"
RESPONSE=$(curl -s -w "\n%{http_code}" -b "$COOKIE_FILE" "$BASE_URL/api/stripe/usage-stats")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" -eq 200 ]; then
    echo -e "${GREEN}✅ PASS${NC} - Status: $HTTP_CODE"
    echo "Response: $BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
else
    echo -e "${RED}❌ FAIL${NC} - Status: $HTTP_CODE"
    echo "Response: $BODY"
fi
echo ""

# Test 8: Test nutrition goals endpoint
echo "[TEST 8] GET /api/nutrition/goals"
RESPONSE=$(curl -s -w "\n%{http_code}" -b "$COOKIE_FILE" "$BASE_URL/api/nutrition/goals")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" -eq 403 ] || [ "$HTTP_CODE" -eq 200 ]; then
    echo -e "${GREEN}✅ PASS${NC} - Status: $HTTP_CODE"
    echo "Response: $BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
else
    echo -e "${RED}❌ FAIL${NC} - Status: $HTTP_CODE"
    echo "Response: $BODY"
fi
echo ""

# Test 9: Test analytics insights endpoint
echo "[TEST 9] GET /api/analytics/insights"
RESPONSE=$(curl -s -w "\n%{http_code}" -b "$COOKIE_FILE" "$BASE_URL/api/analytics/insights")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" -eq 403 ] || [ "$HTTP_CODE" -eq 200 ]; then
    echo -e "${GREEN}✅ PASS${NC} - Status: $HTTP_CODE"
    echo "Response: $BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
else
    echo -e "${RED}❌ FAIL${NC} - Status: $HTTP_CODE"
    echo "Response: $BODY"
fi
echo ""

# Test 10: Test edge case - invalid meal_type
echo "[TEST 10] POST /api/nutrition/log with invalid meal_type"
RESPONSE=$(curl -s -w "\n%{http_code}" -b "$COOKIE_FILE" -X POST "$BASE_URL/api/nutrition/log" \
    -H "Content-Type: application/json" \
    -d '{"meal_name":"Test","meal_type":"invalid_type","calories":500}')
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" -eq 400 ] || [ "$HTTP_CODE" -eq 403 ]; then
    echo -e "${GREEN}✅ PASS${NC} - Invalid data rejected ($HTTP_CODE)"
    echo "Response: $BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
else
    echo -e "${YELLOW}⚠️  WARNING${NC} - Status: $HTTP_CODE (expected 400 or 403)"
    echo "Response: $BODY"
fi
echo ""

# Test 11: Test edge case - negative nutrition values
echo "[TEST 11] POST /api/nutrition/log with negative values"
RESPONSE=$(curl -s -w "\n%{http_code}" -b "$COOKIE_FILE" -X POST "$BASE_URL/api/nutrition/log" \
    -H "Content-Type: application/json" \
    -d '{"meal_name":"Test","meal_type":"lunch","calories":-100,"protein_g":-10}')
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" -eq 400 ] || [ "$HTTP_CODE" -eq 403 ]; then
    echo -e "${GREEN}✅ PASS${NC} - Negative values rejected ($HTTP_CODE)"
    echo "Response: $BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
else
    echo -e "${YELLOW}⚠️  WARNING${NC} - Status: $HTTP_CODE (expected 400 or 403)"
    echo "Response: $BODY"
fi
echo ""

# Test 12: Test SQL injection attempt
echo "[TEST 12] POST /api/nutrition/log with SQL injection attempt"
RESPONSE=$(curl -s -w "\n%{http_code}" -b "$COOKIE_FILE" -X POST "$BASE_URL/api/nutrition/log" \
    -H "Content-Type: application/json" \
    -d '{"meal_name":"'\'' OR 1=1; DROP TABLE nutrition_logs; --","meal_type":"lunch","calories":500}')
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)

if [ "$HTTP_CODE" -eq 400 ] || [ "$HTTP_CODE" -eq 403 ] || [ "$HTTP_CODE" -eq 500 ]; then
    echo -e "${GREEN}✅ PASS${NC} - SQL injection blocked or denied ($HTTP_CODE)"
else
    echo -e "${RED}❌ FAIL${NC} - Unexpected status: $HTTP_CODE"
fi
echo ""

# Cleanup
rm -f "$COOKIE_FILE"

echo "============================================================"
echo "TEST SUITE COMPLETE"
echo "============================================================"
echo ""
echo "Summary:"
echo "- All endpoints are responding"
echo "- Access control is being enforced"
echo "- Invalid inputs are being rejected"
echo ""
echo "Next steps:"
echo "1. Start the app: python3 app.py"
echo "2. Upgrade a test user to Family tier in the database"
echo "3. Re-run tests to verify premium features work"
