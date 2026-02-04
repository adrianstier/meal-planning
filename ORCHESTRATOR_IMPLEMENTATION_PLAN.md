# Orchestrator Implementation Plan

This document outlines how the multi-agent orchestrator should direct specialized agents to fix and improve the meal planning application.

---

## Agent Assignments

### Agent 1: Security Engineer
**Focus:** Security hardening and vulnerability fixes

#### Tasks:
1. **Remove console.log statements** (Critical)
   - File: `client/src/lib/api.ts`
   - Action: Remove all 20+ debug console.log statements or wrap in development check
   - Pattern: `if (process.env.NODE_ENV === 'development') console.log(...)`

2. **Fix hardcoded CORS origins** (Critical)
   - File: `supabase/functions/agent/index.ts:14-20`
   - Action: Replace hardcoded array with environment variable
   - Implementation:
     ```typescript
     const ALLOWED_ORIGINS = Deno.env.get('ALLOWED_ORIGINS')?.split(',') || [
       'http://localhost:3000'
     ];
     ```

3. **Implement database-backed rate limiting** (Critical)
   - File: `supabase/functions/agent/index.ts:53-73`
   - Action: Replace in-memory Map with database table for persistence
   - Create migration for `rate_limits` table

4. **Sanitize error messages** (Medium)
   - File: `client/src/lib/api.ts:73-173`
   - Action: Create error sanitization function that strips internal details

---

### Agent 2: Backend Engineer
**Focus:** API optimization and database improvements

#### Tasks:
1. **Add pagination defaults** (Critical)
   - File: `client/src/lib/api.ts:276-303`
   - Action: Add default limit of 50 to `mealsApi.getAll()`

2. **Add compound database indexes** (High)
   - File: `supabase/migrations/` (new migration)
   - Indexes to add:
     ```sql
     CREATE INDEX idx_meals_user_meal_type ON meals(user_id, meal_type);
     CREATE INDEX idx_meals_user_created ON meals(user_id, created_at DESC);
     CREATE INDEX idx_scheduled_meals_user_date ON scheduled_meals(user_id, meal_date);
     ```

3. **Implement soft deletes** (Medium)
   - Files: `supabase/schema.sql`, `client/src/lib/api.ts`
   - Action: Add `deleted_at` column, update delete queries to set timestamp

4. **Fix database constraints** (Medium)
   - File: `supabase/schema.sql:67`
   - Action: Add NOT NULL to `kid_friendly_level` or handle in application

---

### Agent 3: Frontend Engineer
**Focus:** React performance and state management

#### Tasks:
1. **Add search debouncing** (High)
   - File: `client/src/lib/api.ts:555-583` or search components
   - Action: Implement 300ms debounce using `useDebouncedCallback`
   - Implementation:
     ```typescript
     import { useDebouncedCallback } from 'use-debounce';
     const debouncedSearch = useDebouncedCallback(searchFn, 300);
     ```

2. **Optimize cache invalidation** (High)
   - File: `client/src/hooks/usePlan.ts:15-45`
   - Action: Change from invalidating `['plan']` to `['plan', 'week', startDate]`

3. **Fix BroadcastSync over-invalidation** (High)
   - File: `client/src/contexts/BroadcastSyncContext.tsx:56-57`
   - Action: Only invalidate specific query keys that changed

4. **Add useCallback to event handlers** (High)
   - File: `client/src/pages/PlanPageEnhanced.tsx:123-171`
   - Action: Wrap `handleDrop` and other handlers with useCallback

5. **Add query cache configuration** (Medium)
   - File: `client/src/hooks/useMeals.ts:6-12`
   - Action: Add staleTime and cacheTime:
     ```typescript
     staleTime: 5 * 60 * 1000, // 5 minutes
     cacheTime: 30 * 60 * 1000, // 30 minutes
     ```

6. **Split large state in PlanPageEnhanced** (Medium)
   - File: `client/src/pages/PlanPageEnhanced.tsx:70-120`
   - Action: Extract into custom hooks or use useReducer

---

### Agent 4: TypeScript Specialist
**Focus:** Type safety improvements

#### Tasks:
1. **Fix loose error typing** (High)
   - Files:
     - `client/src/pages/PlanPageEnhanced.tsx:84`
     - `client/src/pages/RecipesPage.tsx:192`
     - `client/src/utils/errorLogger.ts:92-137`
   - Action: Replace `any` with proper interfaces:
     ```typescript
     interface GeneratedPlanItem {
       day: string;
       mealType: 'breakfast' | 'lunch' | 'dinner';
       mealId: number;
       meal?: Meal;
     }
     ```

