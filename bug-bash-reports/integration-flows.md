# Integration Flows -- Bug Bash Report

## Flow 1: Recipe Parsing -> Save -> Display

### Data Path
1. User enters a URL in `RecipesPage.tsx` and clicks "Import Recipe"
2. `handleParseFromUrlAI()` calls `parseRecipeFromUrlAI.mutateAsync(recipeUrl)` (useMeals hook)
3. Hook calls `mealsApi.parseRecipeFromUrlAI(url)` in `api.ts` line 792
4. `api.ts` calls `invokeWithTimeout<Meal>('parse-recipe-url-ai', { url })` which does a direct `fetch()` to the Supabase Edge Function
5. Edge function `parse-recipe-url-ai/index.ts` fetches the page HTML, extracts JSON-LD and content, calls Claude AI, and returns a `ParsedRecipe` object
6. Response returns to `RecipesPage.tsx` via `result.data`
7. `processParseResult(parsedData)` converts ingredients array to string and instructions array to string, then populates `formData`
8. User reviews in the Add/Edit dialog and clicks "Add Recipe"
9. `handleSubmit()` calls `createMeal.mutateAsync(formData)` which calls `mealsApi.create(meal)` which does a Supabase `.insert()` into the `meals` table

### Issues Found

1. **`kid_friendly_level` field lost in translation (Low severity)**: The edge functions (`parse-recipe`, `parse-recipe-url-ai`, `parse-recipe-image`) all return `kid_friendly_level` (1-10 scale). The DB `meals` table has both `kid_friendly_level` and `kid_rating` columns. The frontend `Meal` type only has `kid_rating`. When the parsed recipe goes through `processParseResult()` in `RecipesPage.tsx`, the `kid_friendly_level` field is not mapped to the form data. Then when saved via `mealsApi.create()`, since `formData` does not include `kid_friendly_level`, the AI-extracted kid-friendliness value is silently dropped. The `kid_friendly_level` column still receives its default value of 5. This is not a crash bug but the AI's assessment of kid-friendliness is wasted.

2. **`makes_leftovers` and `leftover_days` fields dropped (Low severity)**: Edge functions return these fields but `processParseResult()` and the form data do not capture or forward them. They are saved to the DB with their defaults instead of the AI-extracted values.

3. **`nutrition fields` (calories, protein_g, etc.) dropped (Low severity)**: Same pattern -- the AI extracts nutrition data but the frontend form does not capture these fields. They end up as NULL in the DB even when the AI successfully extracted them.

4. **`prep_time_minutes` returned but not mapped (Low severity)**: Edge functions return `prep_time_minutes` separately from `cook_time_minutes`. The frontend `Meal` type does not have `prep_time_minutes` (only `cook_time_minutes`), so the prep time is silently dropped. The DB schema does have a `prep_time_minutes` column.

**Summary**: The edge functions extract significantly more data than the frontend form captures. None of these cause crashes, but valuable AI-extracted data (kid-friendliness, nutrition, leftover settings, prep time) is consistently dropped at the `RecipesPage.processParseResult()` boundary because the form only maps a subset of fields.

## Flow 2: Meal Plan Generation -> Display -> Edit

### Data Path
1. User clicks "Generate" in `PlanPageEnhanced.tsx` line 1302
2. `handleGenerateWeek()` calls `generateWeekPlan.mutateAsync(...)` (usePlan hook)
3. Hook calls `planApi.generateWeek(startDate, numDays, mealTypes, ...)` in `api.ts` line 1053
4. `generateWeek()` fetches meals from DB filtered by meal_type and cuisine, shuffles them, and builds a `GeneratedMealPlanItem[]` array with `{ meal_id, date, meal_type, meal_name }`
5. Response sets `generatedPlan` state and opens the review dialog
6. User clicks "Apply to Schedule" which calls `handleApplyPlan()` -> `applyGeneratedPlan.mutateAsync(generatedPlan)`
7. Hook calls `planApi.applyGenerated(plan)` in `api.ts` line 1138
8. `applyGenerated()` inserts into `scheduled_meals` with `meal_id, meal_date, meal_type, day_of_week`
9. `onSuccess` invalidates `['plan']` query keys, which re-fetches `planApi.getWeek()`
10. `getWeek()` queries `scheduled_meals` joined with `meals`, transforms via `transformScheduledMealToMealPlan()`
11. `PlanPageEnhanced.tsx` organizes meals by date in `mealsByDate` useMemo

### Issues Found

1. **`day_of_week` computed correctly**: Both `planApi.add()` (line 954) and `planApi.applyGenerated()` (line 1147) use `parseISO(date).toLocaleDateString('en-US', { weekday: 'long' })` to compute `day_of_week`. This correctly parses YYYY-MM-DD as local time (since `parseISO` from date-fns returns a local Date from an ISO string without timezone info). No bug here.

