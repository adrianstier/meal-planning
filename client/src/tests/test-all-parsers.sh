#!/bin/bash
# Comprehensive edge function parser test suite
# Tests: parse-recipe-url, parse-recipe-url-ai, parse-recipe (text)
set -euo pipefail

SUPABASE_URL="https://ppeltiyvdigahereijha.supabase.co"
ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBwZWx0aXl2ZGlnYWhlcmVpamhhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwNjcyOTcsImV4cCI6MjA4MTY0MzI5N30.jen78DEurTIUDhiiWzr_zh1izI6OFQaYQprINyiTOkc"

PASS=0
FAIL=0
SKIP=0
RESULTS=""

# Get JWT token
echo "=== Authenticating ==="
TOKEN_RESPONSE=$(curl -s -X POST "${SUPABASE_URL}/auth/v1/token?grant_type=password" \
  -H "apikey: ${ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"email":"claudetest@mealplanner.dev","password":"ClaudeTest2024"}')

ACCESS_TOKEN=$(echo "$TOKEN_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])" 2>/dev/null)

if [ -z "$ACCESS_TOKEN" ]; then
  echo "FATAL: Could not authenticate"
  exit 1
fi
echo "Authenticated OK"
echo ""

# Helper function to call an edge function
call_function() {
  local func_name="$1"
  local body="$2"
  local timeout="${3:-30}"

  curl -s -w "\n__HTTP_STATUS__%{http_code}" \
    -X POST "${SUPABASE_URL}/functions/v1/${func_name}" \
    -H "Authorization: Bearer ${ACCESS_TOKEN}" \
    -H "apikey: ${ANON_KEY}" \
    -H "Content-Type: application/json" \
    -H "X-Requested-With: XMLHttpRequest" \
    -H "Origin: http://localhost:3001" \
    -d "$body" \
    --max-time "$timeout" 2>/dev/null || echo "__HTTP_STATUS__000"
}

# Helper to validate parse-recipe-url response
validate_url_response() {
  local test_name="$1"
  local raw_response="$2"
  local expect_name_contains="$3"

  local http_status=$(echo "$raw_response" | grep "__HTTP_STATUS__" | sed 's/__HTTP_STATUS__//')
  local body=$(echo "$raw_response" | grep -v "__HTTP_STATUS__")

  if [ "$http_status" = "000" ]; then
    echo "  FAIL: ${test_name} — Connection timeout/error"
    FAIL=$((FAIL+1))
    RESULTS="${RESULTS}\nFAIL: ${test_name} — timeout"
    return
  fi

  if [ "$http_status" = "200" ]; then
    local name=$(echo "$body" | python3 -c "import sys,json; print(json.load(sys.stdin).get('name',''))" 2>/dev/null)
    local ingredients_len=$(echo "$body" | python3 -c "import sys,json; print(len(json.load(sys.stdin).get('ingredients','')))" 2>/dev/null)
    local instructions_len=$(echo "$body" | python3 -c "import sys,json; print(len(json.load(sys.stdin).get('instructions','')))" 2>/dev/null)
    local servings=$(echo "$body" | python3 -c "import sys,json; print(json.load(sys.stdin).get('servings','?'))" 2>/dev/null)
    local meal_type=$(echo "$body" | python3 -c "import sys,json; print(json.load(sys.stdin).get('meal_type','?'))" 2>/dev/null)

    if [ -z "$name" ] || [ "$name" = "Untitled Recipe" ]; then
      echo "  FAIL: ${test_name} — Got 200 but name is '${name}'"
      FAIL=$((FAIL+1))
      RESULTS="${RESULTS}\nFAIL: ${test_name} — empty name"
      return
    fi

    if [ "${ingredients_len:-0}" -lt 10 ]; then
      echo "  FAIL: ${test_name} — Ingredients too short (${ingredients_len} chars)"
      FAIL=$((FAIL+1))
      RESULTS="${RESULTS}\nFAIL: ${test_name} — no ingredients"
      return
    fi

    if [ "${instructions_len:-0}" -lt 10 ]; then
      echo "  FAIL: ${test_name} — Instructions too short (${instructions_len} chars)"
      FAIL=$((FAIL+1))
      RESULTS="${RESULTS}\nFAIL: ${test_name} — no instructions"
      return
    fi

    # Check name contains expected substring (case-insensitive)
    if [ -n "$expect_name_contains" ]; then
      local name_lower=$(echo "$name" | tr '[:upper:]' '[:lower:]')
      local expect_lower=$(echo "$expect_name_contains" | tr '[:upper:]' '[:lower:]')
      if [[ "$name_lower" != *"$expect_lower"* ]]; then
        echo "  WARN: ${test_name} — Name '${name}' doesn't contain '${expect_name_contains}'"
      fi
    fi

    echo "  PASS: ${test_name}"
    echo "        Name: ${name} | Servings: ${servings} | Type: ${meal_type}"
    echo "        Ingredients: ${ingredients_len} chars | Instructions: ${instructions_len} chars"
    PASS=$((PASS+1))
    RESULTS="${RESULTS}\nPASS: ${test_name} — ${name}"
  elif [ "$http_status" = "422" ]; then
    local error=$(echo "$body" | python3 -c "import sys,json; print(json.load(sys.stdin).get('error',''))" 2>/dev/null)
    local needs_ai=$(echo "$body" | python3 -c "import sys,json; print(json.load(sys.stdin).get('needsAI',False))" 2>/dev/null)
    echo "  INFO: ${test_name} — 422: ${error} (needsAI=${needs_ai})"
    # 422 with needsAI=True is expected for some sites, not a failure
    if [ "$needs_ai" = "True" ]; then
      echo "        (Expected — site needs AI parser)"
      SKIP=$((SKIP+1))
      RESULTS="${RESULTS}\nSKIP: ${test_name} — needs AI parser"
    else
      FAIL=$((FAIL+1))
      RESULTS="${RESULTS}\nFAIL: ${test_name} — 422: ${error}"
    fi
  elif [ "$http_status" = "429" ]; then
    echo "  SKIP: ${test_name} — Rate limited (429)"
    SKIP=$((SKIP+1))
    RESULTS="${RESULTS}\nSKIP: ${test_name} — rate limited"
  else
    local error=$(echo "$body" | python3 -c "import sys,json; print(json.load(sys.stdin).get('error','unknown'))" 2>/dev/null || echo "unparseable")
    echo "  FAIL: ${test_name} — HTTP ${http_status}: ${error}"
    FAIL=$((FAIL+1))
    RESULTS="${RESULTS}\nFAIL: ${test_name} — HTTP ${http_status}: ${error}"
  fi
}

# Helper to validate parse-recipe-url-ai response (uses temp file to avoid pipe encoding issues)
validate_ai_response() {
  local test_name="$1"
  local func_name="$2"
  local url_json="$3"
  local expect_name_contains="$4"
  local timeout="${5:-60}"

  local tmpfile="/tmp/parser-test-$$.json"
  local http_status=$(curl -s -w "%{http_code}" -o "$tmpfile" \
    -X POST "${SUPABASE_URL}/functions/v1/${func_name}" \
    -H "Authorization: Bearer ${ACCESS_TOKEN}" \
    -H "apikey: ${ANON_KEY}" \
    -H "Content-Type: application/json" \
    -H "X-Requested-With: XMLHttpRequest" \
    -H "Origin: http://localhost:3001" \
    -d "$url_json" \
    --max-time "$timeout" 2>/dev/null || echo "000")

  if [ "$http_status" = "000" ]; then
    echo "  FAIL: ${test_name} — Connection timeout/error"
    FAIL=$((FAIL+1))
    RESULTS="${RESULTS}\nFAIL: ${test_name} — timeout"
    rm -f "$tmpfile"
    return
  fi

  if [ "$http_status" = "429" ]; then
    echo "  SKIP: ${test_name} — Rate limited (429)"
    SKIP=$((SKIP+1))
    RESULTS="${RESULTS}\nSKIP: ${test_name} — rate limited"
    rm -f "$tmpfile"
    return
  fi

  if [ "$http_status" = "200" ]; then
    local result=$(python3 -c "
import json, sys
with open('$tmpfile', 'rb') as f:
    d = json.loads(f.read())
name = d.get('name','')
ing = len(d.get('ingredients',''))
inst = len(d.get('instructions',''))
cal = d.get('calories','?')
kid = d.get('kid_friendly_level','?')
print(f'{name}|{ing}|{inst}|{cal}|{kid}')
" 2>/dev/null)

    local name=$(echo "$result" | cut -d'|' -f1)
    local ingredients_len=$(echo "$result" | cut -d'|' -f2)
    local instructions_len=$(echo "$result" | cut -d'|' -f3)
    local calories=$(echo "$result" | cut -d'|' -f4)
    local kid_friendly=$(echo "$result" | cut -d'|' -f5)

    if [ -z "$name" ] || [ "$name" = "Untitled Recipe" ]; then
      echo "  FAIL: ${test_name} — Got 200 but name is '${name}'"
      FAIL=$((FAIL+1))
      RESULTS="${RESULTS}\nFAIL: ${test_name} — empty name"
      rm -f "$tmpfile"
      return
    fi

    if [ "${ingredients_len:-0}" -lt 10 ]; then
      echo "  FAIL: ${test_name} — Ingredients too short (${ingredients_len} chars)"
      FAIL=$((FAIL+1))
      RESULTS="${RESULTS}\nFAIL: ${test_name} — no ingredients"
      rm -f "$tmpfile"
      return
    fi

    echo "  PASS: ${test_name}"
    echo "        Name: ${name} | Calories: ${calories} | Kid-friendly: ${kid_friendly}/10"
    echo "        Ingredients: ${ingredients_len} chars | Instructions: ${instructions_len} chars"
    PASS=$((PASS+1))
    RESULTS="${RESULTS}\nPASS: ${test_name} — ${name}"
  elif [ "$http_status" = "422" ]; then
    local error=$(python3 -c "
import json
with open('$tmpfile', 'rb') as f:
    d = json.loads(f.read())
print(d.get('error','unknown'))
" 2>/dev/null || echo "unknown")
    echo "  FAIL: ${test_name} — HTTP 422: ${error}"
    FAIL=$((FAIL+1))
    RESULTS="${RESULTS}\nFAIL: ${test_name} — 422: ${error}"
  else
    echo "  FAIL: ${test_name} — HTTP ${http_status}"
    FAIL=$((FAIL+1))
    RESULTS="${RESULTS}\nFAIL: ${test_name} — HTTP ${http_status}"
  fi
  rm -f "$tmpfile"
}

############################################
# TEST SUITE 1: parse-recipe-url (non-AI JSON-LD)
############################################
echo "=========================================="
echo "TEST SUITE 1: parse-recipe-url (JSON-LD)"
echo "=========================================="

# Test 1.1: NYT Cooking (the original failing case — itemListElement edge case)
echo ""
echo "Test 1.1: NYT Cooking (itemListElement edge case)"
resp=$(call_function "parse-recipe-url" '{"url":"https://cooking.nytimes.com/recipes/767821616-chicken-and-white-bean-stew"}')
validate_url_response "1.1 NYT Cooking" "$resp" "chicken"

# Test 1.2: AllRecipes (standard JSON-LD, very common)
echo ""
echo "Test 1.2: AllRecipes (standard JSON-LD)"
resp=$(call_function "parse-recipe-url" '{"url":"https://www.allrecipes.com/recipe/218091/classic-and-simple-meat-lasagna/"}')
validate_url_response "1.2 AllRecipes Lasagna" "$resp" "lasagna"

# Test 1.3: Simply Recipes (popular food blog)
echo ""
echo "Test 1.3: Simply Recipes"
resp=$(call_function "parse-recipe-url" '{"url":"https://www.simplyrecipes.com/recipes/homemade_pizza/"}')
validate_url_response "1.3 Simply Recipes Pizza" "$resp" "pizza"

# Test 1.4: Food Network
echo ""
echo "Test 1.4: Food Network"
resp=$(call_function "parse-recipe-url" '{"url":"https://www.foodnetwork.com/recipes/alton-brown/baked-macaroni-and-cheese-recipe-1939524"}')
validate_url_response "1.4 Food Network Mac & Cheese" "$resp" ""

# Test 1.5: Serious Eats
echo ""
echo "Test 1.5: Serious Eats"
resp=$(call_function "parse-recipe-url" '{"url":"https://www.seriouseats.com/the-best-slow-cooked-bolognese-sauce-recipe"}')
validate_url_response "1.5 Serious Eats Bolognese" "$resp" "bolognese"

# Test 1.6: Bon Appetit (may require AI)
echo ""
echo "Test 1.6: Bon Appetit"
resp=$(call_function "parse-recipe-url" '{"url":"https://www.bonappetit.com/recipe/bas-best-chocolate-chip-cookies"}')
validate_url_response "1.6 Bon Appetit Cookies" "$resp" ""

# Test 1.7: Budget Bytes (WPRM plugin — different JSON-LD structure)
echo ""
echo "Test 1.7: Budget Bytes (WPRM plugin)"
resp=$(call_function "parse-recipe-url" '{"url":"https://www.budgetbytes.com/one-pot-creamy-cajun-chicken-pasta/"}')
validate_url_response "1.7 Budget Bytes Cajun Pasta" "$resp" ""

# Edge cases
echo ""
echo "Test 1.8: Invalid URL"
resp=$(call_function "parse-recipe-url" '{"url":"not-a-url"}')
http_status=$(echo "$resp" | grep "__HTTP_STATUS__" | sed 's/__HTTP_STATUS__//')
if [ "$http_status" = "400" ]; then
  echo "  PASS: 1.8 Invalid URL — correctly rejected (400)"
  PASS=$((PASS+1))
  RESULTS="${RESULTS}\nPASS: 1.8 Invalid URL — rejected"
else
  echo "  FAIL: 1.8 Invalid URL — expected 400, got ${http_status}"
  FAIL=$((FAIL+1))
  RESULTS="${RESULTS}\nFAIL: 1.8 Invalid URL — got ${http_status}"
fi

echo ""
echo "Test 1.9: Non-recipe page"
resp=$(call_function "parse-recipe-url" '{"url":"https://www.google.com"}')
http_status=$(echo "$resp" | grep "__HTTP_STATUS__" | sed 's/__HTTP_STATUS__//')
if [ "$http_status" = "422" ] || [ "$http_status" = "200" ]; then
  echo "  PASS: 1.9 Non-recipe page — handled gracefully (${http_status})"
  PASS=$((PASS+1))
  RESULTS="${RESULTS}\nPASS: 1.9 Non-recipe — handled"
else
  echo "  FAIL: 1.9 Non-recipe page — unexpected ${http_status}"
  FAIL=$((FAIL+1))
  RESULTS="${RESULTS}\nFAIL: 1.9 Non-recipe — ${http_status}"
fi

echo ""
echo "Test 1.10: Private/internal URL (SSRF check)"
resp=$(call_function "parse-recipe-url" '{"url":"http://169.254.169.254/latest/meta-data/"}')
http_status=$(echo "$resp" | grep "__HTTP_STATUS__" | sed 's/__HTTP_STATUS__//')
if [ "$http_status" = "400" ]; then
  echo "  PASS: 1.10 SSRF blocked — correctly rejected (400)"
  PASS=$((PASS+1))
  RESULTS="${RESULTS}\nPASS: 1.10 SSRF blocked"
else
  echo "  FAIL: 1.10 SSRF — expected 400, got ${http_status}"
  FAIL=$((FAIL+1))
  RESULTS="${RESULTS}\nFAIL: 1.10 SSRF — got ${http_status}"
fi

echo ""
echo "Test 1.11: Missing URL field"
resp=$(call_function "parse-recipe-url" '{"not_url":"test"}')
http_status=$(echo "$resp" | grep "__HTTP_STATUS__" | sed 's/__HTTP_STATUS__//')
if [ "$http_status" = "400" ]; then
  echo "  PASS: 1.11 Missing URL — correctly rejected (400)"
  PASS=$((PASS+1))
  RESULTS="${RESULTS}\nPASS: 1.11 Missing URL — rejected"
else
  echo "  FAIL: 1.11 Missing URL — expected 400, got ${http_status}"
  FAIL=$((FAIL+1))
  RESULTS="${RESULTS}\nFAIL: 1.11 Missing URL — got ${http_status}"
fi

############################################
# TEST SUITE 2: parse-recipe-url-ai (AI parser)
############################################
echo ""
echo "=========================================="
echo "TEST SUITE 2: parse-recipe-url-ai (AI)"
echo "=========================================="

# Test 2.1: NYT Cooking via AI parser
echo ""
echo "Test 2.1: NYT Cooking via AI"
validate_ai_response "2.1 NYT AI" "parse-recipe-url-ai" '{"url":"https://cooking.nytimes.com/recipes/767821616-chicken-and-white-bean-stew"}' "chicken" 90

# Test 2.2: AllRecipes via AI (blocked by direct fetch, uses Jina)
echo ""
echo "Test 2.2: AllRecipes via AI"
validate_ai_response "2.2 AllRecipes AI" "parse-recipe-url-ai" '{"url":"https://www.allrecipes.com/recipe/218091/classic-and-simple-meat-lasagna/"}' "lasagna" 90

# Test 2.3: Simply Recipes via AI (blocked by direct fetch, uses Jina)
echo ""
echo "Test 2.3: Simply Recipes via AI"
validate_ai_response "2.3 Simply Recipes AI" "parse-recipe-url-ai" '{"url":"https://www.simplyrecipes.com/recipes/homemade_pizza/"}' "pizza" 90

# Test 2.4: Serious Eats via AI
echo ""
echo "Test 2.4: Serious Eats via AI"
validate_ai_response "2.4 Serious Eats AI" "parse-recipe-url-ai" '{"url":"https://www.seriouseats.com/the-best-slow-cooked-bolognese-sauce-recipe"}' "bolognese" 90

# Test 2.5: Taste of Home via AI
echo ""
echo "Test 2.5: Taste of Home via AI"
validate_ai_response "2.5 Taste of Home AI" "parse-recipe-url-ai" '{"url":"https://www.tasteofhome.com/recipes/the-best-ever-chili/"}' "chili" 90

############################################
# TEST SUITE 3: parse-recipe (plain text)
############################################
echo ""
echo "=========================================="
echo "TEST SUITE 3: parse-recipe (text input)"
echo "=========================================="

# Test 3.1: Well-formatted recipe text
echo ""
echo "Test 3.1: Well-formatted recipe text"
validate_ai_response "3.1 Text: Pancakes" "parse-recipe" '{
  "recipe_text": "Classic Pancakes\n\nServings: 4\nPrep time: 5 minutes\nCook time: 15 minutes\n\nIngredients:\n- 1 1/2 cups all-purpose flour\n- 3 1/2 tsp baking powder\n- 1 tbsp sugar\n- 1/4 tsp salt\n- 1 1/4 cups milk\n- 1 egg\n- 3 tbsp melted butter\n\nInstructions:\n1. Mix dry ingredients in a bowl\n2. Make a well in center, pour in wet ingredients\n3. Mix until smooth\n4. Heat a griddle over medium-high heat\n5. Pour batter onto griddle, cook until bubbles form\n6. Flip and cook until golden brown"
}' "pancake" 45

# Test 3.2: Minimal/messy recipe text
echo ""
echo "Test 3.2: Minimal messy recipe text"
validate_ai_response "3.2 Text: Garlic Bread (messy)" "parse-recipe" '{
  "recipe_text": "Garlic bread - take a baguette cut it open spread butter mixed with minced garlic and parsley on both halves. broil 3 min until golden. serves 4."
}' "" 45

# Test 3.3: Recipe with source_url
echo ""
echo "Test 3.3: Text with source URL"
validate_ai_response "3.3 Text: Overnight Oats" "parse-recipe" '{
  "recipe_text": "Overnight Oats\n\n1/2 cup rolled oats\n1/2 cup milk\n1/4 cup yogurt\n1 tbsp honey\nFresh berries\n\nCombine oats, milk, yogurt, and honey in a jar. Refrigerate overnight. Top with berries in the morning.",
  "source_url": "https://example.com/overnight-oats"
}' "oat" 45

