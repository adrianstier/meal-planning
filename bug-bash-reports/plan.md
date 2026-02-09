# Bug Bash Plan — Wave 2 (Multi-Agent)

## Previous Wave
Commit `01242ad` fixed 8 bugs: edge function timeouts, query key mismatches, agent headers, broadcast error handling. This wave goes deeper.

## Scope Splits (6 parallel agents)

| Agent | Scope | Key Files | Lines |
|-------|-------|-----------|-------|
| **api-layer** | Core API + data layer | `api.ts`, `supabase.ts`, `types/api.ts`, `utils/*` | ~2600 |
| **pages-plan** | Plan & meal pages + plan components | `PlanPageEnhanced.tsx`, `PlanPage.tsx`, `RecipesPage.tsx`, plan components, `usePlan.ts`, `useMeals.ts` | ~3800 |
| **pages-features** | Feature pages (seasonal, holiday, bento, CSA, leftovers, school, restaurants, lists, pricing, profile) | 10 page files + `useLeftovers.ts`, `useSchoolMenu.ts`, `useRestaurants.ts`, `useShopping.ts` | ~6400 |
| **auth-contexts** | Auth, contexts, layout, error boundary, onboarding | `AuthContext.tsx`, `BroadcastSyncContext.tsx`, `DragDropContext.tsx`, `Layout.tsx`, `ErrorBoundary.tsx`, `OnboardingTour.tsx`, `App.tsx`, `LoginPage.tsx` | ~2000 |
| **edge-functions** | All Supabase edge functions + shared cors | 12 edge functions, `_shared/cors.ts` | ~3500 |
| **agent-system** | Multi-agent AI system | `_shared/agents/*`, `agent/index.ts`, `useAgent.ts`, `AgentChat.tsx` | ~4400 |

## Agent Instructions
Each scope agent will:
1. Read every file in its scope thoroughly
2. Identify bugs: logic errors, race conditions, null safety, type errors, security issues, missing error handling
3. For each bug: assess severity, describe the issue, provide the fix
4. Apply fixes directly to the code
5. Write findings to `bug-bash-reports/<scope>.md`

## Review Phase
After all scope agents complete:
1. Review agent reads all reports + runs `npm run build`
2. Checks for cross-cutting issues between scopes
3. Writes `bug-bash-reports/summary.md`