2. **Date format consistency**: Dates flow as `yyyy-MM-dd` strings consistently through the entire path. `toLocalDateString()` helper in `api.ts` is used correctly to avoid UTC midnight issues. No bug here.

3. **Cache invalidation works correctly**: `useApplyGeneratedPlan` invalidates `['plan']` which covers all week queries. `useAddPlanItem` smartly invalidates only the specific week via `getWeekStart(variables.plan_date)`. `useDeletePlanItem` invalidates all `['plan']` queries (broader but safe). No bug here.

4. **`meal_plan_id` is NULL for all generated meals (Cosmetic, no impact)**: The `scheduled_meals` table has a `meal_plan_id` FK to `meal_plans`, but none of the `planApi` functions ever create or reference a `meal_plans` record. All scheduled meals have `meal_plan_id = NULL`. This is harmless since the FK is nullable, but the `meal_plans` table is essentially unused.

**Summary**: Flow 2 is well-implemented with no data integrity or display bugs. Date handling is correct and timezone-safe throughout.

## Flow 3: Shopping List -> Display -> Check Off

### Data Path
1. User clicks "Shop" in `PlanPageEnhanced.tsx` line 1311
2. `handleGenerateShoppingList()` calls `generateShoppingList.mutateAsync({ startDate, endDate })`
3. Hook calls `shoppingApi.generateFromPlan(startDate, endDate)` in `api.ts` line 1718
4. **IMPORTANT**: This does NOT call the `generate-shopping-list` edge function. It does client-side ingredient parsing:
   - Fetches `scheduled_meals` joined with `meals(ingredients)` for the date range
   - Parses ingredient text line by line with regex
   - Guesses category from ingredient name keywords
   - Inserts into `shopping_items` table
5. `useShopping.ts` `onSuccess` invalidates `['shopping']` query key
6. `ListsPage.tsx` fetches via `useShoppingItems()` -> `shoppingApi.getAll()`
7. Items are grouped by `is_purchased`, then active items grouped by `category`
8. `categoryOrder` defines preferred display order; known categories appear first, extras alphabetically

### Issues Found -- FIXED

1. **FIXED: Category mismatch between generator and display (Medium severity)**: The client-side `generateFromPlan()` produced categories using one naming scheme (`'Dairy'`, `'Fruits'`, `'Vegetables'`, `'Grains & Bread'`, `'Spices'`, `'Condiments'`, `'Canned Goods'`) while `ListsPage.tsx` expected a different scheme (`'Produce'`, `'Dairy & Eggs'`, `'Bakery'`, `'Pantry'`). Only `'Meat & Seafood'`, `'Frozen'`, and `'Other'` matched between the two. This meant most items fell into the "extra categories" bucket and displayed in alphabetical sort instead of the intended grocery-aisle order.

   **Fix applied**: Updated the category assignment in `api.ts` `generateFromPlan()` to use the same category names that `ListsPage.tsx` expects (`'Produce'`, `'Dairy & Eggs'`, `'Bakery'`, `'Pantry'`, etc.). Also updated `ListsPage.tsx` to include legacy category names in the order array for backwards compatibility with previously-generated items.

2. **AI shopping list edge function is unused (Low severity, architectural note)**: The `generate-shopping-list` edge function exists and does intelligent AI-powered ingredient combining (e.g., "2 cups flour" + "1 cup flour" = "3 cups flour") with Claude. But the frontend never calls it. Instead, `shoppingApi.generateFromPlan()` does basic client-side parsing that does NOT combine duplicate ingredients (line 1762: "for now just skip"). The `ListsPage.tsx` tips section (line 295) claims "Smart combining: Duplicate ingredients are combined" but this is not actually true for the client-side implementation.

3. **Quantity data type preserved correctly**: `shopping_items.quantity` is TEXT in both the DB schema and the `ShoppingItem` type. The client-side generator stores the regex-extracted quantity string directly. No type mismatch.

4. **Toggle purchased works correctly**: `useToggleShoppingItem` calls `shoppingApi.togglePurchased(id, currentValue)` which does an atomic `!currentValue` update. Correct.

## Flow 4: Drag-and-Drop

