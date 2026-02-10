# Bug Bash Plan — Wave 4 (Hardening + Deep Dive)

## Previous Waves
- Wave 1: 8 bugs (serial)
- Wave 2: 43 bugs (6 parallel agents)
- Wave 3: 13 bugs (5 parallel agents + regression)
- Total: 64 bugs fixed

## Wave 4 Strategy
After 3 waves of broad + deep coverage, Wave 4 focuses on hardening:
1. **UI state machines** — complex pages with many useState calls, verify state transitions
2. **Unused code & dead paths** — TODO stubs, eslint-disables, unused variables
3. **Edge function contract testing** — verify request/response contracts match client expectations
4. **Accessibility & UX logic** — form validation, keyboard nav, error states

## Scope Splits (3 parallel agents)

| Agent | Scope | Focus |
|-------|-------|-------|
| **state-machines** | PlanPageEnhanced.tsx, SeasonalCookingPage.tsx, HolidayPlannerPage.tsx, RecipesPage.tsx | Verify complex state transitions, TODO stubs that could crash, eslint-disable safety |
| **dead-code-cleanup** | Entire codebase | Find and remove unused exports, dead TODO stubs, unreachable code paths, redundant eslint-disables |
| **edge-contract-test** | All edge functions + corresponding client API calls | Verify request body fields match, response fields match, error format consistent |
