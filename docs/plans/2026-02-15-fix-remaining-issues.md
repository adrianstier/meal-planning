# Fix All 6 Remaining Issues — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the 6 remaining concerns from the bug bash — nutrition data flow, AI shopping list, dead schema, orchestrator wiring, phantom endpoints, and needsAI propagation.

**Architecture:** Six independent workstreams that can be parallelized. Each touches different files with minimal overlap. W6 and W2 both touch api.ts but at different locations (lines ~160 vs ~1762).

**Tech Stack:** React 19, TypeScript, Supabase Edge Functions (Deno), TanStack Query, Tailwind/shadcn

---

## Task 1: Fix needsAI Propagation (W6)

**Files:**
- Modify: `client/src/lib/api.ts:159-169`

**Step 1: Fix directEdgeFunctionFetch error handling**

In `client/src/lib/api.ts`, find the `!response.ok` block at line 159 and replace it. The current code creates a plain `Error` without attaching `responseBody` or `status`, so the `needsAI` check at line 766 always fails.

Replace lines 159-169:
```typescript
    if (!response.ok) {
      const errorText = await response.text();
      devError(`[directEdgeFunctionFetch] Error response: ${errorText}`);
      let errorMessage = `Edge function error: ${response.status}`;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error || errorMessage;
      } catch {
        if (errorText) errorMessage = errorText;
      }
      return { data: null, error: new Error(errorMessage) };
    }
```

With:
```typescript
    if (!response.ok) {
      const errorText = await response.text();
      devError(`[directEdgeFunctionFetch] Error response: ${errorText}`);
      let errorMessage = `Edge function error: ${response.status}`;
      let responseBody: Record<string, unknown> | undefined;
      try {
        const errorJson = JSON.parse(errorText);
        responseBody = errorJson;
        errorMessage = errorJson.error || errorMessage;
      } catch {
        if (errorText) errorMessage = errorText;
      }
      const error: EdgeFunctionError = new Error(errorMessage);
      error.status = response.status;
      error.responseBody = responseBody;
      return { data: null, error };
    }
```

**Step 2: Verify build**

Run: `cd /Users/adrianstier/meal-planning/client && npm run build`
Expected: PASS with zero warnings

**Step 3: Commit**

```bash
git add client/src/lib/api.ts
git commit -m "Fix needsAI propagation: attach responseBody and status to EdgeFunctionError"
```

---

## Task 2: Remove Phantom Endpoint Client Code (W5)

**Files:**
- Modify: `client/src/lib/api.ts:2097-2156` (remove 3 functions)
- Modify: `client/src/hooks/useRestaurants.ts:66-88` (remove 3 hooks)
- Modify: `client/src/pages/RestaurantsPage.tsx` (remove handlers, imports, UI)

**Step 1: Remove phantom API functions from api.ts**

Delete `restaurantsApi.search()` (lines 2097-2105), `restaurantsApi.scrape()` (lines 2107-2115), and `restaurantsApi.geocode()` (lines 2148-2156) from `client/src/lib/api.ts`.

**Step 2: Remove phantom hooks from useRestaurants.ts**

Delete `useScrapeRestaurant` (lines 66-76), `useGeocodeAddress` (lines 78-82), and `useSearchRestaurant` (lines 84-88) from `client/src/hooks/useRestaurants.ts`.

**Step 3: Remove phantom UI from RestaurantsPage.tsx**

In `client/src/pages/RestaurantsPage.tsx`:
1. Remove imports: `useGeocodeAddress`, `useSearchRestaurant` from import on line 31-32
2. Remove hook instantiations: `searchRestaurant` (line 82) and `geocodeAddress` (line 83)
3. Remove `searchQuery` state (find its useState declaration)
4. Remove `handleGeocode` function (lines 171-188)
5. Remove `handleSearch` function (lines 284-319)
6. Remove the "Find Restaurant" search UI section (lines ~615-651) — the search input + button + "or enter details manually" link
7. Remove the "Get Coords" button from the address field (lines 677-685)
8. If `Navigation` or `Sparkles` icons are now unused, remove their imports