# Test 3.4: Missing recipe_text
echo ""
echo "Test 3.4: Missing recipe_text field"
resp=$(call_function "parse-recipe" '{"text": "should fail because wrong field name"}')
http_status=$(echo "$resp" | grep "__HTTP_STATUS__" | sed 's/__HTTP_STATUS__//')
if [ "$http_status" = "400" ]; then
  echo "  PASS: 3.4 Missing recipe_text — correctly rejected (400)"
  PASS=$((PASS+1))
  RESULTS="${RESULTS}\nPASS: 3.4 Missing field — rejected"
else
  echo "  FAIL: 3.4 Missing recipe_text — expected 400, got ${http_status}"
  FAIL=$((FAIL+1))
  RESULTS="${RESULTS}\nFAIL: 3.4 Missing field — got ${http_status}"
fi

# Test 3.5: Empty recipe text
echo ""
echo "Test 3.5: Empty recipe_text"
resp=$(call_function "parse-recipe" '{"recipe_text": ""}')
http_status=$(echo "$resp" | grep "__HTTP_STATUS__" | sed 's/__HTTP_STATUS__//')
if [ "$http_status" = "400" ]; then
  echo "  PASS: 3.5 Empty text — correctly rejected (400)"
  PASS=$((PASS+1))
  RESULTS="${RESULTS}\nPASS: 3.5 Empty text — rejected"
