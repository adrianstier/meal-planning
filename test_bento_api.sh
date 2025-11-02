#!/bin/bash

PORT=5001
BASE_URL="http://localhost:${PORT}/api"

echo "========================================="
echo "Testing Bento Box API Endpoints"
echo "========================================="
echo ""

# Test 1: Get empty items list
echo "Test 1: GET /api/bento-items (empty)"
curl -s -X GET "${BASE_URL}/bento-items" | python3 -m json.tool
echo ""
echo ""

# Test 2: Create item with missing name (should fail)
echo "Test 2: POST /api/bento-items (missing name - should fail)"
curl -s -X POST "${BASE_URL}/bento-items" \
  -H "Content-Type: application/json" \
  -d '{"category": "protein"}' | python3 -m json.tool
echo ""
echo ""

# Test 3: Create item with invalid category (should fail)
echo "Test 3: POST /api/bento-items (invalid category - should fail)"
curl -s -X POST "${BASE_URL}/bento-items" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test", "category": "invalid"}' | python3 -m json.tool
echo ""
echo ""

# Test 4: Create valid items
echo "Test 4: POST /api/bento-items (creating 6 valid items)"
curl -s -X POST "${BASE_URL}/bento-items" \
  -H "Content-Type: application/json" \
  -d '{"name": "Turkey roll-ups", "category": "protein", "is_favorite": true, "prep_time_minutes": 5}' | python3 -m json.tool

curl -s -X POST "${BASE_URL}/bento-items" \
  -H "Content-Type: application/json" \
  -d '{"name": "Apple slices", "category": "fruit", "is_favorite": true}' | python3 -m json.tool

curl -s -X POST "${BASE_URL}/bento-items" \
  -H "Content-Type: application/json" \
  -d '{"name": "Carrot sticks", "category": "vegetable"}' | python3 -m json.tool

curl -s -X POST "${BASE_URL}/bento-items" \
  -H "Content-Type: application/json" \
  -d '{"name": "Crackers", "category": "grain"}' | python3 -m json.tool

curl -s -X POST "${BASE_URL}/bento-items" \
  -H "Content-Type: application/json" \
  -d '{"name": "Cheese cubes", "category": "dairy", "allergens": "Contains dairy"}' | python3 -m json.tool

curl -s -X POST "${BASE_URL}/bento-items" \
  -H "Content-Type: application/json" \
  -d '{"name": "Graham crackers", "category": "snack"}' | python3 -m json.tool
echo ""
echo ""

# Test 5: Get items list (should have 6 items)
echo "Test 5: GET /api/bento-items (should have 6 items)"
curl -s -X GET "${BASE_URL}/bento-items" | python3 -m json.tool
echo ""
echo ""

# Test 6: Generate week with insufficient items (should fail if we had only 2 items)
# This should succeed now since we have 6 items
echo "Test 6: POST /api/bento-plans/generate-week"
curl -s -X POST "${BASE_URL}/bento-plans/generate-week" \
  -H "Content-Type: application/json" \
  -d '{"start_date": "2025-11-04", "child_name": "Emma"}' | python3 -m json.tool
echo ""
echo ""

# Test 7: Get all plans
echo "Test 7: GET /api/bento-plans"
curl -s -X GET "${BASE_URL}/bento-plans" | python3 -m json.tool
echo ""
echo ""

echo "========================================="
echo "All Tests Complete!"
echo "========================================="