**Step 4: Verify build**

Run: `cd /Users/adrianstier/meal-planning/client && npm run build`
Expected: PASS with zero warnings

**Step 5: Commit**

```bash
git add client/src/lib/api.ts client/src/hooks/useRestaurants.ts client/src/pages/RestaurantsPage.tsx
git commit -m "Remove phantom endpoint client code: search-restaurant, scrape-restaurant, geocode-address"
```

---

## Task 3: Remove meal_plans Table (W3)

**Files:**
- Modify: `supabase/schema.sql:137-148` (remove meal_plans table)
- Modify: `supabase/schema.sql:157` (remove meal_plan_id FK from scheduled_meals)
- Modify: `supabase/rls_policies.sql` (remove meal_plans policy)
- Create: `supabase/migrations/20260215_remove_meal_plans.sql`

**Step 1: Create migration file**

Create `supabase/migrations/20260215_remove_meal_plans.sql`:
```sql
-- Remove unused meal_plans table and its FK from scheduled_meals
-- The meal_plans table has zero references in application code.
-- All weekly planning uses scheduled_meals directly.

ALTER TABLE public.scheduled_meals DROP COLUMN IF EXISTS meal_plan_id;
DROP TABLE IF EXISTS public.meal_plans CASCADE;
```

**Step 2: Update schema.sql**

In `supabase/schema.sql`:
1. Remove the entire "6. MEAL PLANS" section (lines 133-148)
2. Remove `meal_plan_id INTEGER REFERENCES public.meal_plans(id) ON DELETE CASCADE,` from the `scheduled_meals` table (line 157)

**Step 3: Update rls_policies.sql**

Remove the `meal_plans` RLS policy (the "Users can manage own meal plans" policy around lines 100-106).

**Step 4: Commit**

```bash
git add supabase/schema.sql supabase/rls_policies.sql supabase/migrations/20260215_remove_meal_plans.sql
git commit -m "Remove unused meal_plans table and meal_plan_id FK from scheduled_meals"
```

---

## Task 4: Wire Up Nutrition Data Flow (W1)

**Files:**
- Modify: `client/src/pages/RecipesPage.tsx` (formData, parse handlers, form UI)

**Step 1: Add nutrition fields to formData state**

In `RecipesPage.tsx`, update the formData initialization (line 99-109) to include nutrition:
```typescript
const [formData, setFormData] = useState<Partial<Meal>>({
  name: '',
  meal_type: 'dinner',
  cook_time_minutes: undefined,
  servings: undefined,
  difficulty: 'medium',
  tags: '',
  ingredients: '',
  instructions: '',
  image_url: '',
  calories: undefined,
  protein_g: undefined,
  carbs_g: undefined,
  fat_g: undefined,
  fiber_g: undefined,
});
```

**Step 2: Copy nutrition fields in handleParseRecipe setFormData**

At lines 201-214, add nutrition fields to the `setFormData` call:
```typescript
setFormData(prev => ({
  ...prev,
  name: parsedData.name || '',
  meal_type: parsedData.meal_type || 'dinner',
  cook_time_minutes: parsedData.cook_time_minutes,
  servings: parsedData.servings,
  difficulty: parsedData.difficulty || 'medium',
  tags: parsedData.tags || '',
  ingredients: ingredientsText,
  instructions: instructionsText,
  image_url: parsedData.image_url,
  source_url: parsedData.source_url,
  cuisine: parsedData.cuisine,
  calories: parsedData.calories ?? undefined,
  protein_g: parsedData.protein_g ?? undefined,
  carbs_g: parsedData.carbs_g ?? undefined,
  fat_g: parsedData.fat_g ?? undefined,
  fiber_g: parsedData.fiber_g ?? undefined,
}));
```

**Step 3: Copy nutrition fields in processParseResult setFormData**

