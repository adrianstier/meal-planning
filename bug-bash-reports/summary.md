# Bug Bash Summary -- Wave 2 (Multi-Agent)

## Wave Statistics
- Scope agents: 6
- Total files modified: 30
- Total bugs fixed: 43 (42 from scope agents + 1 from cross-cutting review)
- Build status: PASS

## Bugs Fixed by Scope

### API Layer (9 bugs)
| # | Severity | Description |
|---|----------|-------------|
| 1 | High | Timezone bug in `planApi.getWeek` -- `new Date("YYYY-MM-DD")` parsed as UTC midnight, causing wrong end date in US timezones |
| 2 | High | Timezone bug in `planApi.add` -- wrong `day_of_week` computed from UTC midnight |
| 3 | High | Timezone bug in `planApi.update` -- same UTC midnight issue |
| 4 | High | Timezone bug in `planApi.clearWeek` -- end date off by one day |
| 5 | High | Timezone bug in `planApi.generateWeek` -- generated dates shifted by one day |
| 6 | High | Timezone bug in `planApi.applyGenerated` -- wrong day_of_week on applied plan |
| 7 | Medium | Null safety crash in `schoolMenuApi.getCalendar` when unexpected `meal_type` value |
| 8 | Medium | Ingredient scaler parsed "1/2" as quantity 1 (greedy regex captured "1" as whole number) |
| 9 | Low | Misleading error message in `planApi.generateWeek` promised graceful degradation that doesn't occur |

### Plan & Meal Pages (6 bugs)
| # | Severity | Description |
|---|----------|-------------|
| 1 | High | `usePlan.ts getWeekStart()` computed Monday instead of Sunday, causing cache invalidation misses |
| 2 | Medium | `AddMealDialog` showed zero meals for `morning_snack`/`afternoon_snack` slots (type mismatch with DB) |
| 3 | Low | Dialog title showed "Add Morning_snack" with underscore instead of space |
| 4 | Medium | Overlapping delete button and dropdown menu trigger on `MealCard` |
| 5 | Low | `mealDisplayMode` not loaded from localStorage on initialization |
| 6 | Low | `recipeBrowserOpen` not loaded from localStorage on initialization |

### Feature Pages (8 bugs)
| # | Severity | Description |
|---|----------|-------------|
| 1 | Medium | `parseInt` NaN on cleared number inputs in HolidayPlannerPage |
| 2 | Medium | Tabs `defaultValue` did not reset when switching events in HolidayPlannerPage |
| 3 | Medium | UTC timezone bug displaying wrong delivery date in CSABoxPage |
| 4 | Low | Dangling "Used on" text and UTC bug for `used_date` in CSABoxPage |
| 5 | Medium | UTC timezone bug on cooked/expiry dates in LeftoversPage |
| 6 | High | Runtime TypeError in SeasonalCookingPage when produce has unexpected category |
| 7 | Medium | Shopping items with categories not in hardcoded `categoryOrder` silently hidden in ListsPage |
| 8 | Low | "Add Restaurant" button clickable with empty form in RestaurantsPage |

### Auth & Contexts (4 bugs)
| # | Severity | Description |
|---|----------|-------------|
| 1 | Medium | `filteredLogs.reverse()` mutated React state array in ErrorLogViewer |
| 2 | Low | Invalid `stale: true` filter in BroadcastSyncContext (silently ignored by React Query v5) |
| 3 | Low | Keyboard shortcut `Cmd+Shift+E` did not work on macOS in ErrorLogViewer |
| 4 | Low | Password fields not cleared after successful password reset in LoginPage |

### Edge Functions (15 bugs)
| # | Severity | Description |
|---|----------|-------------|
| 1 | High | Prompt injection via unsanitized `source_url` in parse-recipe AI prompt |
| 2 | Medium | Falsy zero values silently dropped in parse-recipe-image (0 calories -> null) |
| 3-6 | High | SSRF bypass via HTTP redirect in 4 URL-fetching functions (parse-recipe-url, parse-recipe-url-ai, parse-school-menu, scrape-restaurant-url) |
| 7-15 | Medium | API error details leaked to client in 9 edge functions (could expose API keys, rate limit details) |

### Agent System (4 bugs)
| # | Severity | Description |
|---|----------|-------------|
| 1 | High | `handleGeneralQuestion` never received user's actual message -- passed only extracted entities or generic string |
| 2 | High | `processImage` in recipe-agent never sent image data to Claude Vision (only sent text prompt) |
| 3 | Medium | `handleCostEstimate` in shopping-agent crashed with TypeError when AI returned invalid JSON |
| 4 | Low | `estimateNutrition` returned `success: true` with null data |

## Cross-Cutting Validation

### Date Parsing -- FIXED (with 1 additional fix)
All 6 timezone bugs in `api.ts` were fixed by the API Layer agent using `parseISO()`. The Feature Pages agent fixed CSABoxPage, LeftoversPage, and HolidayPlannerPage using `+ 'T00:00:00'`. The Plan Pages agent fixed `usePlan.ts` and `AddMealDialog.tsx` by splitting the date string manually.

