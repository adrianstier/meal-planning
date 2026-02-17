# Bug Bash Summary — All Waves

## Statistics
| Wave | Strategy | Agents | Bugs Fixed | Files Modified |
|------|----------|--------|------------|----------------|
| Wave 1 | Serial (orchestrator only) | 3 audit + manual | 8 | 8 |
| Wave 2 | Parallel (6 scope agents + review) | 7 | 43 | 30 |
| Wave 3 | Deep pass (remaining issues, regression, integration, schema) | 6 | 13 | 12 |
| Wave 4 | Hardening (state machines, dead code, edge contracts) | 3 | 26+ | 13 |
| **Total** | | **19 agents** | **90+ bugs** | **~50 unique files** |

Build status: **PASS** (zero warnings across all waves)

---

## Wave 1 — Serial Bug Bash (8 bugs)

| # | Severity | File | Description |
|---|----------|------|-------------|
| 1-4 | HIGH | 4 edge functions | Missing AbortController timeout on Claude API calls |
| 5 | HIGH | useAgent.ts | Wrong query invalidation keys (weekPlan→plan, shoppingItems→shopping) |
| 6 | MEDIUM | useAgent.ts | Missing apikey header and credentials:'omit' |
| 7 | HIGH | useAgent.ts | Timeout race condition (finally block reset isTimeoutRef before onError) |
| 8 | MEDIUM | parse-recipe-url | Missing rate limiting |

Plus: BroadcastSyncContext postMessage error handling, deleted dead useBroadcastSync.ts

## Wave 2 — Parallel Multi-Agent (43 bugs)

### API Layer (9 bugs)
- 6x UTC midnight date parsing in planApi (new Date → parseISO)
- Ingredient scaler: "1/2" parsed as 1 instead of 0.5
- School menu calendar crash on unknown meal_type
- Misleading error message in plan generation

### Plan & Meal Pages (6 bugs)
- getWeekStart() used Monday instead of Sunday (cache key mismatch)
- AddMealDialog: zero meals for snack slots, bad title formatting
- MealCard: overlapping delete button and dropdown
- PlanPageEnhanced: 2x localStorage not loaded on init

### Feature Pages (8 bugs)
- HolidayPlanner: NaN from parseInt(''), tabs not resetting
- CSABox + Leftovers + Recipes: dates off by one in western timezones
- SeasonalCooking: crash on unknown produce category
- ListsPage: items with non-standard categories invisible
- RestaurantsPage: submit button enabled before form visible

### Auth & Contexts (4 bugs)
- ErrorLogViewer: Array.reverse() mutating state, macOS shortcut broken
- BroadcastSync: invalid React Query v5 `stale` property
- LoginPage: password fields not cleared after reset

### Edge Functions (15 bugs)
- 4x SSRF bypass via HTTP redirect (redirect:'manual' + validate target)
- Prompt injection via unsanitized sourceUrl (→ JSON.stringify)
- 9x API error details leaked to client (→ generic message + server logging)
- parse-recipe-image: falsy zero values dropped (0 || 4 = 4)

### Agent System (4 bugs)
- Orchestrator lost user's actual message for general questions
- Recipe image processing never sent images to Claude Vision
- Shopping cost estimation crash on failed AI response
- Nutrition estimation returned success:true with null data

### Cross-Cutting Review (+1 bug)
- RecipesPage: additional date timezone bug in last_cooked display

## Wave 3 — Deep Pass (13 bugs)

### Remaining Issues (5)
- Wired up agent feedback ThumbsUp/ThumbsDown buttons
- Added 404 catch-all route
- Fixed CORS origin divergence in agent endpoint
- Escaped PostgREST wildcards in planning-agent
- Fixed generateWeek same-meal-all-types logic

### Schema Alignment (3)
- Removed phantom dislike_count from SchoolMenuItem type
- Fixed Restaurant JSONB fields typed as string
- Added 11 missing columns to Meal interface

### Integration Flows (2)
- Shopping category names mismatched between generator and display
- Added legacy category backward compatibility

### Regression Fixes (3)
- Sanitized error messages in base-agent callAI/callAIWithTools
- Sanitized error messages in recipe-agent processImage

### Regression Verification
- All 51 Wave 1-2 fixes verified correct by dedicated regression agents
- Zero regressions in original fixes

## Wave 4 — Hardening (26+ bugs)

