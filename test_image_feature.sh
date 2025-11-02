#!/bin/bash

echo "=================================="
echo "Recipe Image Feature Test Suite"
echo "=================================="
echo ""

BASE_URL="https://web-production-09493.up.railway.app"
RECIPE_URL="https://www.allrecipes.com/recipe/10813/best-chocolate-chip-cookies/"

echo "Test 1: Parse Recipe from URL"
echo "------------------------------"
PARSE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/meals/parse" \
  -H "Content-Type: application/json" \
  -d "{\"recipe_text\": \"$RECIPE_URL\"}")

echo "Response:"
echo "$PARSE_RESPONSE" | python3 -m json.tool

IMAGE_URL=$(echo "$PARSE_RESPONSE" | python3 -c "import json,sys; data=json.load(sys.stdin); print(data.get('data',{}).get('image_url','NONE'))")
SOURCE_URL=$(echo "$PARSE_RESPONSE" | python3 -c "import json,sys; data=json.load(sys.stdin); print(data.get('data',{}).get('source_url','NONE'))")

echo ""
echo "Extracted Data:"
echo "  Image URL: $IMAGE_URL"
echo "  Source URL: $SOURCE_URL"
echo ""

if [ "$IMAGE_URL" = "NONE" ]; then
    echo "❌ FAIL: No image_url returned"
    exit 1
else
    echo "✅ PASS: image_url returned"
fi

echo ""
echo "Test 2: Check if Image File Exists"
echo "-----------------------------------"
if [ "$IMAGE_URL" != "NONE" ]; then
    IMAGE_STATUS=$(curl -s -I "$BASE_URL$IMAGE_URL" | head -1)
    echo "Image status: $IMAGE_STATUS"
    
    if echo "$IMAGE_STATUS" | grep -q "200"; then
        echo "✅ PASS: Image accessible"
        
        # Get image size
        IMAGE_SIZE=$(curl -s -I "$BASE_URL$IMAGE_URL" | grep -i content-length | awk '{print $2}' | tr -d '\r')
        echo "  Image size: $IMAGE_SIZE bytes"
    else
        echo "❌ FAIL: Image not accessible"
    fi
else
    echo "⏭️  SKIP: No image URL to test"
fi

echo ""
echo "Test 3: Save Recipe via API"
echo "----------------------------"
MEAL_DATA=$(echo "$PARSE_RESPONSE" | python3 -c "
import json, sys
data = json.load(sys.stdin)['data']
meal = {
    'name': data.get('name'),
    'meal_type': 'snack',
    'cook_time_minutes': data.get('cook_time_minutes'),
    'servings': data.get('servings'),
    'difficulty': 'easy',
    'tags': data.get('tags'),
    'ingredients': data.get('ingredients'),
    'instructions': data.get('instructions'),
    'image_url': data.get('image_url'),
    'source_url': data.get('source_url'),
    'cuisine': data.get('cuisine')
}
print(json.dumps(meal))
")

echo "Saving meal with data:"
echo "$MEAL_DATA" | python3 -m json.tool

SAVE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/meals" \
  -H "Content-Type: application/json" \
  -d "$MEAL_DATA")

echo ""
echo "Save response:"
echo "$SAVE_RESPONSE" | python3 -m json.tool

MEAL_ID=$(echo "$SAVE_RESPONSE" | python3 -c "import json,sys; data=json.load(sys.stdin); print(data.get('data',{}).get('id','NONE'))" 2>/dev/null)

if [ "$MEAL_ID" != "NONE" ] && [ -n "$MEAL_ID" ]; then
    echo "✅ PASS: Meal saved with ID: $MEAL_ID"
else
    echo "❌ FAIL: Meal not saved"
    exit 1
fi

echo ""
echo "Test 4: Retrieve Saved Meal"
echo "---------------------------"
MEAL_RESPONSE=$(curl -s "$BASE_URL/api/meals/$MEAL_ID")
echo "$MEAL_RESPONSE" | python3 -m json.tool

SAVED_IMAGE=$(echo "$MEAL_RESPONSE" | python3 -c "import json,sys; data=json.load(sys.stdin); print(data.get('data',data).get('image_url','NONE'))" 2>/dev/null)
SAVED_SOURCE=$(echo "$MEAL_RESPONSE" | python3 -c "import json,sys; data=json.load(sys.stdin); print(data.get('data',data).get('source_url','NONE'))" 2>/dev/null)

echo ""
echo "Retrieved Data:"
echo "  Image URL: $SAVED_IMAGE"
echo "  Source URL: $SAVED_SOURCE"

if [ "$SAVED_IMAGE" = "$IMAGE_URL" ]; then
    echo "✅ PASS: Image URL preserved"
else
    echo "❌ FAIL: Image URL changed or lost"
fi

if [ "$SAVED_SOURCE" = "$SOURCE_URL" ]; then
    echo "✅ PASS: Source URL preserved"
else
    echo "❌ FAIL: Source URL changed or lost"
fi

echo ""
echo "Test 5: Check All Meals Endpoint"
echo "---------------------------------"
ALL_MEALS=$(curl -s "$BASE_URL/api/meals")
MEAL_IN_LIST=$(echo "$ALL_MEALS" | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    meals = data.get('data', data) if isinstance(data, dict) else data
    for meal in meals:
        if meal.get('id') == $MEAL_ID:
            print('FOUND')
            print('Image:', meal.get('image_url'))
            print('Source:', meal.get('source_url'))
            break
    else:
        print('NOT_FOUND')
except Exception as e:
    print('ERROR:', e)
")

echo "$MEAL_IN_LIST"

if echo "$MEAL_IN_LIST" | grep -q "FOUND"; then
    echo "✅ PASS: Meal appears in list with metadata"
else
    echo "❌ FAIL: Meal not in list or missing metadata"
fi

echo ""
echo "=================================="
echo "Test Suite Complete"
echo "=================================="