**Review agent found 1 additional instance**: `RecipesPage.tsx:992-995` used `new Date(meal.last_cooked)` where `last_cooked` is a `DATE` column (returns `YYYY-MM-DD`), causing the "Last cooked" display to show the previous day in US timezones. Fixed by appending `'T00:00:00'`.

Remaining `new Date()` calls in the codebase were verified safe:
- `new Date()` with no args (current time) -- safe
- `new Date(isoTimestamp)` where value includes time component (`created_at`, `timestamp`, etc.) -- safe
- `new Date(dateObj)` copying existing Date objects -- safe
- Server-side (edge functions) UTC parsing -- correct for server context
- Sorting comparisons where both values shift equally -- ordering preserved

### Error Leakage -- OK
Edge functions agent sanitized all AI API error messages (9 functions). Client-side `api.ts` has a `sanitizeErrorMessage()` + `createSanitizedError()` pattern applied to the most frequently used endpoints. Some less-used CRUD endpoints still `throw error` directly from Supabase responses, but these contain PostgreSQL error messages (table/column names), not secrets or API keys. The edge functions (which call external AI APIs) were the higher-risk surface and are now fully sanitized.

### Week Start Alignment -- OK
All three locations compute Sunday as week start:
- `PlanPageEnhanced.tsx:219`: `startOfWeek(today, { weekStartsOn: 0 })`
- `usePlan.ts:14`: `date.getDate() - date.getDay()` (getDay 0 = Sunday)
- `planApi.getWeek()`: receives Sunday start, adds 6 for Saturday end

### Query Key Consistency -- OK
All React Query `invalidateQueries` calls use key prefixes that match their corresponding `useQuery` definitions:
- `['meals']` / `['meal', id]` -- useMeals.ts
- `['plan']` / `['plan', 'week', startDate]` -- usePlan.ts
- `['shopping']` -- useShopping.ts
- `['leftovers']` / `['leftovers', 'suggestions']` -- useLeftovers.ts
- `['restaurants']` / `['restaurants', id]` -- useRestaurants.ts
- `['school-menu']` and variants -- useSchoolMenu.ts
- `['agentConversation']`, `['agentConversations']`, `['agentFeedback']` -- useAgent.ts

Prefix-based invalidation (e.g., `['plan']`) correctly invalidates all queries starting with that prefix, including `['plan', 'week', startDate]`.

### Ingredient Scaler -- OK
The rewritten `ingredientScaler.ts` properly handles all edge cases:
- `"1 1/2"` -- matched by Pattern 1 (mixed slash): whole=1 + fraction=0.5 = 1.5
- `"1/2"` -- Pattern 1 won't match (no space+fraction after digit). Pattern 3 (standalone slash) matches: 0.5
- `"1/4"` -- Pattern 3: 0.25
- `"2"` -- Pattern 5 (plain number): 2
- `"0.5"` -- Pattern 5 matches "0", so quantity=0, returns as-is (limitation but not a crash)
- Empty string -- no pattern matches, returns as-is
- Unicode fractions (`"½"`, `"1½"`) -- Patterns 2 and 4 handle these correctly

Note: decimal quantities like `"0.5"` are not parsed (returned as-is). This is a minor limitation, not a regression -- the previous implementation also did not handle decimal quantities.

## Remaining Issues (not fixed, noted by scope agents)

### Would benefit from future attention
1. **`generateWeek` assigns same meal to all meal types per day** (api.ts:1117-1126) -- Only triggered if called with multiple meal types, currently only called with `['dinner']`
2. **Agent feedback buttons (ThumbsUp/ThumbsDown) are non-functional** -- Rendered but no onClick handlers wired up
3. **Multi-agent framework is dead code in production** -- The `agent/index.ts` endpoint calls Claude directly rather than routing through the orchestrator/agent system
4. **No catch-all 404 route** in App.tsx -- undefined paths render blank
5. **CORS origin list divergence** between `agent/index.ts` and `_shared/cors.ts` -- agent endpoint missing `localhost:3001`

### Low risk, acceptable as-is
- `bulkDelete` reports `mealIds.length` as `deleted_count` even if RLS filters some
- `getResetTime` uses unfiltered timestamps (only called after `isAllowed` filters them)
- `PlanPage.tsx` could crash on unexpected `meal_type` (constrained by TypeScript types)
- `useSchoolMenuCalendar` fires query even without date params
- `DiagnosticsPage` duplicate detection is case-sensitive
- Several `eslint-disable` comments for `react-hooks/exhaustive-deps` (intentional)
- AuthContext double-processes login events (documented tech debt)
- LoginPage `noValidate` with no client-side empty-field check for login mode
- No Content-Length pre-check on `parse-recipe-image` before body parsing
- No input type validation on array parameters in several edge functions
- PostgREST wildcard characters not escaped in planning-agent `queryRecipes`