At lines 247-260, add the same 5 nutrition fields to the `setFormData` call in `processParseResult()`.

**Step 4: Copy nutrition fields in handleParseFromImage**

At lines 334-345, add nutrition fields to `recipeToSave`:
```typescript
const recipeToSave = {
  name: parsedData.name || 'Untitled Recipe',
  meal_type: parsedData.meal_type || 'dinner',
  cook_time_minutes: parsedData.cook_time_minutes,
  servings: parsedData.servings,
  difficulty: parsedData.difficulty || 'medium',
  tags: parsedData.tags || '',
  ingredients: ingredientsText,
  instructions: instructionsText,
  image_url: parsedData.image_url,
  cuisine: parsedData.cuisine,
  calories: parsedData.calories ?? undefined,
  protein_g: parsedData.protein_g ?? undefined,
  carbs_g: parsedData.carbs_g ?? undefined,
  fat_g: parsedData.fat_g ?? undefined,
  fiber_g: parsedData.fiber_g ?? undefined,
};
```

**Step 5: Add nutrition section to recipe form**

Find the form section in the JSX (after the existing form fields, before the submit button). Add a collapsible nutrition section:

```tsx
{/* Nutrition (auto-filled from parsing) */}
<details className="col-span-2">
  <summary className="text-sm font-medium cursor-pointer text-muted-foreground hover:text-foreground">
    Nutrition Info (optional)
  </summary>
  <div className="grid grid-cols-5 gap-2 mt-2">
    <div>
      <Label htmlFor="calories" className="text-xs">Calories</Label>
      <Input
        id="calories"
        type="number"
        value={formData.calories ?? ''}
        onChange={(e) => setFormData({ ...formData, calories: e.target.value ? Number(e.target.value) : undefined })}
        placeholder="—"
      />
    </div>
    <div>
      <Label htmlFor="protein_g" className="text-xs">Protein (g)</Label>
      <Input
        id="protein_g"
        type="number"
        step="0.1"
        value={formData.protein_g ?? ''}
        onChange={(e) => setFormData({ ...formData, protein_g: e.target.value ? Number(e.target.value) : undefined })}
        placeholder="—"
      />
    </div>
    <div>
      <Label htmlFor="carbs_g" className="text-xs">Carbs (g)</Label>
      <Input
        id="carbs_g"
        type="number"
        step="0.1"
        value={formData.carbs_g ?? ''}
        onChange={(e) => setFormData({ ...formData, carbs_g: e.target.value ? Number(e.target.value) : undefined })}
        placeholder="—"
      />
    </div>
    <div>
      <Label htmlFor="fat_g" className="text-xs">Fat (g)</Label>
      <Input
        id="fat_g"
        type="number"
        step="0.1"
        value={formData.fat_g ?? ''}
        onChange={(e) => setFormData({ ...formData, fat_g: e.target.value ? Number(e.target.value) : undefined })}
        placeholder="—"
      />
    </div>
    <div>
      <Label htmlFor="fiber_g" className="text-xs">Fiber (g)</Label>
      <Input
        id="fiber_g"
        type="number"
        step="0.1"
        value={formData.fiber_g ?? ''}
        onChange={(e) => setFormData({ ...formData, fiber_g: e.target.value ? Number(e.target.value) : undefined })}
        placeholder="—"
      />
    </div>
  </div>
</details>
```

**Step 6: Verify build**

Run: `cd /Users/adrianstier/meal-planning/client && npm run build`
Expected: PASS with zero warnings

**Step 7: Commit**

```bash
git add client/src/pages/RecipesPage.tsx
git commit -m "Wire up nutrition data: pass calories/protein/carbs/fat/fiber from parsed recipes to DB"
```

---

## Task 5: Wire Up AI Shopping List (W2)

**Files:**
- Modify: `client/src/lib/api.ts:1762-1850` (replace generateFromPlan)

**Step 1: Replace client-side shopping list generation with edge function call**

