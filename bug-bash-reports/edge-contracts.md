# Edge Function Contracts -- Bug Bash Report

**Agent**: API Contract Tester (Wave 4)
**Date**: 2026-02-09
**Build Status**: Clean (0 warnings, 0 errors)

## Contract Verification

| # | Function | Client->Server | Server->Client | Status |
|---|----------|---------------|---------------|--------|
| 1 | `parse-recipe` | Client sends `{ recipe_text }`, edge reads `body.recipe_text` | Edge returns flat `ParsedRecipe` object, client expects `Meal` -- compatible fields | OK |
| 2 | `parse-recipe-url` | Client sends `{ url }`, edge reads `body.url` | Edge returns flat `ParsedRecipe` object, client expects `Meal` -- compatible fields | OK |
| 3 | `parse-recipe-url-ai` | Client sends `{ url }`, edge reads `body.url` | Edge returns flat `ParsedRecipe` with nutrition fields, client expects `Meal` -- compatible | OK |
| 4 | `parse-recipe-image` | Client sends `{ image_data, image_type }`, edge reads `{ image_data, image_type }` | Edge returns flat `ParsedRecipe`, client expects `Meal` -- compatible | OK |
| 5 | `suggest-meal` | Client was sending `meal_type` but edge reads `mealType` | Edge returns `{ suggestions }` but client expected raw `Meal[]` | **FIXED** |
| 6 | `generate-shopping-list` | N/A -- not called from client | N/A | Dead endpoint |
| 7 | `parse-school-menu` | Client sends `{ image_data, image_type }`, edge reads `{ url, menuText, image_data, image_type }` -- OK (only image path used) | Edge returns `ParsedSchoolMenu`, client transforms correctly | OK |
| 8 | `scrape-restaurant-url` | Client sends `{ url }`, edge reads `body.url` | Edge returns `ParsedRestaurantMenu` but client expected `Partial<Restaurant>` -- different field names | **FIXED** |
| 9 | `suggest-restaurant` | Client was spreading `RestaurantFilters` (snake_case) but edge reads `cuisinePreferences`, `hasKids` (camelCase) | Edge returns `{ suggestions }` but client expected `Restaurant[]` | **FIXED** |
| 10 | `leftover-suggestions` | Client sends `{ originalMeal, leftoverIngredients, availableTime, servingsNeeded }` -- matches | Edge returns `{ suggestions: LeftoverIdea[] }` but client `LeftoverSuggestion` type had different fields | **FIXED** |
| 11 | `lunch-alternatives` | Client was sending `{ date }` but edge expects `{ schoolMeal }` | Edge returns `{ alternatives }` but client expected `LunchAlternative` with different schema | **FIXED** |
| 12 | `agent` | Client sends `{ message, conversationId, metadata }`, edge reads same fields | Edge returns `{ success, message, conversationId, executionTimeMs, data }`, client `AgentResponse` matches | OK |

## Bugs Fixed