### Data Path
1. User drags a meal from `RecipeBrowserSidebar.tsx` or `RecipesPage.tsx`
2. `onDragStart` calls `setDraggedRecipe({ meal, sourceType: 'recipes' })` in `DragDropContext`
3. Also sets `e.dataTransfer.setData('application/json', JSON.stringify(meal))` as fallback
4. Drop target is `SmartDropZone`, `CompactDayCard`, or the day card div in `PlanPageEnhanced`
5. `onDrop` calls `handleDrop(date, mealType, e)` in `PlanPageEnhanced.tsx` line 265
6. `handleDrop` reads `draggedRecipe?.meal` from context, or falls back to parsing `e.dataTransfer.getData('application/json')`
7. Maps frontend meal types to backend types via `mealTypeMap` (line 292-298)
8. Calls `addPlanItem.mutateAsync({ meal_id, plan_date, meal_type })`
9. Which calls `planApi.add()` -> inserts into `scheduled_meals`
10. Cache invalidation via `getWeekStart(plan_date)`

### Issues Found

1. **Drag data format is correct**: Both `RecipeBrowserSidebar` and `RecipesPage` set the same drag data format -- the full `Meal` object as JSON via `dataTransfer.setData('application/json', JSON.stringify(meal))`. The `handleDrop` handler in `PlanPageEnhanced` validates the parsed data with `validateMealFromDrag()` which checks for `id: number` and `name: string`. This is sufficient.

2. **Meal type mapping is correct and consistent**: `handleDrop` (line 292-298) maps `morning_snack` -> `'snack'` and `afternoon_snack` -> `'snack'`, which matches the DB's `meal_type` values. `AddMealDialog` (line 94-98) does the same mapping. `SmartDropZone` delegates to the parent's `onDrop` so it uses the same mapping.

3. **Cache invalidation is correct**: `useAddPlanItem.onSuccess` computes `getWeekStart(variables.plan_date)` to invalidate only the affected week's cache. The `getWeekStart()` function correctly parses dates as local timezone (line 11: splits string to avoid UTC).

4. **DragDropContext cleanup is correct**: `onDragEnd` sets `setDraggedRecipe(null)` in both `RecipeBrowserSidebar` and `RecipesPage`, preventing stale drag state.

**Summary**: Flow 4 is well-implemented with no bugs. Data formats match, type mapping is consistent, and cache invalidation is correctly scoped.

## Bugs Fixed

| # | File:Line | Severity | Description | Fix Applied |
|---|-----------|----------|-------------|-------------|
| 1 | `client/src/lib/api.ts`:1769-1778 | Medium | Shopping list category names (`Dairy`, `Fruits`, `Vegetables`, `Grains & Bread`, `Spices`, `Condiments`, `Canned Goods`) did not match `ListsPage.tsx` display order (`Produce`, `Dairy & Eggs`, `Bakery`, `Pantry`), causing items to display in wrong order | Updated category names in `generateFromPlan()` to match `ListsPage.tsx` expected categories: `Dairy` -> `Dairy & Eggs`, `Fruits`/`Vegetables` -> `Produce`, `Grains & Bread`/`Spices`/`Condiments`/`Canned Goods` -> `Pantry` or `Bakery`, added `Beverages` |
| 2 | `client/src/pages/ListsPage.tsx`:84 | Low | `categoryOrder` did not include legacy category names, so any previously-generated items with old names would not sort in grocery-aisle order | Added legacy category names (`Vegetables`, `Fruits`, `Dairy`, `Grains & Bread`, `Spices`, `Condiments`, `Canned Goods`) to the `categoryOrder` array for backwards compatibility |

## Cross-Boundary Issues Noted

| # | Boundary | Issue | Impact |
|---|----------|-------|--------|
| 1 | Edge Functions -> Frontend (Recipe Parsing) | Edge functions return `kid_friendly_level`, `makes_leftovers`, `leftover_days`, `prep_time_minutes`, and nutrition fields that the frontend `processParseResult()` does not capture | AI-extracted data is silently dropped; DB columns remain at defaults |
| 2 | Edge Function `generate-shopping-list` -> Frontend | The AI-powered shopping list edge function exists but is never called; frontend uses basic client-side parsing instead | Advertised "smart combining" of duplicate ingredients does not actually work |
| 3 | `ListsPage.tsx` Tips -> `shoppingApi.generateFromPlan()` | Tips section claims "Duplicate ingredients are combined" but the client-side generator explicitly skips duplicates (line 1762 comment: "for now just skip") | User sees misleading documentation |
| 4 | `meal_plans` table -> `scheduled_meals` | The `meal_plans` table is never used; all scheduled meals have `meal_plan_id = NULL` | Dead schema -- no functional impact but adds confusion |
| 5 | DB `kid_friendly_level` column vs `kid_rating` column | DB has two separate kid-related columns; edge functions write to `kid_friendly_level` via AI but frontend reads `kid_rating` (user-set); they serve different purposes but naming is confusing | No data corruption, but the two columns could be unified or the frontend could display both |
