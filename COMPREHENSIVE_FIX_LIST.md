# Comprehensive Fix List - Meal Planning Application

Generated: 2026-01-18

## Executive Summary

After deep code review analyzing architecture, security, performance, type safety, and UX, here is the complete prioritized list of issues to fix.

---

## CRITICAL PRIORITY (Fix Immediately)

### 1. Console.log Statements in Production
**Files:** `client/src/lib/api.ts` (20+ instances)
**Issue:** Debug statements leak implementation details and impact performance
**Fix:** Remove or gate behind `process.env.NODE_ENV === 'development'`

### 2. Hardcoded CORS Origins
**File:** `supabase/functions/agent/index.ts:14-20`
**Issue:** Multiple hardcoded URLs instead of environment config
**Fix:** Use environment variable for allowed origins

### 3. Race Conditions in Auth Initialization
**File:** `client/src/contexts/AuthContext.tsx:217-313`
**Issue:** Multiple async paths can both execute, causing race conditions
**Fix:** Refactor to use proper state machine or mutex pattern

### 4. Rate Limiter Resets on Worker Restart
**File:** `supabase/functions/agent/index.ts:53-73`
**Issue:** Rate limiter uses in-memory Map, resets on Deno worker restart
**Fix:** Use Redis or database-backed rate limiting

### 5. Missing Pagination Defaults
**File:** `client/src/lib/api.ts:276-303`
**Issue:** `mealsApi.getAll()` called without options loads ALL meals
**Fix:** Add sensible default limit (e.g., 50)

---

## HIGH PRIORITY

### 6. No Debouncing on Search
**File:** `client/src/lib/api.ts:555-583`
**Issue:** Search API called immediately without debounce
**Fix:** Add 300ms debounce on search input

### 7. Loose Error Typing (any usage)
**Files:**
- `client/src/pages/PlanPageEnhanced.tsx:84` - `generatedPlan: any[]`
- `client/src/pages/RecipesPage.tsx:192` - `processParseResult(parsedData: any)`
- `client/src/utils/errorLogger.ts:92-137` - loose `any` types
**Fix:** Create proper TypeScript interfaces

### 8. Missing Database Indexes
**File:** `supabase/schema.sql`
**Issue:** Missing compound indexes for common queries
**Fix:** Add `(user_id, meal_type)` and `(user_id, created_at DESC)` indexes

### 9. Inefficient Cache Invalidation
**File:** `client/src/hooks/usePlan.ts:15-45`
**Issue:** All mutations invalidate entire 'plan' query key
**Fix:** Invalidate specific week: `['plan', 'week', startDate]`

### 10. Broadcast Sync Over-Invalidation
**File:** `client/src/contexts/BroadcastSyncContext.tsx:56-57`
**Issue:** When any tab becomes visible, ALL queries are invalidated
**Fix:** Only invalidate stale queries or use targeted invalidation

### 11. Missing useCallback on Event Handlers
**File:** `client/src/pages/PlanPageEnhanced.tsx:123-171`
**Issue:** `handleDrop` creates new function on every render
**Fix:** Wrap with `useCallback` with proper dependencies

### 12. Magic Delays in Auth Flow
**Files:** `client/src/contexts/AuthContext.tsx:123, 271, 434`
**Issue:** Arbitrary setTimeout delays to work around race conditions
**Fix:** Use event-driven approach or proper async coordination

---

## MEDIUM PRIORITY

### 13. Session Polling Anti-Pattern
**File:** `client/src/contexts/AuthContext.tsx:167-213`
**Issue:** Session refresh polling every 10 min regardless of activity
**Fix:** Use Supabase's built-in token refresh or event-driven refresh

### 14. Missing Query Cache Configuration
**File:** `client/src/hooks/useMeals.ts:6-12`
**Issue:** Query has no staleTime/cacheTime, refetches on every mount
**Fix:** Add appropriate staleTime (e.g., 5 minutes)

### 15. Unnecessary Data Transforms
**File:** `client/src/lib/api.ts:632-671`
**Issue:** Data transformation happens on every response
**Fix:** Use database views or response interceptor

### 16. Large State in PlanPageEnhanced
**File:** `client/src/pages/PlanPageEnhanced.tsx:70-120`
**Issue:** 27+ state variables, many not memoized
**Fix:** Split into smaller components or use reducer

### 17. No Soft Deletes
**File:** All delete operations in `client/src/lib/api.ts`
**Issue:** Hard deletes don't allow recovery
**Fix:** Add `deleted_at` timestamp for soft deletes

### 18. TODO Comments Not Addressed
**Files:**
- `client/src/pages/PlanPageEnhanced.tsx:298, 306, 430, 435` - Undo/redo features
- `client/src/pages/PricingPage.tsx:82` - Stripe integration
**Fix:** Implement or remove

### 19. Error Messages Expose Internal Details
**File:** `client/src/lib/api.ts:73-173`
**Issue:** Detailed error messages logged and could be exposed
**Fix:** Sanitize error messages for client consumption

### 20. Insufficient Constraint Validation
**File:** `supabase/schema.sql:67`
**Issue:** `kid_friendly_level` has CHECK but no NOT NULL
**Fix:** Add NOT NULL or handle NULL in application

---

## LOW PRIORITY (Code Quality)

### 21. Denormalized Data
**File:** `supabase/schema.sql:658-670`
**Issue:** Meal name duplicated in scheduled_meals
**Fix:** Remove duplication, use JOIN