| # | File:Line | Severity | Description | Fix Applied |
|---|-----------|----------|-------------|-------------|
| 1 | `client/src/lib/api.ts:1042` | **Critical** | `suggest-meal`: Client sent `meal_type` (snake_case) but edge function reads `mealType` (camelCase). AI suggestions would always use default "dinner" regardless of what type was requested. | Changed client to send `mealType` to match edge function parameter name. |
| 2 | `client/src/lib/api.ts:1042` | **Critical** | `suggest-meal`: Client typed return as `Meal[]` but edge function returns `{ suggestions: MealSuggestion[] }`. The `data` variable would have the `suggestions` wrapper, causing undefined/null meal objects downstream. | Added proper type for `{ suggestions: [...] }` wrapper and mapped suggestion objects to `Meal`-like format. |
| 3 | `client/src/lib/api.ts:1443` | **Critical** | `lunch-alternatives`: Client sent `{ date }` but edge function expects `{ schoolMeal, ... }`. The `schoolMeal` field would be empty string (default), giving generic AI responses unrelated to the actual school menu. | Added pre-fetch of school menu items for the date, then passes `schoolMeal` name to edge function. |
| 4 | `client/src/lib/api.ts:1443` | **High** | `lunch-alternatives`: Client expected `LunchAlternative` type (with `school_menu`, `needs_alternative`, `available_leftovers`, `quick_lunch_options`, `recommendation`) but edge function returns `{ alternatives: Array<{name, description, type, ...}> }`. Complete type mismatch. | Added response transformation to construct proper `LunchAlternative` object from edge function response. |
| 5 | `client/src/lib/api.ts:2027` | **High** | `suggest-restaurant`: Client spread `RestaurantFilters` object (snake_case: `cuisine_type`, `kid_friendly`, `price_range`) but edge function reads camelCase: `cuisinePreferences[]`, `hasKids`, `priceRange`. All filter parameters were being ignored. | Mapped `RestaurantFilters` fields to edge function's expected parameter names. |
| 6 | `client/src/lib/api.ts:2027` | **High** | `suggest-restaurant`: Client typed return as `Restaurant[]` but edge function returns `{ suggestions: RestaurantSuggestion[] }`. The `data` would be the wrapper object, not an array. | Added proper response type and mapped `RestaurantSuggestion` objects to `Partial<Restaurant>` format. |
| 7 | `client/src/lib/api.ts:1294` | **Medium** | `leftover-suggestions`: Client expected `LeftoverSuggestion` fields (`meal_id`, `meal_name`, `suggestion`, `servings_remaining`, `days_until_expiry`) but edge function returns `LeftoverIdea` fields (`name`, `description`, `transformationType`, `additionalIngredients`, `instructions`, `estimatedTime`). UI would show undefined values. | Added mapping from `LeftoverIdea` to `LeftoverSuggestion` format, combining description/instructions/ingredients into the `suggestion` text field. |
| 8 | `client/src/lib/api.ts:2126` | **Medium** | `scrape-restaurant-url`: Client expected `Partial<Restaurant>` (with `name`, `cuisine_type`, `address`) but edge function returns `ParsedRestaurantMenu` (with `restaurantName`, `cuisine`, `menuSections`). Field names completely different. | Added response transformation to map `ParsedRestaurantMenu` fields to `Restaurant` format. |

## Dead Endpoints (never called from client)

| # | Function | Notes |
|---|----------|-------|
| 1 | `generate-shopping-list` | Edge function exists but no client code calls it. The client's `shoppingApi.generateFromPlan()` does ingredient extraction locally in the browser (parsing meal ingredients text, categorizing, and inserting directly to `shopping_items`). The edge function does the same thing but with AI-powered consolidation. The client-side implementation is functional but less intelligent. |
| 2 | `scrape-restaurant` (no `-url`) | Client calls `invokeWithTimeout('scrape-restaurant', ...)` at line 2117 but **no edge function directory exists** for `scrape-restaurant`. Only `scrape-restaurant-url` exists. This call will always fail with a 404. |
| 3 | `search-restaurant` | Client calls `invokeWithTimeout('search-restaurant', ...)` at line 2107 but **no edge function directory exists** for `search-restaurant`. This call will always fail with a 404. |
| 4 | `geocode-address` | Client calls `invokeWithTimeout('geocode-address', ...)` at line 2137 but **no edge function directory exists** for `geocode-address`. This call will always fail with a 404. |

## Detailed Analysis

### 1. parse-recipe -- OK
- **Client sends**: `{ recipe_text: text.trim() }` (line 674)
- **Edge reads**: `body.recipe_text` (line 165)
- **Edge returns**: Flat `ParsedRecipe` object with all meal fields
- **Client expects**: `Meal` type -- fields are compatible (both have `name`, `meal_type`, `ingredients`, etc.)
- **Verdict**: Contract matches.

