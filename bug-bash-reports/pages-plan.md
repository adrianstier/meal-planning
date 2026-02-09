# Plan & Meal Pages -- Bug Bash Report

## Bugs Fixed
| # | File:Line | Severity | Description | Fix Applied |
|---|-----------|----------|-------------|-------------|
| 1 | `client/src/hooks/usePlan.ts:8-20` | High | `getWeekStart()` computed Monday as week start, but the app uses Sunday (`weekStartsOn: 0` in date-fns). This caused `useAddPlanItem` and `useUpdatePlanItem` cache invalidation to target the wrong React Query key, meaning the UI would not refresh after adding or updating a plan item. | Changed the function to compute Sunday instead of Monday by using `date.getDate() - dayOfWeek` instead of the Monday-oriented formula. |
| 2 | `client/src/components/features/plan/AddMealDialog.tsx:55-58` | Medium | `filteredMeals` compared `meal.meal_type === mealType`, but when `mealType` is `morning_snack` or `afternoon_snack`, no meals would ever match since the database `meal_type` only has `snack` (not `morning_snack`/`afternoon_snack`). This meant the AddMealDialog showed zero meals when opened for snack slots. | Added normalization: `morning_snack` and `afternoon_snack` are mapped to `snack` before comparison. |
| 3 | `client/src/components/features/plan/AddMealDialog.tsx:118` | Low | Dialog title showed "Add Morning_snack" or "Add Afternoon_snack" (with underscore) when `mealType` was `morning_snack` or `afternoon_snack`, because the naive `charAt(0).toUpperCase() + slice(1)` doesn't handle underscores. | Added explicit mapping for `morning_snack` -> "Morning Snack" and `afternoon_snack` -> "Afternoon Snack". |
| 4 | `client/src/components/features/plan/MealCard.tsx:89-103` | Medium | When `onDelete` and `onCopy`/`onMove`/`onSwap` were all provided (which they are in PlanPageEnhanced), both a standalone delete button (absolute top-0.5 right-0.5) and a dropdown menu trigger (absolute top-1 right-1) rendered overlapping at the same position, both with `z-10`. This caused click confusion and visual overlap. | Changed the standalone delete button to only render when the dropdown menu is NOT present (`!(onCopy || onMove || onSwap)`). The dropdown menu already includes a delete option. |
| 5 | `client/src/pages/PlanPageEnhanced.tsx:226` | Low | `mealDisplayMode` was saved to `localStorage` on change (line 312) but never loaded from `localStorage` on initialization -- always defaulting to `'dinners'`. User preference was lost on page refresh. | Added `localStorage` initializer matching the pattern used by `viewMode`. |
| 6 | `client/src/pages/PlanPageEnhanced.tsx:239` | Low | `recipeBrowserOpen` was saved to `localStorage` on change (line 317) but never loaded from `localStorage` on initialization -- always defaulting to `true`. User preference was lost on page refresh. | Added `localStorage` initializer with proper boolean parsing. |

## Issues Noted (not fixed)
| # | File:Line | Severity | Description | Reason Not Fixed |
|---|-----------|----------|-------------|-----------------|
| 1 | `client/src/pages/PlanPage.tsx:76` | Low | `organized[meal.plan_date][meal.meal_type].push(meal)` could crash if `meal.meal_type` was an unexpected value not in the initialized keys. | TypeScript type constrains `meal_type` to known values; runtime risk is extremely low. |
| 2 | `client/src/pages/PlanPageEnhanced.tsx:432-438` | Info | `handleUndo` checks `currentIndex > 0` but the first undoable action is at index 0. Undo at index 0 would not work. | The undo/redo feature is explicitly marked as TODO/unimplemented, so no real user-facing bug. |
| 3 | `client/src/components/features/plan/MealCard.tsx:159-163` | Info | `renderBadges()` is called twice per render (once for `.length > 0` check, once for rendering), creating two arrays. | Performance inefficiency, not a functional bug. |
| 4 | `client/src/pages/RecipesPage.tsx:248-260` | Info | `processParseResult` uses `formData` from closure via `{ ...formData, ... }`. Since it's a plain function (not `useCallback`), it re-creates each render and captures current state. | Not a stale closure bug; plain functions capture current render state. |

## Files Reviewed (clean)
- `client/src/pages/PlanPage.tsx` -- no bugs found (legacy page, simpler logic)
- `client/src/pages/RecipesPage.tsx` -- no bugs found
- `client/src/hooks/useMeals.ts` -- no bugs found
- `client/src/components/features/plan/CompactDayCard.tsx` -- no bugs found
- `client/src/components/features/plan/EmptyMealSlot.tsx` -- no bugs found
- `client/src/components/features/plan/PlanSkeleton.tsx` -- no bugs found
- `client/src/components/features/plan/RecipeBrowserSidebar.tsx` -- no bugs found
- `client/src/components/features/plan/SmartDropZone.tsx` -- no bugs found
- `client/src/components/features/plan/WeeklyVarietySummary.tsx` -- no bugs found
- `client/src/components/features/recipes/RecipeParsingProgress.tsx` -- no bugs found
- `client/src/contexts/DragDropContext.tsx` -- no bugs found
