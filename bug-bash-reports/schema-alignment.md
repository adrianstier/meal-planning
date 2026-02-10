# Schema Alignment -- Bug Bash Report

**Wave 3 -- Schema Alignment Checker**
**Date**: 2026-02-09

## Summary

Performed a comprehensive comparison of the database schema (26 base tables + 6 agent tables + migration modifications) against the TypeScript type definitions (`client/src/types/api.ts`) and all Supabase queries in the API layer (`client/src/lib/api.ts`) and other client files.

Found **5 issues** total: **3 fixed** (type mismatches, phantom field, missing columns), **2 remaining** (soft-delete filtering, meal_history gaps). Build verified clean after fixes.

---

## Tables Verified

| Table | Status | Issues |
|-------|--------|--------|
| `profiles` | OK | Queries in AuthContext match schema. `role` column added by migration; client reads `*` so it's included. |
| `meals` | FIXED | TypeScript `Meal` interface was missing 8 DB columns. All added. |
| `meal_types` | OK | Reference table, not queried from client API layer. |
| `ingredients` | OK | Reference table, not queried from client API layer. |
| `meal_ingredients` | OK | Not queried from client API layer. |
| `meal_plans` | OK | Not directly used; `scheduled_meals` is used instead. |
| `scheduled_meals` | OK | All column names in `.select()`, `.insert()`, `.update()` match schema. `deleted_at` column added by migration but not filtered -- see Notes. |
| `shopping_items` | OK | All column names match schema. |
| `school_menu_items` | FIXED | `dislike_count` phantom field removed from TS type and UI. |
| `school_menu_feedback` | OK | All column names match schema. |
| `leftovers_inventory` | OK | All column names match schema. Denormalized `meal_name` is correctly used as fallback. |
| `meal_history` | WARN | `meal_type` and `servings` columns exist in DB but are never written by client. |
| `meal_favorites` | OK | Not queried directly; `is_favorite` on `meals` table is used instead. |
| `bento_items` | OK | All column names match schema. |
| `bento_plans` | OK | All column names match schema. FK join syntax is correct. |
| `restaurants` | FIXED | `hours_data` and `happy_hour_info` types corrected from `string` to `Record<string, unknown> \| null` to match JSONB. |
| `subscriptions` | OK | Not queried from client API layer. |
| `payment_history` | OK | Not queried from client API layer. |
| `plan_features` | OK | Not queried from client API layer. |
| `feature_usage` | OK | Not queried from client API layer. |
| `error_logs` | OK | Queried in DiagnosticsPage; all column names match schema. |
| `csa_boxes` | OK | Not queried from client API layer. |
| `csa_box_items` | OK | Not queried from client API layer. |
| `holiday_plans` | OK | Not queried from client API layer (page uses edge functions). |
| `user_preferences` | OK | Not queried from client API layer. |
| `family_members` | OK | Not queried from client API layer. |
| `agent_conversations` | OK | Queries in useAgent.ts match schema columns. |
| `agent_messages` | OK | Queries in useAgent.ts match schema columns. |
| `agent_memory` | OK | Not queried from client. |
| `agent_tasks` | OK | Not queried from client. |
| `agent_feedback` | OK | Queries in useAgent.ts match schema columns. |
| `agent_usage` | OK | Not queried from client. |
| `rate_limits` | OK | Not queried from client (SECURITY DEFINER functions only). |
| `login_attempts` | OK | Not queried from client (service_role only). |

---

## Bugs Fixed

| # | File | Severity | Description | Fix Applied |
|---|------|----------|-------------|-------------|
| 1 | `client/src/types/api.ts` | Medium | `SchoolMenuItem.dislike_count` phantom field -- does not exist in the `school_menu_items` database table and never will be returned. UI code in `SchoolMenuPage.tsx` conditionally rendered based on this always-undefined value. | Removed `dislike_count` from `SchoolMenuItem` interface. Removed conditional styling and badge rendering in `SchoolMenuPage.tsx` that depended on it. |
| 2 | `client/src/types/api.ts` | Medium | `Restaurant.hours_data` and `Restaurant.happy_hour_info` typed as `string` but DB stores `JSONB`. Supabase JS returns JSONB as parsed objects. `RestaurantsPage.tsx` called `JSON.parse()` on already-parsed objects, which would throw (caught by try/catch, silently hiding data). | Changed types to `Record<string, unknown> \| null`. Updated `RestaurantsPage.tsx` display and handler code to check `typeof` before parsing. |
| 3 | `client/src/types/api.ts` | Low | `Meal` interface was missing 10 DB columns: `prep_time_minutes`, `updated_at`, `kid_friendly_level`, `is_leftover`, `original_meal_id`, `times_cooked`, `calories`, `protein_g`, `carbs_g`, `fat_g`, `fiber_g`. Data flowed through via `select('*')` + spread operators but without type safety. | Added all missing columns to `Meal` interface as optional fields. |