### 2. parse-recipe-url -- OK
- **Client sends**: `{ url }` (line 759)
- **Edge reads**: `body.url` (line 276)
- **Edge returns**: Flat `ParsedRecipe` with `source_url` and `image_url`
- **Client expects**: `Meal` type -- compatible
- **Edge error path**: Returns `{ needsAI: true }` on 422 when no JSON-LD found; client correctly detects this flag via `edgeError.responseBody?.needsAI` (line 775)
- **Note**: The `errorResponse()` helper spreads `extra` into the error JSON, so `{ error: "...", needsAI: true, message: "..." }` is returned. However, the client reads `edgeError.responseBody?.needsAI` -- the `directEdgeFunctionFetch` function only sets `data` from `response.json()` on success, and on non-ok responses it reads `errorText` and tries `JSON.parse(errorText)` but only extracts `errorJson.error`. The `needsAI` flag in the response body is **not** preserved in `edgeError.responseBody` because `directEdgeFunctionFetch` doesn't populate `responseBody`. The `needsAI` detection path (line 775) will never trigger. However, this is a pre-existing issue outside the scope of field-name contract testing.
- **Verdict**: Field names match. The needsAI flag propagation is a separate concern.

### 3. parse-recipe-url-ai -- OK
- **Client sends**: `{ url }` (line 802)
- **Edge reads**: `body.url` (line 283)
- **Edge returns**: `ParsedRecipe` with nutrition fields + `source_url` + `image_url`
- **Client expects**: `Meal` type -- compatible
- **Verdict**: Contract matches.

### 4. parse-recipe-image -- OK
- **Client sends**: `{ image_data: base64, image_type: imageFile.type }` (line 736-738)
- **Edge reads**: `{ image_data, image_type }` (line 71)
- **Edge handles data URL prefix**: Both client and edge strip `data:` prefix (client at line 1470-1475, edge at line 95-101)
- **Edge returns**: `ParsedRecipe` with nutrition
- **Client expects**: `Meal` -- compatible
- **Verdict**: Contract matches.

### 5. suggest-meal -- FIXED (2 bugs)
- **Client was sending**: `{ date, meal_type: mealType, ...constraints }` (snake_case `meal_type`)
- **Edge reads**: `body.mealType` (camelCase, line 121) -- defaults to `"dinner"` when undefined
- **Impact**: Suggestions always defaulted to dinner regardless of requested type
- **Client expected**: `Meal[]`
- **Edge returns**: `{ suggestions: MealSuggestion[] }` (wrapped in object)
- **Impact**: Client would receive `{ suggestions: [...] }` as `data`, cast to `Meal[]`, resulting in undefined meal properties
- **Fix**: Changed client to send `mealType` and handle `{ suggestions }` wrapper

### 6. generate-shopping-list -- Dead
- No calls from client code to `generate-shopping-list`
- Client implements its own `shoppingApi.generateFromPlan()` that parses ingredients locally
- Edge function provides smarter AI-powered consolidation with quantity merging

### 7. parse-school-menu -- OK
- **Client sends**: `{ image_data, image_type }` via `schoolMenuApi.parsePhoto()` (line 1478-1479)
- **Edge reads**: `{ url, menuText, image_data, image_type }` (line 261) -- supports 3 input modes
- **Edge returns**: `ParsedSchoolMenu { schoolName, weekOf, items[] }`
- **Client expects**: Same type (defined inline at line 1456-1467)
- **Client transforms**: Maps items to `SchoolMenuItem` format for DB storage (line 1492-1501)
- **Verdict**: Contract matches for the image path. The URL/text paths are not used from client.

### 8. scrape-restaurant-url -- FIXED
- **Client sends**: `{ url }` -- matches
- **Edge returns**: `{ restaurantName, cuisine, menuSections, hours, address, phone }`
- **Client expected**: `Partial<Restaurant>` with `name`, `cuisine_type`, etc.
- **Impact**: Fields like `restaurantName` would not map to `name`, creating an object with no recognized fields
- **Fix**: Added transformation mapping `restaurantName` -> `name`, `cuisine` -> `cuisine_type`, etc.