Replace `shoppingApi.generateFromPlan` (lines 1762-1850) with:

```typescript
generateFromPlan: async (startDate: string, endDate: string) => {
  const userId = await getCurrentUserId();

  // Call AI-powered edge function for smart ingredient consolidation
  const { data, error } = await invokeWithTimeout<{
    items: Array<{ name: string; quantity: string; unit: string; category: string; recipe: string; notes: string | null }>;
    byCategory: Record<string, Array<{ name: string; quantity: string; unit: string; category: string; recipe: string; notes: string | null }>>;
    totalItems: number;
    suggestedOrder: string[];
  }>('generate-shopping-list', { startDate, endDate });

  if (error) {
    errorLogger.logApiError(error, '/functions/generate-shopping-list', 'POST');

    // Fall back to simple client-side generation if AI fails
    return shoppingApi._generateFromPlanFallback(startDate, endDate);
  }

  if (!data || !data.items || data.items.length === 0) {
    throw new Error('No items generated. Make sure you have meals planned for this date range.');
  }

  // Map AI response into shopping_items inserts
  const shoppingItems = data.items.map(item => ({
    user_id: userId,
    item_name: item.name,
    quantity: item.quantity ? `${item.quantity}${item.unit ? ' ' + item.unit : ''}` : null,
    category: item.category || 'Other',
    is_purchased: false,
  }));

  const { data: insertedItems, error: insertError } = await supabase
    .from('shopping_items')
    .insert(shoppingItems)
    .select();

  if (insertError) {
    errorLogger.logApiError(insertError, '/shopping/generate', 'POST');
    throw insertError;
  }

  return wrapResponse(insertedItems as ShoppingItem[]);
},

// Fallback: simple client-side generation (used when edge function unavailable)
_generateFromPlanFallback: async (startDate: string, endDate: string) => {
  const userId = await getCurrentUserId();

  const { data: planItems, error: planError } = await supabase
    .from('scheduled_meals')
    .select('meal_id, servings, meal:meals(ingredients)')
    .eq('user_id', userId)
    .gte('meal_date', startDate)
    .lte('meal_date', endDate);

  if (planError) {
    errorLogger.logApiError(planError, '/shopping/generate-fallback', 'GET');
    throw planError;
  }

  if (!planItems || planItems.length === 0) {
    throw new Error('No meals planned for this date range. Add some meals to your plan first!');
  }

  const ingredientMap = new Map<string, { quantity: string; category: string }>();

  for (const item of planItems) {
    const mealData = item.meal;
    if (!mealData || typeof mealData !== 'object' || !('ingredients' in mealData)) continue;
    const meal = mealData as { ingredients: string };
    if (!meal.ingredients || typeof meal.ingredients !== 'string') continue;

    const lines = meal.ingredients.split('\n').filter(line => line.trim());
    for (const line of lines) {
      const trimmed = line.trim().replace(/^[-•*]\s*/, '');
      if (!trimmed) continue;

      const match = trimmed.match(/^([\d½¼¾⅓⅔⅛⅜⅝⅞⅕⅖⅗⅘⅙⅚\s/.]+)?\s*(.+)$/u);
      const quantity = match?.[1]?.trim() || '';
      const name = match?.[2]?.trim().toLowerCase() || trimmed.toLowerCase();

      if (ingredientMap.has(name)) continue;

      let category = 'Other';
      const lowerName = name.toLowerCase();
      if (/milk|cheese|yogurt|butter|cream|egg/i.test(lowerName)) category = 'Dairy & Eggs';
      else if (/chicken|beef|pork|fish|salmon|shrimp|bacon|sausage/i.test(lowerName)) category = 'Meat & Seafood';
      else if (/apple|banana|orange|lemon|lime|berry|fruit|lettuce|tomato|onion|garlic|pepper|carrot|celery|potato|vegetable|broccoli|spinach|avocado|cucumber|mushroom|zucchini/i.test(lowerName)) category = 'Produce';
      else if (/bread|flour|tortilla|bun|roll|pita|naan/i.test(lowerName)) category = 'Bakery';
      else if (/pasta|rice|cereal|oat|sugar|oil|vinegar|sauce|ketchup|mustard|mayo|can|canned|broth|stock|tomato paste|soy sauce|honey|syrup|salt|pepper|spice|herb|oregano|basil|cumin|paprika/i.test(lowerName)) category = 'Pantry';
      else if (/frozen/i.test(lowerName)) category = 'Frozen';
      else if (/juice|soda|water|wine|beer|coffee|tea/i.test(lowerName)) category = 'Beverages';

      ingredientMap.set(name, { quantity, category });
    }
  }

  if (ingredientMap.size === 0) {
    throw new Error('No ingredients found in the planned meals.');
  }

  const shoppingItems = Array.from(ingredientMap.entries()).map(([name, { quantity, category }]) => ({
    user_id: userId,
    item_name: name.charAt(0).toUpperCase() + name.slice(1),
    quantity: quantity || null,
    category,
    is_purchased: false,
  }));

  const { data: insertedItems, error: insertError } = await supabase
    .from('shopping_items')
    .insert(shoppingItems)
    .select();

  if (insertError) {
    errorLogger.logApiError(insertError, '/shopping/generate-fallback', 'POST');
    throw insertError;
  }

  return wrapResponse(insertedItems as ShoppingItem[]);
},
```

