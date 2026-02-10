# State Machine Analysis -- Bug Bash Report

**Analyst:** Wave 4 State Machine Agent
**Files Analyzed:**
- `client/src/pages/PlanPageEnhanced.tsx` (1710 lines, 2 useReducers + 8 useState)
- `client/src/pages/RecipesPage.tsx` (1683 lines, 20 useState)
- `client/src/pages/SeasonalCookingPage.tsx` (1680 lines, 20+ useState)
- `client/src/pages/HolidayPlannerPage.tsx` (1100 lines, 12 useState)

---

## Bugs Fixed

| # | File:Line | Severity | Description | Fix Applied |
|---|-----------|----------|-------------|-------------|
| 1 | PlanPageEnhanced.tsx:583 | Medium | `handleMoveMeal` is a silent no-op but reachable from MealCard dropdown "Move to different slot" button. User clicks, nothing happens, no feedback. | Added `alert()` with workaround message instead of empty function body |
| 2 | PlanPageEnhanced.tsx:588 | Medium | `handleSwapMeal` is a silent no-op but reachable from MealCard dropdown "Swap with another meal" button. Same silent failure. | Added `alert()` with workaround message instead of empty function body |
| 3 | RecipesPage.tsx:248 | Medium | `processParseResult` captures stale `formData` via closure. If form has been edited before URL parse completes, stale fields leak into the result. | Changed `setFormData({...formData, ...})` to `setFormData(prev => ({...prev, ...}))` |
| 4 | RecipesPage.tsx:201 | Medium | Same stale closure in `handleParseRecipe` -- `formData` captured at function creation time. | Changed to functional update `setFormData(prev => ...)` |
| 5 | RecipesPage.tsx:354 | Low | Same stale closure in `handleParseFromImage` fallback path. | Changed to functional update `setFormData(prev => ...)` |
| 6 | RecipesPage.tsx:1437 | Medium | View dialog `onOpenChange` does not clear `selectedMeal`. Stale meal data persists and can flash when opening delete/tag dialogs that also use `selectedMeal`. | Added `setSelectedMeal(null)` in onOpenChange when closing |
| 7 | RecipesPage.tsx:1563 | Medium | Delete dialog `onOpenChange` does not clear `selectedMeal` on close. If user cancels delete then clicks a different recipe's tag button, the wrong meal could be tagged. | Added `setSelectedMeal(null)` in onOpenChange when closing |
| 8 | RecipesPage.tsx:1587 | Low | Bulk tag dialog `onOpenChange` does not clear `bulkTagInput` on close. Reopening the dialog for a different recipe shows stale tag input text. | Added `setBulkTagInput('')` in onOpenChange when closing |
| 9 | RecipesPage.tsx:1073 | Low | Parse text dialog `onOpenChange` does not clear `recipeText` on close. Reopening shows stale text from previous parse attempt. | Added `setRecipeText('')` in onOpenChange when closing |
| 10 | HolidayPlannerPage.tsx:98 | Medium | `loading` state is set but never read (`const [, setLoading]`). Template application provides zero loading feedback -- user can click multiple templates with no indication anything is happening. | Restored `loading` variable and added loading spinner + disabled state to template cards |

---

## TODO Stubs Audited

