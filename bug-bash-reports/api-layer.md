# API Layer -- Bug Bash Report

## Bugs Fixed

| # | File:Line | Severity | Description | Fix Applied |
|---|-----------|----------|-------------|-------------|
| 1 | `client/src/lib/api.ts:918` | High | **Timezone bug in `planApi.getWeek`**: `new Date("YYYY-MM-DD")` parses the date string as UTC midnight. In US timezones (west of UTC), this resolves to the previous day in local time. `getDate()+6` then computes the wrong end date, causing the week query to miss the last day of the week. | Changed `new Date(startDate)` to `parseISO(startDate)` which parses as local midnight. |
| 2 | `client/src/lib/api.ts:952` | High | **Timezone bug in `planApi.add` day_of_week**: Same UTC parsing issue causes `toLocaleDateString('en-US', { weekday: 'long' })` to return the wrong weekday name (one day off) for the stored `day_of_week` field. | Changed `new Date(planDate)` to `parseISO(planDate)`. |
| 3 | `client/src/lib/api.ts:979` | High | **Timezone bug in `planApi.update` day_of_week**: Same UTC parsing issue when updating a plan's date. | Changed `new Date(plan.plan_date)` to `parseISO(plan.plan_date)`. |
| 4 | `client/src/lib/api.ts:1020` | High | **Timezone bug in `planApi.clearWeek`**: Same UTC parsing issue causes the end date calculation to be off by one day, potentially failing to clear the last day of the week. | Changed `new Date(startDate)` to `parseISO(startDate)`. |
| 5 | `client/src/lib/api.ts:1109` | High | **Timezone bug in `planApi.generateWeek`**: Same UTC parsing issue causes generated meal plan dates to be shifted by one day in US timezones. | Changed `new Date(startDate)` to `parseISO(startDate)`. |
| 6 | `client/src/lib/api.ts:1141` | High | **Timezone bug in `planApi.applyGenerated` day_of_week**: Same UTC parsing issue when converting generated plan dates to day-of-week names. | Changed `new Date(item.date)` to `parseISO(item.date)`. |
| 7 | `client/src/lib/api.ts:1554` | Medium | **Null safety crash in `schoolMenuApi.getCalendar`**: `item.meal_type` is unsafely cast to `'breakfast' | 'lunch' | 'snack'` and used to index into the calendar object. If the DB contains an unexpected meal_type value, `calendar[date][mealType]` would be `undefined` and `.push()` would throw a TypeError at runtime. | Added guard to only push items with recognized meal types (`breakfast`, `lunch`, `snack`). |
| 8 | `client/src/utils/ingredientScaler.ts:73` | Medium | **Ingredient scaling parses "1/2" incorrectly**: The regex `^(\d+\s*)?([...unicode...]|[\d/]+)?` has a greedy first group that captures the leading "1" from "1/2" as the whole number, leaving "/2" for the fraction group. `fractionToDecimal("/2")` returns 0, so "1/2 cup flour" is parsed as quantity 1 instead of 0.5, doubling the ingredient amount. | Rewrote parsing to try patterns from most specific to least specific: mixed fractions first, then standalone slash fractions, then standalone unicode fractions, then plain numbers. |
| 9 | `client/src/lib/api.ts:1095` | Low | **Misleading error message in `planApi.generateWeek`**: Error says "Add more recipes or we'll repeat some" but the function throws (stops execution), so repeating never actually happens. The user sees a promise of graceful degradation that doesn't occur. | Changed message to "Please add more recipes first." |

## Issues Noted (not fixed)

| # | File:Line | Severity | Description | Reason Not Fixed |
|---|-----------|----------|-------------|-----------------|
| 1 | `client/src/lib/api.ts:1117-1126` | Low | **`generateWeek` assigns same meal to all meal types per day**: When `mealTypes` has multiple entries (e.g., `['breakfast', 'dinner']`), the loop picks one meal per day and assigns it to every meal type. A breakfast-tagged meal could be assigned as dinner. | Currently only called with `['dinner']` in the UI, so the bug path is not triggered. Fixing requires restructuring the generation logic. |
| 2 | `client/src/lib/api.ts:660` | Low | **`bulkDelete` reports `mealIds.length` as `deleted_count`**: If some IDs don't belong to the user (filtered by RLS), the actual delete count could be lower than reported. | The count is not used critically in the UI and RLS prevents unauthorized deletes. Would need `.select()` on the delete to get actual count, which adds overhead. |
| 3 | `client/src/utils/rateLimiter.ts:60-67` | Low | **`getResetTime` uses unfiltered timestamps**: Could return incorrect reset time if called independently of `isAllowed`. | In current usage, `getResetTime` is always called right after `isAllowed` which filters timestamps first. Not a bug in practice. |

## Files Reviewed (clean)

- `client/src/lib/supabase.ts` -- Proper URL validation, safe fallback client creation, no issues found.
- `client/src/lib/utils.ts` -- Standard utility functions (cn, formatDate, debounce, etc.), no issues found.
- `client/src/types/api.ts` -- Type definitions only, well-structured, no issues found.
- `client/src/utils/errorLogger.ts` -- Proper error handling with localStorage quota fallback, log sanitization, memory buffer. No issues found.
- `client/src/utils/rateLimiter.ts` -- Sliding window implementation is correct. Minor note about `getResetTime` listed above but not a real bug in current usage.
- `client/src/utils/cuisineColors.ts` -- Static mapping with safe null/undefined fallback. No issues found.