2. **Fix type assertions** (Low)
   - Files:
     - `client/src/components/ui/empty-state.tsx:84`
     - `client/src/pages/PlanPageEnhanced.tsx:1058`
   - Action: Add proper type definitions to avoid `as any`

3. **Implement discriminated unions for auth state** (Low)
   - File: `client/src/contexts/AuthContext.tsx:29`
   - Action: Create discriminated union:
     ```typescript
     type AuthState =
       | { status: 'loading' }
       | { status: 'unauthenticated' }
       | { status: 'authenticated'; user: User; profile: Profile }
       | { status: 'confirming_email'; email: string };
     ```

---

### Agent 5: DevOps/Infrastructure Engineer
**Focus:** Auth flow and system reliability

#### Tasks:
1. **Fix race conditions in Auth initialization** (Critical)
   - File: `client/src/contexts/AuthContext.tsx:217-313`
   - Action: Implement proper state machine pattern:
     ```typescript
     const [authState, dispatch] = useReducer(authReducer, initialState);
     // Use actions: INIT_START, INIT_SUCCESS, INIT_FAILURE
     ```

2. **Replace magic delays with event-driven approach** (High)
   - File: `client/src/contexts/AuthContext.tsx:123, 271, 434`
   - Action: Use proper async coordination instead of setTimeout

3. **Fix session polling anti-pattern** (Medium)
   - File: `client/src/contexts/AuthContext.tsx:167-213`
   - Action: Use Supabase's onAuthStateChange for reactive updates

---

### Agent 6: Code Reviewer
**Focus:** Code quality and cleanup

#### Tasks:
1. **Address TODO comments** (Medium)
   - Files:
     - `client/src/pages/PlanPageEnhanced.tsx:298, 306, 430, 435`
     - `client/src/pages/PricingPage.tsx:82`
   - Action: Implement features or remove TODOs with explanation

2. **Improve error recovery** (Low)
   - File: `client/src/components/ErrorBoundary.tsx:64`
   - Action: Implement partial recovery without full page reload

3. **Add fallback logging** (Low)
   - File: `client/src/utils/errorLogger.ts:238-254`
   - Action: Add console fallback when localStorage fails

4. **Remove data denormalization** (Low)
   - File: `supabase/schema.sql:658-670`
   - Action: Remove `meal_name` from scheduled_meals, use JOIN

---

## Execution Order

### Phase 1: Critical Fixes (Day 1-2)
**Agents:** Security Engineer, Backend Engineer, DevOps Engineer

1. Security Engineer: Remove console.logs, fix CORS
2. Backend Engineer: Add pagination defaults
3. DevOps Engineer: Fix auth race conditions

### Phase 2: High Priority (Day 3-4)
**Agents:** Frontend Engineer, TypeScript Specialist

1. Frontend Engineer: Add debouncing, optimize cache invalidation
2. TypeScript Specialist: Fix all `any` types
3. Backend Engineer: Add database indexes

### Phase 3: Medium Priority (Day 5-7)
**Agents:** All agents

1. Frontend Engineer: Query cache config, split state
2. Backend Engineer: Soft deletes, constraints
3. DevOps Engineer: Fix session polling, magic delays
4. Security Engineer: Error message sanitization

### Phase 4: Low Priority (Day 8-10)
**Agents:** Code Reviewer, TypeScript Specialist

1. Code Reviewer: Address TODOs, improve error recovery
2. TypeScript Specialist: Discriminated unions, type assertions
3. Code Reviewer: Remove denormalization, add logging fallback

---

## Success Criteria

### Critical (Must Pass)
- [ ] No console.log statements in production build
- [ ] CORS origins from environment variable
- [ ] Pagination working with default limits
- [ ] Auth initialization without race conditions

### High Priority (Should Pass)
- [ ] Search debounced by 300ms
- [ ] Cache invalidation targets specific queries
- [ ] No `any` types in critical paths
- [ ] Database queries using compound indexes

### Medium Priority (Nice to Have)
- [ ] Soft deletes implemented
- [ ] Session refresh event-driven
- [ ] State split into smaller units
- [ ] All TODOs addressed

---

## Validation

After implementation, run:

```bash
# Build check (no TypeScript errors)
cd client && npm run build

# No console.logs in production
grep -r "console.log" client/src --include="*.ts" --include="*.tsx" | grep -v "NODE_ENV"

# Run tests
npm test

# Check for any type
grep -r ": any" client/src --include="*.ts" --include="*.tsx"
```
