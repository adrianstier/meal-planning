# Regression Check (Client) -- Bug Bash Report

**Date:** 2026-02-09
**Build Status:** Compiled successfully (no errors, no warnings)

## Fixes Verified Correct

| # | File | Fix | Status |
|---|------|-----|--------|
| 1a | `client/src/hooks/useAgent.ts` | Query key `['plan']` matches `usePlan.ts` key at line 25 (`['plan', 'week', startDate]`) -- prefix match works correctly with React Query's hierarchical invalidation | PASS |
| 1b | `client/src/hooks/useAgent.ts` | Query key `['shopping']` matches `useShopping.ts` key at line 6 (`['shopping']`) -- exact match | PASS |
| 1c | `client/src/hooks/useAgent.ts` | `'apikey': supabaseAnonKey` header added at line 76; `supabaseAnonKey` is imported from `../lib/supabase` at line 11 | PASS |
| 1d | `client/src/hooks/useAgent.ts` | `credentials: 'omit'` added at line 85, correctly placed inside the fetch options object | PASS |
| 1e | `client/src/hooks/useAgent.ts` | `isTimeoutRef.current = false` removed from finally block (line 143-147); `onError` reads and resets it at lines 221-223. No race condition: finally runs before onError, so the ref value is preserved for onError to read and then reset | PASS |
| 2a | `client/src/contexts/BroadcastSyncContext.tsx` | `postMessage` wrapped in try-catch (lines 101-105); catch logs the error with `console.error` -- does not swallow errors, just prevents unhandled exception from crashing the app. The message is still broadcast to other tabs on success | PASS |
| 2b | `client/src/contexts/BroadcastSyncContext.tsx` | `stale: true` removed from `invalidateQueries` (line 72-74); remaining options `{ refetchType: 'active' }` are valid React Query v5 syntax | PASS |
| 3a | `client/src/lib/api.ts` | `parseISO` imported from `date-fns` at line 4; used correctly in 6 locations (lines 478, 920, 954, 981, 1023, 1113, 1147, 1205, 1228). `parseISO("2025-01-15")` creates midnight in local timezone, fixing the UTC midnight shift bug that `new Date("2025-01-15")` had | PASS |
| 3b | `client/src/lib/api.ts` | School menu calendar null safety: line 1558 checks `mealType === 'breakfast' || mealType === 'lunch' || mealType === 'snack'` before pushing to the bucket, preventing crashes from unexpected meal types. The `data?.forEach` at line 1552 also handles null data | PASS |
| 4 | `client/src/utils/ingredientScaler.ts` | Rewritten fraction parsing handles all cases correctly: (1) "1 1/2" via `mixedSlashMatch` pattern, (2) "1/2" via `slashFractionMatch`, (3) unicode fractions like "1/2" via `unicodeFractionMatch`, (4) plain numbers like "2" via `plainNumberMatch`, (5) empty/unrecognized strings return the original line unchanged. Patterns are ordered most-specific-first to prevent the old bug where "1/2" was parsed as whole=1 + fraction="/2". No catastrophic backtracking risk -- all regexes are anchored to start with `^`, use simple character classes, and have no nested quantifiers | PASS |
| 5 | `client/src/hooks/usePlan.ts` | Week start calculation at lines 9-21: `date.getDay()` returns 0 for Sunday, so `date.getDate() - dayOfWeek` correctly goes back to Sunday. For a Wednesday (day=3), `date - 3` gives Sunday. For Sunday (day=0), `date - 0` stays on Sunday. Formatted as YYYY-MM-DD with zero-padded month and day | PASS |
| 6a | `client/src/components/features/plan/AddMealDialog.tsx` | `morning_snack`/`afternoon_snack` normalized to `snack` for meal filtering (line 56) and backend API calls (lines 69-73, 94-98). The `normalizedMealType` variable correctly maps compound types | PASS |
| 6b | `client/src/components/features/plan/AddMealDialog.tsx` | Title formatting at line 120 uses ternary chain: `morning_snack` -> "Morning Snack", `afternoon_snack` -> "Afternoon Snack", others -> capitalize first letter. Correct | PASS |
| 7 | `client/src/components/features/plan/MealCard.tsx` | Delete button conditional at line 90: `onDelete && !(onCopy || onMove || onSwap)` shows the simple X button only when delete is the sole action. When other actions exist, lines 106-150 show the dropdown menu which includes delete. No overlap possible -- the two are mutually exclusive | PASS |
| 8a | `client/src/pages/PlanPageEnhanced.tsx` | Lazy initializers: `viewMode` at line 222-224 reads from `localStorage.getItem('planViewMode')` with fallback to `'compact'`. The `as ViewMode` cast is safe because the value was written by the same code | PASS |
| 8b | `client/src/pages/PlanPageEnhanced.tsx` | `mealDisplayMode` at lines 226-229 validates the localStorage value against allowed values before using it, with fallback to `'dinners'`. This guards against corrupted localStorage | PASS |
| 8c | `client/src/pages/PlanPageEnhanced.tsx` | `recipeBrowserOpen` at lines 242-244 handles null (first visit) by defaulting to `true`, and parses the string value with `=== 'true'`. Safe against corrupted values (any non-'true' string defaults to false) | PASS |
| 9a | `client/src/pages/CSABoxPage.tsx` | Date fixes at lines 345, 401, 628: `new Date(date + 'T00:00:00')` forces local timezone parsing instead of UTC. Correct pattern | PASS |
| 9b | `client/src/pages/HolidayPlannerPage.tsx` | Date fix at line 544: `new Date(event.event_date + 'T00:00:00')` -- correct. `parseInt` fallbacks: line 491 `parseInt(e.target.value) || 1` (guest_count min 1), line 944 `|| 1` (servings min 1), line 955 `|| 0` (prep_time default 0), line 964 `|| 0` (cook_time default 0). All defaults are sensible | PASS |
| 9c | `client/src/pages/LeftoversPage.tsx` | Date fixes at lines 128, 133: `new Date(leftover.cooked_date + 'T00:00:00')` and `new Date(leftover.expires_date + 'T00:00:00')` -- correct pattern | PASS |
| 9d | `client/src/pages/RecipesPage.tsx` | Date fix at lines 992-995: `new Date(meal.last_cooked + 'T00:00:00')` used for both display and year comparison. Correct | PASS |
| 9e | `client/src/pages/ListsPage.tsx` | Extra categories logic at lines 86-88: `knownCategories` filters the predefined order for categories that have items, `extraCategories` captures any API categories not in the predefined list (sorted alphabetically), and `sortedCategories` merges both. This ensures no categories from the AI shopping list generator are lost | PASS |
| 9f | `client/src/pages/RestaurantsPage.tsx` | Button disabled state at line 760: `disabled={!editDialogOpen && !showManualEntry}` prevents submission when in search mode (not editing and not manual entry). When `editDialogOpen` is true, button is enabled for editing. When `showManualEntry` is true, button is enabled for adding. Correct logic | PASS |
| 9g | `client/src/pages/SeasonalCookingPage.tsx` | Unknown category guard at lines 490-491: `if (!groups[item.category]) { groups[item.category] = []; }` dynamically creates a new array for any category not in the predefined set (vegetable, fruit, herb). This prevents crashes if the seasonal data has unexpected categories | PASS |
| 9h | `client/src/pages/LoginPage.tsx` | Password clear: cleared on successful password reset (line 192), cleared when switching modes (line 234). NOT cleared on login failure -- this is correct standard UX (user can retry without retyping). Error messages are sanitized (lines 198-219) to avoid leaking internal details | PASS |
| 9i | `client/src/components/ErrorLogViewer.tsx` | Reverse copy: `[...filteredLogs].reverse()` at line 167 creates a shallow copy before reversing, so the original `filteredLogs` array is not mutated. Shows newest errors first. `metaKey` check at line 39: `(e.ctrlKey || e.metaKey)` correctly handles both Windows (Ctrl) and Mac (Cmd) keyboard shortcuts | PASS |

## Regressions Found & Fixed

| # | File:Line | Issue | Fix |
|---|-----------|-------|-----|

No regressions were found. All fixes are logically correct, imports are present, and the project builds cleanly with no errors or warnings.