| # | File:Line | Reachable? | Safe? | Notes |
|---|-----------|------------|-------|-------|
| 1 | PlanPageEnhanced.tsx:441 | Yes, via Cmd/Ctrl+Z keyboard shortcut | Safe (no crash) | `handleUndo` only updates `historyIndex` state, no actual undo logic. The history index decrements but nothing is restored. Harmless but misleading -- user expects undo. Not fixed (feature not implemented). |
| 2 | PlanPageEnhanced.tsx:451 | Yes, via Cmd/Ctrl+Shift+Z keyboard shortcut | Safe (no crash) | Same as undo -- `handleRedo` updates index only. Harmless. |
| 3 | PlanPageEnhanced.tsx:458 | No | Safe | `toggleCuisine` is defined but no UI element calls it. The `selectedCuisines` state is used in `handleGenerateWeek` but the filter UI doesn't exist yet. The eslint-disable is justified. |
| 4 | PlanPageEnhanced.tsx:565 | No | Safe | `handlePasteMeal` is defined but no UI element calls it. The "copy meal" flow shows a toast saying "click any empty slot to paste" but empty slots don't have paste click handlers. Misleading UX but no crash. |
| 5 | PlanPageEnhanced.tsx:583 | **Yes** | **Fixed** | `handleMoveMeal` was called from MealCard's "Move" dropdown item. Was a silent no-op. Now shows alert with workaround. |
| 6 | PlanPageEnhanced.tsx:588 | **Yes** | **Fixed** | `handleSwapMeal` was called from MealCard's "Swap" dropdown item. Was a silent no-op. Now shows alert with workaround. |
| 7 | PlanPageEnhanced.tsx:429 | Yes, internally | Safe | `saveToHistory` is called from `confirmDeleteMeal` but the history it saves is never used by undo/redo (which are also stubs). No crash risk. |

---

## State Transitions Verified

| Page | States Checked | Issues |
|------|---------------|--------|
| PlanPageEnhanced | Dialog reducer (5 dialogs), meal selection reducer (5 fields), loading/error from React Query, generatedPlan lifecycle | **Clean.** Dialog open/close properly paired. `CLOSE_ALL` action exists for safety. Selected slot/meal/pendingDelete properly cleared on dialog close via onOpenChange handlers. React Query handles loading/error states automatically. Generated plan cleared on dialog close. |
| RecipesPage | 8 dialog open states, selectedMeal shared across 4 dialogs, formData/isEditing/parsedRecipe lifecycle, selectMode/selectedMealIds | **Fixed 5 issues.** (1) `selectedMeal` was not cleared when view/delete/bulkTag dialogs closed, risking stale data cross-contamination. (2) `bulkTagInput` not cleared on dialog close. (3) `recipeText` not cleared on parse dialog close. (4-5) Stale `formData` closures in 3 parse handlers. After fixes: all dialog close handlers properly reset associated state. |
| SeasonalCookingPage | showAddBox/showAddItem/showAIParser modals, AI parsing state (aiParsing/aiParseError/parsedResult/parsedItems), allItems/boxes/selectedBox data loading | **Mostly clean.** `resetAIParser()` properly resets all AI parsing state. Modal close handlers reset form state. Loading states (`aiParsing`, `loadingRecipes`) properly set/cleared in try/finally. One concern: the `loadBoxes`/`loadAllProduce` functions are called without error recovery UI -- network failures silently fail. Not a crash but poor UX. |
| HolidayPlannerPage | showCreateEvent/showAddDish/showAddGuest/showTemplates dialogs, selectedEvent, dishes/guests/timeline data, toast state, loading state | **Fixed 1 issue.** `loading` state was set but never rendered. After fix: template dialog shows loading spinner and disables cards. Form reset properly happens in all create/add handlers. Toast state properly managed. |

---

## eslint-disable Audit

