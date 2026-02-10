# Bug Bash Plan — Wave 3 (Deep Pass + Remaining Issues)

## Previous Waves
- Wave 1: 8 bugs fixed (serial)
- Wave 2: 43 bugs fixed (6 parallel agents + review)
- Total: 51 bugs fixed across 40 files

## Wave 3 Strategy
Previous waves did broad coverage. Wave 3 goes deeper:
1. **Fix the 5 remaining issues** flagged by Wave 2 review
2. **Regression check** the Wave 2 fixes (verify the edits are correct)
3. **Integration-level analysis** — data flows across file boundaries
4. **Database schema alignment** — verify client types match DB schema

## Scope Splits (4 parallel agents)

| Agent | Scope | Focus |
|-------|-------|-------|
| **remaining-issues** | Fix the 5 actionable items from Wave 2 summary | Agent feedback wiring, 404 route, CORS divergence, generateWeek meal assignment, PostgREST wildcards |
| **regression-check** | Verify all Wave 2 fixes are correct | Read every modified file, check each fix for correctness and side effects |
| **integration-flows** | Cross-file data flow analysis | Plan creation→display→edit→delete flow, recipe parse→save→display flow, shopping list generation→display flow |
| **schema-alignment** | DB schema vs client types | Compare supabase/schema.sql + migrations against client/src/types/api.ts and actual API usage |