---

## Type Mismatches Noted

| # | Table.Column | DB Type | Client Type | Impact |
|---|--------------|---------|-------------|--------|
| 1 | `restaurants.hours_data` | `JSONB` | `string` | **Medium**: The client types `hours_data` as `string` with a comment "JSON string", but the DB stores native `JSONB`. Supabase JS client returns JSONB as parsed JavaScript objects, not strings. The `RestaurantsPage.tsx` code tries to `JSON.parse()` it, which would fail on an already-parsed object (though it has try/catch). If data were inserted as a string, it would be double-encoded. Recommend changing type to `Record<string, unknown> \| null`. |
| 2 | `restaurants.happy_hour_info` | `JSONB` | `string` | **Medium**: Same issue as `hours_data` above. The Supabase client will return a parsed JS object, not a JSON string. |
| 3 | `meals.protein_g` | `DECIMAL(10,2)` | Not in type | **Low**: DB column exists but is not in the `Meal` TypeScript interface. Data is preserved on round-trips via `...meal` spread in `create`/`update`, but never explicitly typed. |
| 4 | `meals.carbs_g` | `DECIMAL(10,2)` | Not in type | **Low**: Same as above. |
| 5 | `meals.fat_g` | `DECIMAL(10,2)` | Not in type | **Low**: Same as above. |
| 6 | `meals.fiber_g` | `DECIMAL(10,2)` | Not in type | **Low**: Same as above. |
| 7 | `meals.calories` | `INTEGER` | Not in type | **Low**: Same as above. |
| 8 | `meals.kid_friendly_level` | `INTEGER NOT NULL` | Not in type | **Low**: DB column with NOT NULL + default 5. Client code never reads or writes it explicitly. The `kid_rating` field (which IS in the type) is a separate column. |
| 9 | `meals.prep_time_minutes` | `INTEGER` | Not in type | **Low**: DB column exists but not in TypeScript interface. |
| 10 | `meals.is_leftover` | `BOOLEAN DEFAULT FALSE` | Not in type | **Low**: DB column for tracking leftover recipes. Not in TS type. |
| 11 | `meals.original_meal_id` | `INTEGER` (FK self-ref) | Not in type | **Low**: DB column for linking leftover recipes to originals. Not in TS type. |
| 12 | `meals.times_cooked` | `INTEGER DEFAULT 0` | Not in type | **Low**: DB column exists but not in TypeScript interface. |
| 13 | `school_menu_items.dislike_count` | **Does not exist** | `number` (optional) | **Medium**: TypeScript declares this field but it does not exist in the DB. See Bugs section. |

---

## Missing Fields

| # | Table.Column | Notes |
|---|--------------|-------|
| 1 | `meals.kid_friendly_level` | DB has `NOT NULL DEFAULT 5` with `CHECK(1-10)`. Not in `Meal` TS type. The AI recipe parsers may return this field, but it is not exposed to the UI through typed interfaces. Since queries use `select('*')`, data flows through but without type safety. |
| 2 | `meals.prep_time_minutes` | DB column exists but `Meal` TS type only has `cook_time_minutes`. The `prep_time_minutes` value is never displayed or editable in the UI. |
| 3 | `meals.calories`, `protein_g`, `carbs_g`, `fat_g`, `fiber_g` | Five nutrition columns exist in DB but are absent from the `Meal` TS type. The AI parse-recipe functions extract nutrition data and store it, but the UI has no typed access to display it. Data is preserved via spread operators. |
| 4 | `meals.times_cooked`, `is_leftover`, `original_meal_id` | Three columns related to leftover/history tracking. Present in DB but not in TS type. |
| 5 | `meal_history.meal_type` | DB has an optional `meal_type` column, but `historyApi.add()` never sets it during insert. The column allows NULL so this won't cause errors, but it means meal type context is lost in history records. |
| 6 | `meal_history.servings` | DB has a `servings` column with `DEFAULT 4`, but `historyApi.add()` never sets it. Similarly to `meal_type`, this data is lost. |
| 7 | `meals.deleted_at`, `scheduled_meals.deleted_at`, `restaurants.deleted_at` | Added by migration `20260118000001_add_soft_deletes.sql` but the client API layer never filters on `deleted_at IS NULL`. Queries select from the raw tables, not the `active_*` views. This means soft-deleted records would still appear in the UI. Either the soft-delete feature is not yet activated, or the queries should use `deleted_at IS NULL` filters. |