| # | File:Line | Rule | Safe? | Notes |
|---|-----------|------|-------|-------|
| 1 | PlanPageEnhanced.tsx:459 | `@typescript-eslint/no-unused-vars` | **Safe** | `toggleCuisine` is a fully implemented function awaiting UI wiring. It correctly uses `setSelectedCuisines` which is already consumed by `handleGenerateWeek`. When the cuisine filter UI is added, removing the eslint-disable and wiring the function will work without changes. |
| 2 | PlanPageEnhanced.tsx:566 | `@typescript-eslint/no-unused-vars` | **Safe but misleading UX** | `handlePasteMeal` is fully implemented but not wired to any UI. The `handleCopyMeal` function shows a toast telling users to "click any empty slot to paste" but the paste handler is never attached to empty slots. The code itself is safe -- it won't crash -- but the copy toast message promises functionality that doesn't exist. Recommend either wiring paste to SmartDropZone click, or changing the toast message to just "Meal copied!" without the paste instruction. |
| 3 | SeasonalCookingPage.tsx:118 | `@typescript-eslint/no-unused-vars` | **Safe** | `navigate` from `useNavigate()` is used in the child `RecipeMatchCard` component (line 1579) but not in the parent component. The import at the parent level appears unused because the sub-component re-imports it. The parent-level suppress is safe to keep -- removing `navigate` from the parent would not break anything but the pattern is consistent. |
| 4 | SeasonalCookingPage.tsx:209 | `react-hooks/exhaustive-deps` | **Safe (intentional)** | Mount-only effect (`[]` deps) that loads initial data. `loadBoxes` and `loadAllProduce` are stable async functions that don't depend on component state. Running them only once on mount is correct behavior. Adding them to deps would cause infinite re-renders since they call `setBoxes`/`setAllItems` which would recreate the functions (they're not wrapped in useCallback). |
| 5 | SeasonalCookingPage.tsx:231 | `react-hooks/exhaustive-deps` | **Mostly safe, minor risk** | Effect depends on `[unusedItems.length, selectedSeasonalItems.size]` but `findRecipesForProduce` is missing from deps. Since `findRecipesForProduce` reads `unusedItems` and `selectedSeasonalItems` from closure, and those are derived from `allItems` state, there's a theoretical stale closure: if `allItems` changes but `unusedItems.length` stays the same, the function would use stale data. In practice this is unlikely since item changes almost always change the count. The 500ms debounce timer mitigates rapid re-fires. **Low risk, acceptable.** |

---

## Additional Observations (Not Fixed -- No Crash Risk)

### PlanPageEnhanced.tsx
1. **Copy-paste UX mismatch (line 555):** The toast from `handleCopyMeal` says "Click any empty slot to paste" but `handlePasteMeal` (line 567) is not wired to any UI. Users see the instruction but paste never works. Recommend changing toast text to remove the paste instruction until the feature is wired up.

2. **Undo/Redo keyboard shortcuts bound but non-functional:** `Cmd+Z` and `Cmd+Shift+Z` are captured and call `handleUndo`/`handleRedo`, which update `historyIndex` but perform no actual undo/redo operations. The history is recorded via `saveToHistory` from `confirmDeleteMeal` but never replayed. This is safe (no crash) but the keyboard shortcuts are intercepted from their normal browser behavior for no benefit.

3. **Keyboard shortcut 'G' triggers AI generation without confirmation:** Pressing 'G' anywhere (outside input fields) immediately calls `handleGenerateWeek`, which hits the AI API. No confirmation dialog or throttling. Could be surprising if user accidentally presses 'G'.

### RecipesPage.tsx
4. **`selectedMeal` shared across 4 dialog types:** The same `selectedMeal` state is used by view dialog, edit dialog, delete dialog, and bulk tag dialog. Before this fix, closing one dialog without clearing `selectedMeal` meant the next dialog opened could show the wrong meal's data. The fixes add proper cleanup, but a better architecture would use separate state per dialog or a discriminated union.

### SeasonalCookingPage.tsx
5. **No loading state for initial data fetch:** `loadBoxes()` and `loadAllProduce()` run on mount but there's no loading indicator shown while they're in progress. The page renders with empty state briefly before data arrives.

6. **`addItem` requires `selectedBox` but "Add Produce" button is always visible:** The button to add individual items is shown regardless of whether a box is selected. The form submission silently returns if `!selectedBox`. There is a warning message at the bottom of the form, but it could be missed.

### HolidayPlannerPage.tsx
7. **`selectedEvent` useEffect with missing dependency:** Line 150-154 has `useEffect(() => { if (selectedEvent) { loadEventDetails(selectedEvent.id); } }, [selectedEvent])` -- `loadEventDetails` is not in deps. Since `loadEventDetails` is a stable function (no deps on state that changes), this works in practice but is technically incorrect per React rules.

8. **`deleteEvent` uses `window.confirm`:** While functional, this blocks the main thread and is inconsistent with the rest of the app which uses `Dialog` components for confirmations.