else
  echo "  FAIL: 3.5 Empty text — expected 400, got ${http_status}"
  FAIL=$((FAIL+1))
  RESULTS="${RESULTS}\nFAIL: 3.5 Empty text — got ${http_status}"
fi

############################################
# TEST SUITE 4: Security edge cases
############################################
echo ""
echo "=========================================="
echo "TEST SUITE 4: Security edge cases"
echo "=========================================="

# Test 4.1: Missing CSRF header
echo ""
echo "Test 4.1: Missing CSRF header"
resp=$(curl -s -w "\n__HTTP_STATUS__%{http_code}" \
  -X POST "${SUPABASE_URL}/functions/v1/parse-recipe-url" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "apikey: ${ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.allrecipes.com/recipe/218091/classic-and-simple-meat-lasagna/"}' \
  --max-time 10 2>/dev/null || echo "__HTTP_STATUS__000")
http_status=$(echo "$resp" | grep "__HTTP_STATUS__" | sed 's/__HTTP_STATUS__//')
if [ "$http_status" = "403" ]; then
  echo "  PASS: 4.1 Missing CSRF — correctly rejected (403)"
  PASS=$((PASS+1))
  RESULTS="${RESULTS}\nPASS: 4.1 CSRF enforced"
else
  echo "  FAIL: 4.1 Missing CSRF — expected 403, got ${http_status}"
  FAIL=$((FAIL+1))
  RESULTS="${RESULTS}\nFAIL: 4.1 CSRF — got ${http_status}"
