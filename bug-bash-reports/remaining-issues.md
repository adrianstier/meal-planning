# Remaining Issues -- Bug Bash Report

## Bugs Fixed
| # | File:Line | Severity | Description | Fix Applied |
|---|-----------|----------|-------------|-------------|
| 1 | `client/src/components/features/agent/AgentChat.tsx:26,88,363-374` | Medium | ThumbsUp/ThumbsDown feedback buttons rendered without onClick handlers; `useAgentFeedback` mutation was defined but never wired up | Imported `useAgentFeedback` from `useAgent.ts`, instantiated it in the component, and added `onClick` handlers to both buttons that call `feedbackMutation.mutate()` with `'helpful'` or `'not_helpful'` feedbackType |
| 2 | `client/src/App.tsx:160` | Low | No catch-all 404 route; undefined paths rendered blank page | Added `<Route path="*">` with inline JSX showing "404 Page not found" and a `<Link>` back to home. Also imported `Link` from react-router-dom |
| 3 | `supabase/functions/agent/index.ts:19` | Medium | Agent endpoint's inline CORS origin list was missing `localhost:3001` (already added to `_shared/cors.ts`) | Added `'http://localhost:3001'` to the fallback `ALLOWED_ORIGINS` array in the agent endpoint, matching the shared utility |
| 4 | `supabase/functions/_shared/agents/planning-agent.ts:484` | Medium | `queryRecipes` tool passed raw user input containing potential `%` and `_` wildcards directly into PostgREST `.ilike()` call | Escape `%` to `\%` and `_` to `\_` in the `params.cuisine` value before interpolating into the ilike pattern |
| 5 | `client/src/lib/api.ts:1115-1131` | Low | `generateWeek` used the same `shuffled[i]` meal for all meal types on a given day, so breakfast/lunch/dinner all got the same recipe when multiple types were requested | Changed from per-day indexing to a single `mealIndex` counter that increments for every meal-type slot, ensuring each slot gets a different meal from the shuffled pool |

## Files Reviewed (clean)
- `client/src/hooks/useAgent.ts` -- `useAgentFeedback` mutation was already correctly implemented; only needed to be consumed by AgentChat
- `supabase/functions/_shared/cors.ts` -- Already had `localhost:3001` in origins list; used as reference for fixing agent/index.ts divergence

## Build Verification
- `npm run build` passes with zero warnings after all fixes applied
