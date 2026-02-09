# Auth & Contexts -- Bug Bash Report

## Bugs Fixed
| # | File:Line | Severity | Description | Fix Applied |
|---|-----------|----------|-------------|-------------|
| 1 | `ErrorLogViewer.tsx:167` | Medium | `filteredLogs.reverse()` mutates the React state array in place. When `filter === 'all'`, `filteredLogs` is the same reference as the `logs` state array. Calling `.reverse()` on it mutates state directly, which violates React's immutability contract and can cause incorrect ordering on subsequent renders (each render reverses the already-reversed array). | Changed to `[...filteredLogs].reverse()` to create a shallow copy before reversing. |
| 2 | `BroadcastSyncContext.tsx:73-76` | Low | `stale: true` is not a valid filter property for `invalidateQueries` in React Query v5. The property is silently ignored, meaning the comment "Only refetch queries that are stale" is misleading -- all active queries get refetched on tab visibility change regardless. | Removed the invalid `stale: true` property and updated the comment to accurately describe the behavior. |
| 3 | `ErrorLogViewer.tsx:39` | Low | Keyboard shortcut `Ctrl+Shift+E` documented as also working with `Cmd+Shift+E` on Mac, but the code only checks `e.ctrlKey`. On macOS, pressing `Cmd` sets `e.metaKey`, not `e.ctrlKey`, so the shortcut does not work on Mac as documented. | Added `e.metaKey` check: `(e.ctrlKey || e.metaKey)`. |
| 4 | `LoginPage.tsx:190-192` | Low | After a successful password reset, `setMode('login')` is called directly instead of `switchMode('login')`. This means the `password` and `confirmPassword` fields are not cleared. When the login form appears, it still contains the password the user just set, which is a confusing UX issue and a minor security concern (password visible in form field). | Added `setPassword('')` and `setConfirmPassword('')` before `setMode('login')`. |

## Issues Noted (not fixed)
| # | File:Line | Severity | Description | Reason Not Fixed |
|---|-----------|----------|-------------|-----------------|
| 1 | `AuthContext.tsx:287-320` | Low | The `login` function manually sets auth state (user, supabaseUser, session) AND `onAuthStateChange` also fires and processes the same session via `handleSession`. This causes double-processing of the login event. | Documented tech debt in CLAUDE.md. Both code paths converge to the same state values. Fixing requires a larger architectural change to unify auth state flow. |
| 2 | `LoginPage.tsx:330` | Low | Form has `noValidate` attribute which disables HTML5 validation, but the login mode has no explicit empty-field checks before calling the API. Empty email/password would hit the Supabase API and return an error handled by the catch block, but the error message may not be as clear as a client-side "please fill in all fields" message. | Not a crash bug; the error catch block provides reasonable user-facing messages. The register mode does have explicit field checks. |
| 3 | `App.tsx` | Low | No catch-all `*` route defined. Navigating to an undefined path (e.g., `/foo`) renders a blank page instead of showing a 404 or redirecting. | Outside scope of auth/contexts focus and not a crash bug. |
| 4 | `OnboardingTour.tsx:229-244` | Low | `handleNext` and `handleSkip` reference `completeTour` but it is excluded from their dependency arrays (with eslint-disable). If `tourKey` or `onComplete` props change, `completeTour` would be stale. | In practice `tourKey` is a constant string and `onComplete` is typically stable. The eslint-disable is acknowledged. |

## Files Reviewed (clean)
- `client/src/contexts/AuthContext.tsx` -- No new bugs beyond documented tech debt
- `client/src/contexts/DragDropContext.tsx` -- Clean, simple context with proper provider check
- `client/src/App.tsx` -- Clean, proper error boundary wrapping and provider ordering
- `client/src/index.tsx` -- Clean, standard CRA entry point
- `client/src/components/Layout.tsx` -- Clean, proper cleanup of body scroll lock, route-based menu close
- `client/src/components/ErrorBoundary.tsx` -- Clean, proper retry limiting and error logging
- `client/src/data/seasonalProduce.ts` -- Clean, static data file with helper functions
- `client/src/serviceWorkerRegistration.ts` -- Clean, standard CRA service worker registration