### 22. Silent Failures in Error Logger
**File:** `client/src/utils/errorLogger.ts:238-254`
**Issue:** localStorage errors silently fail
**Fix:** Add fallback logging mechanism

### 23. Missing Discriminated Unions
**File:** `client/src/contexts/AuthContext.tsx:29`
**Issue:** AuthContextType has optional fields that should be discriminated
**Fix:** Use discriminated union pattern for auth states

### 24. Incomplete Error Recovery
**File:** `client/src/components/ErrorBoundary.tsx:64`
**Issue:** Full page reload loses scroll position and context
**Fix:** Implement partial recovery where possible

### 25. Type Safety with as any Casts
**Files:**
- `client/src/components/ui/empty-state.tsx:84`
- `client/src/pages/PlanPageEnhanced.tsx:1058`
**Fix:** Add proper type definitions

---

## Summary Statistics

| Priority | Count | Est. Effort |
|----------|-------|-------------|
| Critical | 5 | 2-3 days |
| High | 7 | 3-4 days |
| Medium | 8 | 4-5 days |
| Low | 5 | 2-3 days |
| **Total** | **25** | **11-15 days** |

---

## Implemented Fixes (2026-01-18)

### Critical Fixes Implemented

1. **Console.log statements gated behind development check**
   - File: `client/src/lib/api.ts`
   - Added `isDev` check and `devLog`/`devError` helper functions
   - All debug logging now only shows in development mode

2. **CORS origins now configurable via environment variable**
   - File: `supabase/functions/agent/index.ts`
   - Added `ALLOWED_ORIGINS` environment variable support
   - Falls back to hardcoded list if not set

3. **Database indexes added for performance**
   - File: `supabase/migrations/20260118_add_performance_indexes.sql`
   - Added compound indexes for common query patterns
   - Indexes for: meals, scheduled_meals, leftovers, shopping, school_menu, restaurants, bento

### High Priority Fixes Implemented

4. **Search debouncing added**
   - File: `client/src/hooks/useMeals.ts`
   - Added `useDebounce` hook with 300ms delay
   - Search queries now debounced before API call

5. **Cache invalidation optimized**
   - File: `client/src/hooks/usePlan.ts`
   - Changed from invalidating all `['plan']` to specific week
   - Uses `getWeekStart()` helper to target correct cache key

6. **BroadcastSync over-invalidation fixed**
   - File: `client/src/contexts/BroadcastSyncContext.tsx`
   - Changed to only refetch active, stale queries on tab visibility change
   - Prevents unnecessary network requests

7. **Query cache configuration added**
   - File: `client/src/hooks/useMeals.ts`
   - Added `staleTime: 5 minutes` and `gcTime: 30 minutes`
   - Reduces unnecessary refetches

### Medium Priority Fixes Implemented

8. **Auth race conditions improved**
   - File: `client/src/contexts/AuthContext.tsx`
   - Replaced magic delays with exponential backoff pattern
   - Used `requestIdleCallback` for async coordination
   - Better AbortController pattern for cleanup

9. **TypeScript any types fixed**
   - File: `client/src/utils/errorLogger.ts`
   - Added `ErrorContext`, `ApiErrorResponse` interfaces
   - Replaced all `any` types with proper types

10. **Soft deletes added to database**
    - File: `supabase/migrations/20260118_add_soft_deletes.sql`
    - Added `deleted_at` column to meals, scheduled_meals, restaurants, bento tables
    - Created views for active records: `active_meals`, `active_scheduled_meals`, `active_restaurants`
    - Added cleanup function `cleanup_soft_deleted_records(days_old)`

11. **Loose TypeScript types fixed in RecipesPage**
    - File: `client/src/pages/RecipesPage.tsx`
    - Added `ParsedRecipeData` interface with proper union types
    - Fixed `meal_type` to use `'breakfast' | 'lunch' | 'dinner' | 'snack'`
    - Fixed `difficulty` to use `'easy' | 'medium' | 'hard'`

12. **GeneratedPlanItem type added**
    - File: `client/src/pages/PlanPageEnhanced.tsx`
    - Replaced `any[]` with proper `GeneratedPlanItem` interface
    - Includes all required fields: meal_id, date, meal_type, etc.

### Code Cleanup Completed

13. **Unused imports removed**
    - `Layout.tsx`: Removed unused `ListChecks` import
    - `AuthContext.tsx`: Removed unused `useRef` import
    - `CompactDayCard.tsx`: Removed unused `format` import

14. **Unused code commented**
    - `RecipesPage.tsx`: Commented out `selectAllInCurrentTab` (for future bulk selection UI)
    - Added documentation comments for future implementation

---

## Already Fixed (from BUG_REPORT.md)

The following issues were previously identified and fixed:
- XSS vulnerability in AgentChat (SEC-001)
- SQL pattern injection in search (SEC-002)
- Stale closure in keyboard handler (CQ-001)
- Unsafe type assertions (CQ-002)
- Timezone handling in dates (LP-001)
- File upload validation with magic bytes (LP-002)
- Race conditions in AuthContext (LP-003) - partially
- Edge function timeout handling (LP-004)
- Unicode fraction support (BUG-007)
- Multi-tab sync with BroadcastChannel (BUG-010)
- Session keep-alive with activity tracking (BUG-011)
- Servings validation (BUG-013, BUG-014)