---

## Enum/Constraint Alignment

| # | Constraint | DB Values | Client Values | Match? |
|---|-----------|-----------|---------------|--------|
| 1 | `meals.meal_type` | `'breakfast', 'lunch', 'dinner', 'snack'` (CHECK) | `'breakfast' \| 'lunch' \| 'dinner' \| 'snack'` | Yes |
| 2 | `meals.difficulty` | `'easy', 'medium', 'hard'` (CHECK) | `'easy' \| 'medium' \| 'hard'` | Yes |
| 3 | `scheduled_meals.meal_type` | `'breakfast', 'lunch', 'dinner', 'snack'` (CHECK) | `'breakfast' \| 'lunch' \| 'dinner' \| 'snack'` | Yes |
| 4 | `school_menu_items.meal_type` | `'lunch', 'breakfast', 'snack'` (CHECK) | `'breakfast' \| 'lunch' \| 'snack'` | Yes |
| 5 | `school_menu_feedback.feedback_type` | `'disliked', 'allergic', 'wont_eat'` (CHECK) | `'disliked' \| 'allergic' \| 'wont_eat'` | Yes |
| 6 | `restaurants.price_range` | `'$', '$$', '$$$', '$$$$'` (CHECK) | `string` (no constraint) | Client is looser -- no validation, but DB will reject invalid values |
| 7 | `ingredients.prep_difficulty` | `'easy', 'medium', 'hard'` (CHECK) | Not used | N/A |
| 8 | `subscriptions.plan_tier` | `'free', 'family', 'premium', 'lifetime'` (CHECK) | Not used | N/A |
| 9 | `subscriptions.status` | `'active', 'trialing', 'past_due', 'canceled', 'paused'` (CHECK) | Not used | N/A |
| 10 | `agent_conversations.status` | `'active', 'archived', 'deleted'` (CHECK) | Hardcoded `'active'` filter in query | OK |
| 11 | `agent_messages.role` | 7 values (CHECK) | Maps to `'user' \| 'assistant'` | OK -- simplification for UI display |
| 12 | `agent_feedback.feedback_type` | `'helpful', 'not_helpful', 'incorrect', 'offensive', 'other'` | Same 5 values | Yes |
| 13 | `meal_history.rating` | `1-10` (after migration fix) | `number` (no client constraint) | Client validation exists for `kid_rating` but not for `meal_history.rating`. DB will enforce. |

---

## Foreign Key / Join Verification

| # | Query Location | Join/FK | Status |
|---|---------------|---------|--------|
| 1 | `planApi.getWeek` | `scheduled_meals` -> `meals` via `meal:meals(*)` | OK -- `meal_id` FK exists |
| 2 | `planApi.add` | Insert into `scheduled_meals` with `meal_id` | OK -- FK validated by DB |
| 3 | `leftoversApi.getActive` | `leftovers_inventory` -> `meals` via `meal:meals(name)` | OK -- `meal_id` FK exists (nullable, ON DELETE SET NULL) |
| 4 | `historyApi.getAll` | `meal_history` -> `meals` via `meal:meals(name)` | OK -- `meal_id` FK exists (ON DELETE CASCADE) |
| 5 | `bentoApi.getPlans` | `bento_plans` -> `bento_items` via 4 compartment FKs | OK -- all 4 FK columns exist |
| 6 | `shoppingApi.generateFromPlan` | `scheduled_meals` -> `meals` via `meal:meals(ingredients)` | OK -- `meal_id` FK exists |
| 7 | `useConversations` | `agent_conversations` -> `agent_messages` via `!inner` join | OK -- FK exists |
| 8 | `useAgentFeedback` | Insert `agent_feedback` with `message_id` FK | OK -- FK exists. Note: `conversation_id` is NOT set in the insert, which is allowed (nullable FK). |

---

## Recommendations (Remaining)

### Priority 1 (Should Address)
1. **Add soft-delete filtering** to API queries if the soft-delete feature is meant to be active. Currently `deleted_at` columns exist on `meals`, `scheduled_meals`, and `restaurants`, but no queries filter on them. Either add `.is('deleted_at', null)` to all queries, or use the `active_*` views created by the migration.

### Priority 2 (Nice to Have)
2. **Add `meal_type` and `servings` to `historyApi.add`** insert operation to capture full context in meal history records. These DB columns exist but are never populated.
3. **Validate `price_range`** on the client side for restaurant forms to match the DB CHECK constraint (`'$', '$$', '$$$', '$$$$'`).