### 9. suggest-restaurant -- FIXED (2 bugs)
- **Client was sending**: `{ cuisine_type, kid_friendly, price_range }` (spread from `RestaurantFilters`)
- **Edge reads**: `{ cuisinePreferences[], hasKids, priceRange }` -- all camelCase with different shapes
- **Impact**: All filter preferences were ignored, AI always used defaults
- **Client expected**: `Restaurant[]`
- **Edge returns**: `{ suggestions: RestaurantSuggestion[] }` with different field shapes
- **Fix**: Mapped filter fields to edge function's expected names and mapped response to `Restaurant` format

### 10. leftover-suggestions -- FIXED
- **Client sends**: `{ originalMeal, leftoverIngredients, availableTime, servingsNeeded }` -- matches edge expectations
- **Edge returns**: `{ suggestions: LeftoverIdea[] }` with `{ name, description, transformationType, ... }`
- **Client expected**: `{ suggestions: LeftoverSuggestion[] }` with `{ meal_id, meal_name, suggestion, ... }`
- **Impact**: UI trying to render `meal_name` and `suggestion` fields that don't exist on the response objects
- **Fix**: Added mapping from `LeftoverIdea` fields to `LeftoverSuggestion` format

### 11. lunch-alternatives -- FIXED (2 bugs)
- **Client was sending**: `{ date }` -- edge function ignores `date`, expects `{ schoolMeal }`
- **Edge reads**: `body.schoolMeal` (line 112) -- defaults to empty string, triggers "schoolMeal required" error
- **Impact**: Every call would return 400 error "Please provide the school meal to find alternatives for"
- **Edge returns**: `{ alternatives: LunchAlternative[] }` (edge's own type with `name`, `description`, `type`, etc.)
- **Client expected**: `LunchAlternative` (client's type with `school_menu`, `needs_alternative`, `quick_lunch_options`, etc.)
- **Impact**: Even if the request succeeded, the response shape was completely incompatible
- **Fix**: Added pre-fetch of school menu items to get the meal name, then passes `schoolMeal` to edge function, and transforms response to client's expected `LunchAlternative` format

### 12. agent -- OK
- **Client sends**: `{ message, conversationId, metadata }` (useAgent.ts line 79-83)
- **Edge reads**: `body.message`, `body.metadata`, `body.conversationId` (line 265)
- **Edge returns**: `{ success, message, conversationId, executionTimeMs, data: { usage, recipesLoaded, leftoverCount } }`
- **Client expects**: `AgentResponse { success, message, data, actions, conversationId, executionTimeMs, error }`
- **Verdict**: Compatible. The `actions` field is optional and the edge function doesn't return it (yet), but the client handles its absence correctly (line 190-211 checks `response.actions` before iterating).

## Non-Existent Edge Functions Called by Client

These are edge functions referenced in `api.ts` that have no corresponding directory in `supabase/functions/`:

1. **`scrape-restaurant`** (line 2117) -- Only `scrape-restaurant-url` exists. The `restaurantsApi.scrape(id)` function sends `{ restaurant_id: id }` which implies a DB-backed lookup by ID + scraping. This feature appears to be planned but unimplemented.

2. **`search-restaurant`** (line 2107) -- The `restaurantsApi.search(query)` function sends `{ query }` to an AI-powered restaurant search. No edge function exists.

3. **`geocode-address`** (line 2137) -- The `restaurantsApi.geocode(address)` function sends `{ address }` for lat/lng lookup. No edge function exists.

These will all return 404 errors at runtime. They are stub API methods for features that were planned but the backend was never implemented.

## Summary

- **8 bugs fixed** across 5 edge function contracts
- **3 critical bugs**: `suggest-meal` field name + response mismatch, `lunch-alternatives` always failing
- **3 high-severity bugs**: `suggest-restaurant` filter + response mismatch, `lunch-alternatives` type mismatch
- **2 medium bugs**: `leftover-suggestions` field mismatch, `scrape-restaurant-url` field name mismatch
- **1 dead endpoint**: `generate-shopping-list` (replaced by client-side implementation)
- **3 non-existent edge functions** referenced by client code
- **Build status**: Clean, no warnings
