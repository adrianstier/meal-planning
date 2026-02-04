#!/bin/bash
# Comprehensive AI Feature Tests

SUPABASE_URL="https://ppeltiyvdigahereijha.supabase.co"
ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBwZWx0aXl2ZGlnYWhlcmVpamhhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwNjcyOTcsImV4cCI6MjA4MTY0MzI5N30.jen78DEurTIUDhiiWzr_zh1izI6OFQaYQprINyiTOkc"

echo "========================================="
echo "AI Feature Comprehensive Tests"
echo "========================================="
echo ""

# Get auth token
echo "1. Authenticating..."
TOKEN=$(curl -s -X POST "$SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"claudetest@mealplanner.dev","password":"ClaudeTest2024"}' | python3 -c "import sys,json; print(json.load(sys.stdin).get('access_token',''))" 2>/dev/null)

if [ -z "$TOKEN" ]; then
  echo "ERROR: Failed to get auth token"
  exit 1
fi
echo "   Token obtained successfully"
echo ""

# Test 1: Parse Recipe from URL (AllRecipes)
echo "========================================="
echo "TEST 1: Parse Recipe from URL (AllRecipes)"
echo "========================================="
echo "URL: https://www.allrecipes.com/recipe/23891/grilled-cheese-sandwich/"
RESULT1=$(curl -s -X POST "$SUPABASE_URL/functions/v1/parse-recipe-url-ai" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3001" \
  -d '{"url":"https://www.allrecipes.com/recipe/23891/grilled-cheese-sandwich/"}' \
  --max-time 90)

echo "$RESULT1" | python3 -c "
import sys,json
try:
    d=json.load(sys.stdin)
    if 'error' in d:
        print(f'   ERROR: {d[\"error\"]}')
    else:
        print(f'   Name: {d.get(\"name\", \"N/A\")}')
        print(f'   Meal Type: {d.get(\"meal_type\", \"N/A\")}')
        print(f'   Servings: {d.get(\"servings\", \"N/A\")}')
        print(f'   Cook Time: {d.get(\"cook_time_minutes\", \"N/A\")} minutes')
        print(f'   Difficulty: {d.get(\"difficulty\", \"N/A\")}')
        ing = d.get('ingredients', '')[:100]
        print(f'   Ingredients preview: {ing}...')
        print('   STATUS: SUCCESS')
except Exception as e:
    print(f'   Parse error: {e}')
" 2>/dev/null || echo "   Parse error"
echo ""

# Test 2: Parse Recipe from URL (Simply Recipes)
echo "========================================="
echo "TEST 2: Parse Recipe from URL (Simply Recipes)"
echo "========================================="
echo "URL: https://www.simplyrecipes.com/recipes/homemade_pizza/"
RESULT2=$(curl -s -X POST "$SUPABASE_URL/functions/v1/parse-recipe-url-ai" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3001" \
  -d '{"url":"https://www.simplyrecipes.com/recipes/homemade_pizza/"}' \
  --max-time 90)

echo "$RESULT2" | python3 -c "
import sys,json
try:
    d=json.load(sys.stdin)
    if 'error' in d:
        print(f'   ERROR: {d[\"error\"]}')
    else:
        print(f'   Name: {d.get(\"name\", \"N/A\")}')
        print(f'   Meal Type: {d.get(\"meal_type\", \"N/A\")}')
        print(f'   Servings: {d.get(\"servings\", \"N/A\")}')
        print(f'   Difficulty: {d.get(\"difficulty\", \"N/A\")}')
        print('   STATUS: SUCCESS')
except Exception as e:
    print(f'   Parse error: {e}')
" 2>/dev/null || echo "   Parse error"
echo ""

# Test 3: Parse Recipe from Text (Beef Tacos)
echo "========================================="
echo "TEST 3: Parse Recipe from Text"
echo "========================================="
echo "Recipe: Classic Beef Tacos"
RESULT3=$(curl -s -X POST "$SUPABASE_URL/functions/v1/parse-recipe" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3001" \
  -d '{
    "text": "Classic Beef Tacos\n\nIngredients:\n- 1 lb ground beef\n- 1 packet taco seasoning\n- 8 taco shells\n- 1 cup shredded lettuce\n- 1 cup shredded cheddar cheese\n- 1/2 cup diced tomatoes\n- 1/4 cup sour cream\n- Salsa to taste\n\nInstructions:\n1. Brown the ground beef in a skillet over medium-high heat.\n2. Drain fat and add taco seasoning with 1/2 cup water.\n3. Simmer 5 minutes until sauce thickens.\n4. Fill shells with beef and toppings.\n\nServes: 4\nPrep: 10 min\nCook: 15 min"
  }' \
  --max-time 60)

echo "$RESULT3" | python3 -c "
import sys,json
try:
    d=json.load(sys.stdin)
    if 'error' in d:
        print(f'   ERROR: {d[\"error\"]}')
    else:
        data = d.get('data', d)
        print(f'   Name: {data.get(\"name\", \"N/A\")}')
        print(f'   Meal Type: {data.get(\"meal_type\", \"N/A\")}')
        print(f'   Servings: {data.get(\"servings\", \"N/A\")}')
        print(f'   Difficulty: {data.get(\"difficulty\", \"N/A\")}')
        print('   STATUS: SUCCESS')
except Exception as e:
    print(f'   Parse error: {e}')
" 2>/dev/null || echo "   Parse error"
echo ""

# Test 4: Parse Recipe from Text (Honey Garlic Salmon)
echo "========================================="
echo "TEST 4: Parse Recipe from Text (with nutrition)"
echo "========================================="
echo "Recipe: Honey Garlic Salmon"
RESULT4=$(curl -s -X POST "$SUPABASE_URL/functions/v1/parse-recipe" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3001" \
  -d '{
    "text": "Honey Garlic Glazed Salmon\n\nIngredients:\n4 salmon fillets (6 oz each)\n1/4 cup honey\n3 tablespoons soy sauce\n4 cloves garlic, minced\n1 tablespoon olive oil\n1 tablespoon lemon juice\n\nDirections:\n1. Preheat oven to 400F.\n2. Mix honey, soy sauce, garlic, and lemon juice.\n3. Season salmon with salt and pepper.\n4. Sear salmon 3 minutes, flip, pour sauce over.\n5. Bake 10-12 minutes.\n\nNutrition: 350 calories, 35g protein, 18g carbs, 12g fat\nDifficulty: Easy\nTime: 25 minutes"
  }' \
  --max-time 60)

echo "$RESULT4" | python3 -c "
import sys,json
try:
    d=json.load(sys.stdin)
    if 'error' in d:
        print(f'   ERROR: {d[\"error\"]}')
    else:
        data = d.get('data', d)
        print(f'   Name: {data.get(\"name\", \"N/A\")}')
        print(f'   Calories: {data.get(\"calories\", \"N/A\")}')
        print(f'   Protein: {data.get(\"protein_g\", \"N/A\")}g')
        print(f'   Carbs: {data.get(\"carbs_g\", \"N/A\")}g')
        print(f'   Fat: {data.get(\"fat_g\", \"N/A\")}g')
        print('   STATUS: SUCCESS')
except Exception as e:
    print(f'   Parse error: {e}')
" 2>/dev/null || echo "   Parse error"
echo ""

# Test 5: Parse Recipe from Image
echo "========================================="
echo "TEST 5: Parse Recipe from Image"
echo "========================================="
echo "Image: recipe-salad.jpg"

# Convert image to base64
IMAGE_PATH="/Users/adrianstier/meal-planning/client/src/tests/test-data/recipe-salad.jpg"
if [ -f "$IMAGE_PATH" ]; then
  IMAGE_BASE64=$(base64 < "$IMAGE_PATH")

  RESULT5=$(curl -s -X POST "$SUPABASE_URL/functions/v1/parse-recipe-image" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -H "Origin: http://localhost:3001" \
    -d "{\"image_data\":\"data:image/jpeg;base64,$IMAGE_BASE64\",\"image_type\":\"image/jpeg\"}" \
    --max-time 90)

  echo "$RESULT5" | python3 -c "
import sys,json
try:
    d=json.load(sys.stdin)
    if 'error' in d:
        print(f'   ERROR: {d[\"error\"]}')
    else:
        print(f'   Name: {d.get(\"name\", \"N/A\")}')
        print(f'   Meal Type: {d.get(\"meal_type\", \"N/A\")}')
        print(f'   Servings: {d.get(\"servings\", \"N/A\")}')
        print(f'   Kid Friendly: {d.get(\"kid_friendly_level\", \"N/A\")}/10')
        ing = d.get('ingredients', '')[:150]
        print(f'   Ingredients: {ing}...')
        print('   STATUS: SUCCESS')
except Exception as e:
    print(f'   Parse error: {e}')
" 2>/dev/null || echo "   Parse error"
else
  echo "   ERROR: Image file not found"
fi
echo ""

echo "========================================="
echo "All AI Feature Tests Complete"
echo "========================================="