fi

# Test 4.2: Missing auth token
echo ""
echo "Test 4.2: Missing auth token"
resp=$(curl -s -w "\n__HTTP_STATUS__%{http_code}" \
  -X POST "${SUPABASE_URL}/functions/v1/parse-recipe-url" \
  -H "apikey: ${ANON_KEY}" \
  -H "Content-Type: application/json" \
  -H "X-Requested-With: XMLHttpRequest" \
  -d '{"url":"https://www.allrecipes.com/recipe/218091/classic-and-simple-meat-lasagna/"}' \
  --max-time 10 2>/dev/null || echo "__HTTP_STATUS__000")
http_status=$(echo "$resp" | grep "__HTTP_STATUS__" | sed 's/__HTTP_STATUS__//')
if [ "$http_status" = "401" ]; then
  echo "  PASS: 4.2 Missing auth — correctly rejected (401)"
  PASS=$((PASS+1))
  RESULTS="${RESULTS}\nPASS: 4.2 Auth enforced"
else
  echo "  FAIL: 4.2 Missing auth — expected 401, got ${http_status}"
  FAIL=$((FAIL+1))
  RESULTS="${RESULTS}\nFAIL: 4.2 Auth — got ${http_status}"
fi

# Test 4.3: localhost SSRF attempt
echo ""
echo "Test 4.3: localhost SSRF"
resp=$(call_function "parse-recipe-url" '{"url":"http://localhost:8080/admin"}')
http_status=$(echo "$resp" | grep "__HTTP_STATUS__" | sed 's/__HTTP_STATUS__//')
if [ "$http_status" = "400" ]; then
  echo "  PASS: 4.3 localhost SSRF — correctly blocked (400)"
  PASS=$((PASS+1))
  RESULTS="${RESULTS}\nPASS: 4.3 localhost SSRF blocked"