**Step 2: Verify build**

Run: `cd /Users/adrianstier/meal-planning/client && npm run build`
Expected: PASS with zero warnings

**Step 3: Commit**

```bash
git add client/src/lib/api.ts
git commit -m "Wire up AI shopping list: call generate-shopping-list edge function with client-side fallback"
```

---

## Task 6: Wire Up Orchestrator (W4)

**Files:**
- Modify: `supabase/functions/agent/index.ts` (replace direct Claude call with orchestrator)
- Modify: `supabase/functions/_shared/agents/shopping-agent.ts` (fix schema field bugs)

**Prerequisites:** Ensure `SUPABASE_SERVICE_ROLE_KEY` is available as a Supabase edge function secret (the orchestrator uses it at `orchestrator.ts:39`).

**Step 1: Fix ShoppingAgent schema field bugs**

In `supabase/functions/_shared/agents/shopping-agent.ts`, find where it references `row.name` and change to `row.item_name`. Find where it references `row.unit` and `row.recipes` — these columns don't exist in the `shopping_items` schema. Remove those field references or make them optional fallbacks.

Search for these patterns and fix:
- `name: row.name` → `name: row.item_name`
- `unit: row.unit` → remove or set to `''`
- `recipes: row.recipes` → remove or set to `[]`

**Step 2: Modify agent/index.ts to use orchestrator**

Replace the current direct Claude call section (lines 316-396) with orchestrator integration. Keep all the existing auth, rate limiting, and validation code (lines 1-312) intact.

Replace from line 314 (`console.log(...)`) through line 396 (the return statement) with:

```typescript
    console.log(`[Agent] Processing request from user ${user.id}: "${message.slice(0, 100)}..."`)

    // Try orchestrator-based processing
    try {
      const { OrchestratorAgent } = await import('../_shared/agents/index.ts')
      const orchestrator = new OrchestratorAgent()

      const agentContext = {
        userId: user.id,
        conversationId,
        memory: {
          userPreferences: null,
          recentRecipes: [],
          leftoverInventory: [],
          conversationHistory: [],
        },
        metadata: metadata || {},
      }

      const response = await orchestrator.process(message, agentContext)

      const executionTime = Date.now() - startTime
      console.log(`[Agent] Orchestrator completed in ${executionTime}ms`)

      return new Response(
        JSON.stringify({
          success: response.success !== false,
          message: response.message,
          conversationId,
          executionTimeMs: executionTime,
          data: {
            usage: response.data?._meta?.tokenUsage || { input: 0, output: 0 },
            intent: response.data?._meta?.intent || 'unknown',
            ...(response.data || {}),
          },
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    } catch (orchestratorError) {
      // Fallback to direct Claude call if orchestrator fails
      console.error('[Agent] Orchestrator failed, falling back to direct call:', orchestratorError)

      // Load user's recipes for context
      const { data: recipes } = await supabase
        .from('meals')
        .select('name, cuisine, meal_type, difficulty')
        .eq('user_id', user.id)
        .limit(10)

      const recipeContext = recipes?.length
        ? `User has ${recipes.length} recipes saved: ${recipes.map(r => r.name).join(', ')}`
        : 'User has no recipes saved yet.'

      // Load active leftovers
      const { data: leftovers } = await supabase
        .from('leftovers_inventory')
        .select('meals:meal_id(name), servings_remaining, expires_date')
        .eq('user_id', user.id)
        .gt('expires_date', new Date().toISOString().split('T')[0])
        .gt('servings_remaining', 0)

      const leftoverContext = leftovers?.length
        ? `Active leftovers: ${leftovers.map(l => `${(l.meals as any)?.name || 'Unknown'} (${l.servings_remaining} servings)`).join(', ')}`
        : 'No active leftovers.'

      const systemPrompt = `You are a helpful meal planning AI assistant. You help users with:

**Recipe Management:**
- Save recipes from URLs, text, or images
- Organize and search their recipe collection
- Get cooking tips and variations

**Meal Planning:**
- Create weekly meal plans
- Suggest meals based on preferences
- Use up leftovers before they expire
- Balance nutrition throughout the week

**Shopping:**
- Generate shopping lists from meal plans
- Organize items by store section
- Estimate costs

**Nutrition:**
- Analyze recipe nutrition
- Check dietary compliance (keto, vegan, etc.)
- Suggest healthier substitutions
- Flag allergens

Be friendly, helpful, and concise. Format responses with markdown for readability.

**User Context:**
${recipeContext}
${leftoverContext}

When the user wants to:
- Add a recipe: Ask them to paste a URL or the recipe text
- Plan meals: Ask what days they want to plan and any preferences
- Make a shopping list: Confirm which meals to include`

      const aiResponse = await callAI(systemPrompt, message)

      const executionTime = Date.now() - startTime
      console.log(`[Agent] Fallback completed in ${executionTime}ms`)

      return new Response(
        JSON.stringify({
          success: true,
          message: aiResponse.content,
          conversationId,
          executionTimeMs: executionTime,
          data: {
            usage: aiResponse.usage,
            recipesLoaded: recipes?.length || 0,
            leftoverCount: leftovers?.length || 0,
            fallback: true,
          },
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }
```

**Step 3: Verify the agent endpoint locally (if Supabase CLI available)**

Run: `supabase functions serve agent --env-file supabase/.env.local`
Test with: `curl -X POST http://localhost:54321/functions/v1/agent -H "Authorization: Bearer <token>" -H "X-Requested-With: XMLHttpRequest" -H "Content-Type: application/json" -d '{"message":"What can you help with?"}'`

**Step 4: Commit**

```bash
git add supabase/functions/agent/index.ts supabase/functions/_shared/agents/shopping-agent.ts
git commit -m "Wire up multi-agent orchestrator with direct Claude fallback"
```

---

## Task 7: Final Verification

**Step 1: Full build check**

Run: `cd /Users/adrianstier/meal-planning/client && npm run build`
Expected: PASS with zero warnings

**Step 2: Run Playwright tests**

Run: `cd /Users/adrianstier/meal-planning/client && npx playwright test`
Expected: All tests pass

**Step 3: Update bug bash summary**

Update `bug-bash-reports/summary.md` to mark the 6 remaining concerns as resolved.

**Step 4: Final commit**

```bash
git add bug-bash-reports/summary.md
git commit -m "Mark all 6 remaining concerns as resolved"
```
