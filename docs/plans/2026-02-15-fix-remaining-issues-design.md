# Fix All 6 Remaining Issues — Design

## Context

After 4 waves of bug fixes (90+ bugs), 6 issues remain that require design decisions. This plan addresses all of them.

## Workstreams

### W1: Nutrition Data Flow
**Problem:** Edge functions (parse-recipe, parse-recipe-image) return nutrition data (calories, protein_g, carbs_g, fat_g, fiber_g) but RecipesPage.tsx drops them — formData never includes nutrition fields.

**Fix:**
- Add nutrition fields to formData state initialization in RecipesPage.tsx
- Copy nutrition from parsedData in handleParseRecipe(), processParseResult(), handleParseFromImage()
- Add collapsible Nutrition section to recipe form
- Fix parse-recipe-url to extract nutrition from JSON-LD structured data

**Files:** client/src/pages/RecipesPage.tsx, supabase/functions/parse-recipe-url/index.ts

### W2: Wire Up AI Shopping List
**Problem:** generate-shopping-list edge function exists with AI consolidation but is unused. Client does basic regex parsing.

**Fix:**
- Update shoppingApi.generateFromPlan() to call the edge function
- Map edge function response (items[], byCategory) into shopping_items inserts
- Remove client-side regex parsing logic

**Files:** client/src/lib/api.ts (shoppingApi.generateFromPlan), client/src/hooks/useShopping.ts

### W3: Remove meal_plans Table
**Problem:** meal_plans table has zero references anywhere in code. All planning uses scheduled_meals directly.

**Fix:**
- Migration: DROP TABLE meal_plans CASCADE
- Migration: ALTER TABLE scheduled_meals DROP COLUMN meal_plan_id
- Update schema.sql and rls_policies.sql

**Files:** supabase/schema.sql, supabase/rls_policies.sql, new migration file

### W4: Wire Up Orchestrator
**Problem:** Multi-agent orchestrator framework (8 files, ~2000+ lines) is fully implemented but agent/index.ts calls Claude directly.

**Fix:**
- Import OrchestratorAgent in agent/index.ts
- Route messages through orchestrator: classify intent → dispatch to agent → aggregate response
- Keep direct Claude call as fallback if orchestrator errors
- Fix ShoppingAgent schema field bugs (name→item_name, missing unit/recipes columns)

**Files:** supabase/functions/agent/index.ts, supabase/functions/_shared/agents/shopping-agent.ts

### W5: Remove Phantom Endpoint Client Code
**Problem:** Client calls 3 non-existent edge functions: search-restaurant, scrape-restaurant, geocode-address.

**Fix:**
- Remove restaurantsApi.search(), .scrape(), .geocode() from api.ts
- Remove useSearchRestaurant, useScrapeRestaurant, useGeocodeAddress hooks
- Remove UI buttons/handlers in RestaurantsPage.tsx

**Files:** client/src/lib/api.ts, client/src/hooks/useRestaurants.ts, client/src/pages/RestaurantsPage.tsx

### W6: Fix needsAI Propagation
**Problem:** directEdgeFunctionFetch() doesn't attach responseBody to error objects. edgeError.responseBody?.needsAI is always undefined.

**Fix:**
- In directEdgeFunctionFetch(), when !response.ok, parse JSON body and attach as error.responseBody
- Also attach response.status as error.status
- This enables the existing needsAI check in parseRecipeFromUrl to work

**Files:** client/src/lib/api.ts (directEdgeFunctionFetch, ~line 159)

## Parallelization

| Agent | Workstreams | Rationale |
|-------|------------|-----------|
| Agent A | W1 (Nutrition) | Isolated to RecipesPage + edge function |
| Agent B | W2 (Shopping AI) + W6 (needsAI fix) | Both in api.ts but different sections |
| Agent C | W3 (Remove meal_plans) | DB migration only |
| Agent D | W4 (Orchestrator) | Isolated to edge functions |
| Agent E | W5 (Remove phantom endpoints) | Isolated to restaurants code |

## Verification

- `npm run build` must pass with zero warnings after all changes
- Existing Playwright tests must still pass
