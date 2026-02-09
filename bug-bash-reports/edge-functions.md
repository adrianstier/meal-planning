# Edge Functions -- Bug Bash Report

## Bugs Fixed

| # | File:Line | Severity | Description | Fix Applied |
|---|-----------|----------|-------------|-------------|
| 1 | `supabase/functions/parse-recipe/index.ts:197` | High | **Prompt injection via sourceUrl** -- User-supplied `source_url` was interpolated directly into the AI prompt using template literal (`"${sourceUrl}"`). A `source_url` containing double quotes could break the JSON template and inject arbitrary content into the Claude prompt. | Changed to `JSON.stringify(sourceUrl)` which properly escapes special characters in the string. |
| 2 | `supabase/functions/parse-recipe-image/index.ts:208-224` | Medium | **Falsy zero values silently dropped** -- Numeric fields used `|| null` / `|| 4` instead of proper type checks. If AI returned `0` for calories, protein, carbs, fat, fiber, prep_time, cook_time, or leftover_days, those valid zero values would be replaced with `null` or defaults. Similarly, `servings: 0` would become `4`. | Changed all numeric fields to use `typeof x === 'number'` checks, matching the pattern already used in `parse-recipe/index.ts` and `parse-recipe-url-ai/index.ts`. |
| 3 | `supabase/functions/parse-recipe-url/index.ts:39` | High | **SSRF bypass via HTTP redirect** -- `fetch()` defaults to `redirect: 'follow'`, meaning a public URL could redirect to an internal IP (e.g., `169.254.169.254` AWS metadata endpoint), bypassing the `isPublicUrl()` check that only validates the initial URL. | Added `redirect: 'manual'` to `fetch()` calls, with explicit redirect handling that validates the redirect target URL against `isPublicUrl()` before following. |
| 4 | `supabase/functions/parse-recipe-url-ai/index.ts:49` | High | **SSRF bypass via HTTP redirect** -- Same issue as #3. | Same fix: `redirect: 'manual'` with SSRF-safe redirect following. |
| 5 | `supabase/functions/parse-school-menu/index.ts:42` | High | **SSRF bypass via HTTP redirect** -- Same issue as #3. | Same fix: `redirect: 'manual'` with SSRF-safe redirect following. |
| 6 | `supabase/functions/scrape-restaurant-url/index.ts:45` | High | **SSRF bypass via HTTP redirect** -- Same issue as #3. | Same fix: `redirect: 'manual'` with SSRF-safe redirect following. |
| 7 | `supabase/functions/parse-recipe/index.ts:66` | Medium | **API error details leaked to client** -- `callClaude` threw errors containing raw Anthropic API response text (up to 200 chars), which then propagated through the catch block's `error.message` into the client-facing error response. Could expose API keys in error messages, internal error codes, or rate limit details. | Changed to log the raw error server-side with `console.error()` and throw a generic `'AI service temporarily unavailable'` message. |
| 8 | `supabase/functions/parse-recipe-url-ai/index.ts:173` | Medium | **API error details leaked to client** -- Same issue as #7. | Same fix. |
| 9 | `supabase/functions/parse-school-menu/index.ts:140,199` | Medium | **API error details leaked to client** -- Same issue as #7, in both `callClaude` and `callClaudeWithImage` functions. | Same fix applied to both functions. |
| 10 | `supabase/functions/suggest-meal/index.ts:49` | Medium | **API error details leaked to client** -- Same issue as #7. | Same fix. |
| 11 | `supabase/functions/generate-shopping-list/index.ts:58` | Medium | **API error details leaked to client** -- Same issue as #7. | Same fix. |
| 12 | `supabase/functions/leftover-suggestions/index.ts:49` | Medium | **API error details leaked to client** -- Same issue as #7. | Same fix. |
| 13 | `supabase/functions/lunch-alternatives/index.ts:49` | Medium | **API error details leaked to client** -- Same issue as #7. | Same fix. |
| 14 | `supabase/functions/scrape-restaurant-url/index.ts:113` | Medium | **API error details leaked to client** -- Same issue as #7. | Same fix. |
| 15 | `supabase/functions/suggest-restaurant/index.ts:49` | Medium | **API error details leaked to client** -- Same issue as #7. | Same fix. |

## Issues Noted (not fixed)

| # | File:Line | Severity | Description | Reason Not Fixed |
|---|-----------|----------|-------------|-----------------|
| 1 | `supabase/functions/parse-school-menu/index.ts:336` | Low | **No type check on `menuText` before `.substring()`** -- If `menuText` is not a string (e.g., a number or object), calling `.substring()` would throw a TypeError, resulting in a 500 error. | Error is caught by the outer catch block and returned as a generic error. Low practical impact since the client sends string values. |
| 2 | `supabase/functions/agent/index.ts:15-25` | Low | **CORS origin list out of sync with shared `_shared/cors.ts`** -- Agent function has its own inline CORS configuration that is missing `localhost:3001` which was added to `_shared/cors.ts`. The agent endpoint also uses env var as an override rather than additive (if `ALLOWED_ORIGINS` is set, hardcoded defaults are completely replaced instead of merged). | Different design decisions were made for the agent endpoint. Fixing would require changing its architecture. Not clearly a bug vs. intentional divergence. |
| 3 | `supabase/functions/parse-recipe-image/index.ts:70-101` | Low | **No Content-Length check before `req.json()`** -- Unlike `parse-recipe`, `suggest-meal`, and `agent`, this function doesn't check `Content-Length` before parsing the request body. Since it accepts base64-encoded images (potentially very large), the body is fully parsed into memory before the size check on line 79. | The base64 size check on line 79 still prevents processing oversized images. The missing Content-Length pre-check means the body is parsed first, but Deno's runtime has its own memory limits. Low practical risk. |
| 4 | Multiple functions | Low | **No input type validation on array parameters** -- Functions like `suggest-meal`, `leftover-suggestions`, `lunch-alternatives`, and `suggest-restaurant` destructure array parameters (e.g., `cuisinePreferences`, `dietaryRestrictions`) with default `[]` but never validate they are actually arrays. A string value would still have `.length` and `.join()` would concatenate individual characters. | Produces odd but non-dangerous behavior. The AI would still return reasonable results. Not a security issue. |

## Files Reviewed (clean)

- `supabase/functions/_shared/cors.ts` -- Well-structured shared utilities with proper SSRF protection, rate limiting, CSRF checks, and sanitized error handling. No bugs found.
- `supabase/functions/agent/index.ts` -- Already follows best practices: CSRF check, JWT validation, database-backed rate limiting, Content-Length check, input validation, AbortController timeout, generic error messages. No bugs found (CORS origin list divergence noted above).
