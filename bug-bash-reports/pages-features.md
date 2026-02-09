# Feature Pages -- Bug Bash Report

## Bugs Fixed
| # | File:Line | Severity | Description | Fix Applied |
|---|-----------|----------|-------------|-------------|
| 1 | `HolidayPlannerPage.tsx:491` | Medium | `parseInt(e.target.value)` returns `NaN` when input is cleared, setting `guest_count` to `NaN`. Same issue on lines 944, 955, 964 for `servings`, `prep_time_minutes`, `cook_time_minutes`. | Added `\|\| 1` fallback for guest_count and servings, `\|\| 0` for time fields |
| 2 | `HolidayPlannerPage.tsx:601` | Medium | `Tabs defaultValue="dishes"` does not reset tab when switching between events. User stays on e.g. "guests" tab when clicking a different event because `defaultValue` only applies on mount. | Added `key={selectedEvent.id}` to force Tabs remount on event change |
| 3 | `CSABoxPage.tsx:345` | Medium | `new Date(box.delivery_date)` parses date-only string as UTC midnight, which displays as the previous day in western timezones (e.g. PST/PDT). Same issue on line 401. | Changed to `new Date(box.delivery_date + 'T00:00:00')` to force local timezone parsing |
| 4 | `CSABoxPage.tsx:628` | Low | `used_date` rendered with `"Used on "` prefix even when `used_date` is undefined/null, leaving dangling text. Also has the same UTC timezone parsing bug. | Show "Used" when no date, append `'T00:00:00'` for timezone safety |
| 5 | `LeftoversPage.tsx:128,133` | Medium | `new Date(leftover.cooked_date)` and `new Date(leftover.expires_date)` parse date-only strings as UTC, showing wrong date in western timezones. | Changed to `new Date(date + 'T00:00:00')` for local timezone parsing |
| 6 | `SeasonalCookingPage.tsx:490` | High | `groupedProduce` only initializes `vegetable`, `fruit`, `herb` keys. If `filteredSeasonalProduce` contains an item with any other category, `groups[item.category]` is `undefined` and `.push()` throws a runtime `TypeError`. | Added guard: `if (!groups[item.category]) { groups[item.category] = []; }` |
| 7 | `ListsPage.tsx:85` | Medium | `sortedCategories` only includes categories in the hardcoded `categoryOrder` array. Shopping items with API categories not in that list (e.g., "Spices", "Condiments") are invisible -- present in `activeItems` count but never rendered. | Append any extra categories not in `categoryOrder` to the sorted list |
| 8 | `RestaurantsPage.tsx:758` | Low | "Add Restaurant" button in dialog footer is clickable even when the form is in search mode (`showManualEntry=false`) and no fields are visible, allowing submission of empty restaurant data. | Disabled the button when `!editDialogOpen && !showManualEntry` |

## Issues Noted (not fixed)
| # | File:Line | Severity | Description | Reason Not Fixed |
|---|-----------|----------|-------------|-----------------|
| 1 | `SeasonalCookingPage.tsx:206-232` | Low | Multiple `useEffect` hooks have eslint-disable for react-hooks/exhaustive-deps. The `findRecipesForProduce` and `loadBoxes`/`loadAllProduce` functions are referenced but not in dependency arrays. Functionally works because the functions are stable (defined at component level without deps that change). | Existing eslint-disable comments indicate intentional design; changing deps could cause infinite re-render loops |
| 2 | `HolidayPlannerPage.tsx:150-154` | Low | `useEffect` depends on `selectedEvent` object reference but the comparison `selectedEvent` could trigger on every re-render if events list is refreshed. Currently mitigated because `setSelectedEvent` is only called on user click. | Not a practical bug given current usage patterns |
| 3 | `useSchoolMenu.ts:100-108` | Low | `useSchoolMenuCalendar` has no `enabled` guard on optional `startDate`/`endDate` params, so it fires the query even when both are undefined. | The API may intentionally support calls without date params (returning defaults). Cannot confirm without API source. |
| 4 | `DiagnosticsPage.tsx:60-66` | Low | `cleanupDuplicates` groups meals by exact `name` match which is case-sensitive. "Spaghetti" and "spaghetti" would not be detected as duplicates. | This is a design choice, not a clear bug. Case-insensitive matching could have unintended side effects. |
| 5 | `BentoPage.tsx:94` | Low | Next Monday calculation: when today is already Monday, `(8 - 1) % 7 = 0` sets the date to today rather than next Monday. | This is arguably correct behavior (plan the current week on Monday). Changing it would be a UX preference, not a bug fix. |

## Files Reviewed (clean)
- `/Users/adrianstier/meal-planning/client/src/pages/PricingPage.tsx` -- Static presentational page, no logic bugs
- `/Users/adrianstier/meal-planning/client/src/pages/ProfilePage.tsx` -- Well-structured form with proper guards
- `/Users/adrianstier/meal-planning/client/src/pages/SchoolMenuPage.tsx` -- Clean implementation with proper error handling
- `/Users/adrianstier/meal-planning/client/src/hooks/useLeftovers.ts` -- Standard React Query hooks, no issues
- `/Users/adrianstier/meal-planning/client/src/hooks/useSchoolMenu.ts` -- Clean (one minor note above)
- `/Users/adrianstier/meal-planning/client/src/hooks/useRestaurants.ts` -- Standard React Query hooks, no issues
- `/Users/adrianstier/meal-planning/client/src/hooks/useShopping.ts` -- Standard React Query hooks, no issues
- `/Users/adrianstier/meal-planning/client/src/components/RestaurantMap.tsx` -- Proper null guards on coordinates
- `/Users/adrianstier/meal-planning/client/src/components/StarRating.tsx` -- Clean, well-structured component
