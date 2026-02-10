# Regression Check (Server) -- Bug Bash Report

## Fixes Verified Correct

| # | File | Fix | Status |
|---|------|-----|--------|
| 1a | `supabase/functions/lunch-alternatives/index.ts` | AbortController + 30s timeout + signal on fetch + clearTimeout in finally | PASS |
| 1b | `supabase/functions/suggest-restaurant/index.ts` | AbortController + 30s timeout + signal on fetch + clearTimeout in finally | PASS |
| 1c | `supabase/functions/scrape-restaurant-url/index.ts` | AbortController + 30s timeout + signal on fetch + clearTimeout in finally (both fetchPage and callClaude) | PASS |
| 1d | `supabase/functions/parse-school-menu/index.ts` | AbortController + 30s timeout + signal on fetch + clearTimeout in finally (fetchPage, callClaude, and callClaudeWithImage) | PASS |
| 2a | `supabase/functions/parse-recipe-url/index.ts` | `redirect: 'manual'` in fetchPage, redirect target validated with `isPublicUrl()` before following | PASS |
| 2b | `supabase/functions/parse-recipe-url-ai/index.ts` | `redirect: 'manual'` in fetchPage, redirect target validated with `isPublicUrl()` before following | PASS |
| 2c | `supabase/functions/parse-school-menu/index.ts` | `redirect: 'manual'` in fetchPage, redirect target validated with `isPublicUrl()` before following | PASS |
| 2d | `supabase/functions/scrape-restaurant-url/index.ts` | `redirect: 'manual'` in fetchPage, redirect target validated with `isPublicUrl()` before following | PASS |
| 3a | `supabase/functions/lunch-alternatives/index.ts` | callClaude logs error server-side, throws generic `'AI service temporarily unavailable'` | PASS |
| 3b | `supabase/functions/suggest-restaurant/index.ts` | callClaude logs error server-side, throws generic message | PASS |
| 3c | `supabase/functions/scrape-restaurant-url/index.ts` | callClaude logs error server-side, throws generic message | PASS |
| 3d | `supabase/functions/parse-school-menu/index.ts` | Both callClaude and callClaudeWithImage log errors server-side, throw generic message | PASS |
| 3e | `supabase/functions/parse-recipe-url-ai/index.ts` | callClaude logs error server-side, throws generic message | PASS |
| 3f | `supabase/functions/parse-recipe/index.ts` | callClaude logs error server-side, throws generic message | PASS |
| 3g | `supabase/functions/suggest-meal/index.ts` | callClaude logs error server-side, throws generic message | PASS |
| 3h | `supabase/functions/generate-shopping-list/index.ts` | callClaude logs error server-side, throws generic message | PASS |
| 3i | `supabase/functions/agent/index.ts` | callAI logs error server-side, throws generic `'AI service temporarily unavailable'`; outer catch returns generic messages | PASS |
| 3j | `supabase/functions/parse-recipe-image/index.ts` | Uses `handleAnthropicError()` from cors.ts which returns sanitized user messages; raw error logged server-side | PASS |
| 4 | `supabase/functions/parse-recipe-url/index.ts` | `checkRateLimitSync` called at line 269 after auth (line 263) and before business logic (line 274) | PASS |
| 5 | `supabase/functions/parse-recipe/index.ts` | `sourceUrl` passed through `JSON.stringify(sourceUrl)` at line 198 instead of template literal interpolation, preventing prompt injection | PASS |
| 6 | `supabase/functions/parse-recipe-image/index.ts` | All numeric fields use `typeof x === 'number'` checks (lines 208-222) instead of falsy-zero-unsafe `x \|\| default` pattern | PASS |
| 7a | `supabase/functions/_shared/agents/orchestrator.ts` | User message logged as `role: 'user'` (line 461) with content being the actual user message; assistant response logged as `role: 'orchestrator'` (line 467) -- threading is correct | PASS |
| 7b | `supabase/functions/_shared/agents/recipe-agent.ts` | Vision API call uses direct fetch with proper image content block structure (lines 318-350); AbortController with 30s timeout and clearTimeout in finally block | PASS |
| 7c | `supabase/functions/_shared/agents/shopping-agent.ts` | Cost estimate has proper null check: `if (!costResult.success \|\| !costResult.data)` at line 485 before accessing estimate properties | PASS |

## Regressions Found & Fixed

| # | File:Line | Issue | Fix |
|---|-----------|-------|-----|
| R1 | `_shared/agents/base-agent.ts:134-136` | `callAI()` threw `Anthropic API error: ${response.status} - ${errorText}` exposing raw API error text to callers. All 5 agents (orchestrator, recipe, planning, nutrition, shopping) use `callAI()`, and their error handlers pass `error.message` back to client responses, so raw Anthropic error details could leak to users. | Changed to `console.error(...)` server-side log + `throw new Error('AI service temporarily unavailable')` -- matching the pattern used in all standalone edge functions. |
| R2 | `_shared/agents/base-agent.ts:231-233` | `callAIWithTools()` had the same raw error leak as `callAI()`. | Applied identical fix: log server-side, throw generic message. |
| R3 | `_shared/agents/recipe-agent.ts:352-354` | `processImage()` Vision API call threw `Anthropic API error: ${response.status} - ${errorText}` which flows through to the catch block at line 393 and into the error message at line 397: `error.message` exposed to client. | Changed to `console.error('[RecipeAgent] Vision API error (...)')` server-side log + `throw new Error('AI service temporarily unavailable')`. |

## Additional Notes

### SSRF redirect protection -- follow-up observation (no fix needed now)

All four `fetchPage()` implementations only follow one redirect (they pass `redirect: 'manual'` on the redirect follow-up fetch too). This means a chain of 2+ redirects would fail with a non-OK status error. This is actually more secure (prevents redirect chains that could eventually reach internal hosts), but it does mean some legitimate multi-redirect sites may fail. This is acceptable behavior for a security-focused implementation.

### Error propagation in edge function catch blocks

Several edge functions have outer catch blocks that format `error.message` into the response (e.g., `Failed to parse recipe: ${message}`). Now that all `callClaude`/`callAI` functions throw only generic messages, these catch blocks will only ever produce messages like `Failed to parse recipe: AI service temporarily unavailable`, which is safe. The `AbortError` case (timeout) would produce `Failed to parse recipe: The operation was aborted` -- also acceptable.

### Agent system `callAI` vs standalone `callClaude`

The agent system's `BaseAgent.callAI()` was the last remaining place where raw Anthropic API errors could leak. All standalone edge function `callClaude()` implementations were already correctly sanitized. The three fixes above bring the agent system in line with the standalone functions.