### State Machines (10 bugs)
- PlanPageEnhanced: `handleMoveMeal`/`handleSwapMeal` were silent no-ops reachable from UI
- RecipesPage: 3x stale `formData` closures in parse handlers (used spread instead of functional update)
- RecipesPage: 4x dialog `onOpenChange` not clearing state (`selectedMeal`, `bulkTagInput`, `recipeText`)
- HolidayPlannerPage: `loading` state set but never read — zero loading feedback on template apply

### Edge Function Contracts (8 bugs)
- `suggest-meal`: Client sent `meal_type` (snake_case) but edge reads `mealType` — always defaulted to dinner
- `suggest-meal`: Client expected `Meal[]` but edge returns `{ suggestions }` wrapper
- `lunch-alternatives`: Client sent `{ date }` but edge expects `{ schoolMeal }` — always returned 400 error
- `lunch-alternatives`: Response type completely mismatched between client and edge function
- `suggest-restaurant`: Filter parameters all ignored (snake_case vs camelCase mismatch)
- `suggest-restaurant`: Response format mismatch (suggestions wrapper + different field shapes)
- `leftover-suggestions`: Client `LeftoverSuggestion` type had different fields than edge `LeftoverIdea`
- `scrape-restaurant-url`: Edge returns `ParsedRestaurantMenu` but client expected `Partial<Restaurant>`

### Dead Code Cleanup (8+ items removed)
- Removed unused `navigate` from SeasonalCookingPage
- Removed dead `handleScrapeFromUrl`, `scrapeUrl` state, `useScrapeRestaurantUrl` from RestaurantsPage
- Removed unused `useMeal`, `useSearchMeals`, `useParseRecipeFromUrl`, `useDebounce` from useMeals.ts
- Removed unused `getCuisineEmoji` usage from WeeklyVarietySummary
- Cleaned up unused exports in cuisineColors, errorLogger, rateLimiter, api types

---

## Security Fixes Summary
| Category | Count | Details |
|----------|-------|---------|
| SSRF bypass | 4 | HTTP redirect following bypassed isPublicUrl() |
| Prompt injection | 1 | User sourceUrl interpolated into AI prompt |
| Info leakage | 12 | Raw API errors exposed to clients |
| Rate limiting | 1 | parse-recipe-url missing rate limit |
| SQL wildcards | 1 | PostgREST ilike() with unescaped user input |

## Top Impact Fixes
1. **UTC date parsing** (9 locations) — every US timezone user saw wrong dates
2. **Edge function contract mismatches** (5 endpoints) — suggest-meal, lunch-alternatives, suggest-restaurant, leftover-suggestions, scrape-restaurant-url all silently broken
3. **Ingredient scaler** — doubled all slash-fraction ingredients
4. **SSRF bypass** — attackers could reach internal services via redirect
5. **Cache key mismatch** — plan UI silently failed to refresh after mutations
6. **Invisible shopping categories** — items counted but never rendered
7. **Shopping category mismatch** — generated items fell into unsorted bucket

## Remaining Concerns — ALL RESOLVED (Wave 5)

All 6 deferred concerns have been addressed:

1. ~~Edge functions return nutrition data the frontend drops~~ → **Fixed:** Nutrition fields (calories, protein, carbs, fat, fiber) now flow from parse handlers through formData to database. Collapsible nutrition UI added to recipe form.
2. ~~AI-powered generate-shopping-list edge function unused~~ → **Fixed:** `shoppingApi.generateFromPlan()` now calls the AI edge function, with client-side regex as fallback.
3. ~~`meal_plans` DB table completely unused~~ → **Fixed:** Table dropped via migration, `meal_plan_id` FK removed from `scheduled_meals`.
4. ~~Multi-agent orchestrator is dead code~~ → **Fixed:** `agent/index.ts` now routes through `OrchestratorAgent` (intent classification → agent dispatch → response aggregation) with direct Claude fallback.
5. ~~3 non-existent edge functions referenced by client~~ → **Fixed:** Removed `search-restaurant`, `scrape-restaurant`, `geocode-address` API functions, hooks, and UI buttons.
6. ~~`needsAI` flag not propagated~~ → **Fixed:** `directEdgeFunctionFetch()` now attaches `responseBody` and `status` to `EdgeFunctionError`, enabling AI fallback path.