else
  echo "  FAIL: 4.3 localhost SSRF — expected 400, got ${http_status}"
  FAIL=$((FAIL+1))
  RESULTS="${RESULTS}\nFAIL: 4.3 localhost SSRF — got ${http_status}"
fi

# Test 4.4: 10.x.x.x SSRF attempt
echo ""
echo "Test 4.4: Private IP SSRF"
resp=$(call_function "parse-recipe-url" '{"url":"http://10.0.0.1/secrets"}')
http_status=$(echo "$resp" | grep "__HTTP_STATUS__" | sed 's/__HTTP_STATUS__//')
if [ "$http_status" = "400" ]; then
  echo "  PASS: 4.4 Private IP SSRF — correctly blocked (400)"
  PASS=$((PASS+1))
  RESULTS="${RESULTS}\nPASS: 4.4 Private IP SSRF blocked"
else
  echo "  FAIL: 4.4 Private IP SSRF — expected 400, got ${http_status}"
  FAIL=$((FAIL+1))
  RESULTS="${RESULTS}\nFAIL: 4.4 Private IP SSRF — got ${http_status}"
fi

############################################
# SUMMARY
############################################
echo ""
echo "=========================================="
echo "RESULTS SUMMARY"
echo "=========================================="
echo "PASS: ${PASS}"
echo "FAIL: ${FAIL}"
echo "SKIP: ${SKIP}"
echo "TOTAL: $((PASS+FAIL+SKIP))"
echo ""
echo "Details:"
echo -e "$RESULTS"
echo ""

if [ "$FAIL" -gt 0 ]; then
  echo "!!! SOME TESTS FAILED !!!"
  exit 1
else
  echo "All tests passed (${SKIP} skipped due to rate limiting or expected AI fallback)."
fi
