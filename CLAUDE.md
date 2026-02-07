# CLAUDE.md - Project Context for AI Assistants

This file provides context for AI assistants (like Claude) working on this codebase.

## Project Overview

Family Meal Planner is a React + Supabase application for AI-powered meal planning. It features a multi-agent AI system, recipe parsing, shopping list generation, and family-focused meal tracking.

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | React 19, TypeScript, Tailwind CSS, shadcn/ui, React Query, React Router |
| **UI Components** | Radix UI, Lucide icons, react-markdown, @dnd-kit |
| **Backend** | Supabase (PostgreSQL + Auth + RLS + Edge Functions) |
| **AI** | Anthropic Claude API via Supabase Edge Functions |
| **Testing** | Playwright E2E, Jest |
| **Deployment** | Vercel (frontend), Supabase (backend) |

## Directory Structure

\`\`\`
meal-planning/
├── client/                          # React frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── features/           # Feature-specific components
│   │   │   │   ├── agent/          # AI agent chat UI
│   │   │   │   └── plan/           # Meal planning components
│   │   │   └── ui/                 # Reusable UI components (shadcn)
│   │   ├── contexts/               # React contexts
│   │   │   ├── AuthContext.tsx     # Authentication state
│   │   │   ├── BroadcastSyncContext.tsx  # Multi-tab sync
│   │   │   └── DragDropContext.tsx # Drag-drop state
│   │   ├── hooks/                  # Custom hooks
│   │   │   ├── useAgent.ts         # AI agent interaction
│   │   │   ├── useMeals.ts         # Meal CRUD operations
│   │   │   └── usePlan.ts          # Weekly plan operations
│   │   ├── lib/
│   │   │   ├── api.ts              # All API functions (main file)
│   │   │   └── supabase.ts         # Supabase client
│   │   ├── pages/                  # Route pages
│   │   └── tests/                  # Playwright tests
│   └── playwright.config.ts
│
├── supabase/
│   ├── functions/                  # Edge Functions
│   │   ├── _shared/
│   │   │   ├── agents/             # Multi-agent system
│   │   │   │   ├── orchestrator.ts # Routes requests to agents
│   │   │   │   ├── recipe-agent.ts
│   │   │   │   ├── planning-agent.ts
│   │   │   │   ├── nutrition-agent.ts
│   │   │   │   └── shopping-agent.ts
│   │   │   └── cors.ts
│   │   ├── agent/                  # Main agent endpoint
│   │   ├── parse-recipe/           # Recipe text parsing
│   │   ├── parse-recipe-url/       # Recipe URL scraping
│   │   ├── parse-recipe-image/     # Recipe image OCR
│   │   ├── suggest-meal/           # AI meal suggestions
│   │   └── generate-shopping-list/ # Shopping list AI
│   ├── migrations/                 # Database migrations
│   └── schema.sql                  # Full database schema
\`\`\`

## Key Files to Know

| File | Purpose |
|------|---------|
| \`client/src/lib/api.ts\` | All API functions (~2000 lines) - main data layer |
| \`client/src/contexts/AuthContext.tsx\` | Auth state management with race condition handling |
| \`client/src/hooks/useAgent.ts\` | AI agent hook with AbortController and timeout |
| \`client/src/pages/PlanPageEnhanced.tsx\` | Main meal planning page (~1400 lines) |
| \`supabase/functions/agent/index.ts\` | Main agent endpoint with rate limiting |
| \`supabase/schema.sql\` | Database schema (26 tables) |

## Architecture Patterns

### API Layer (\`client/src/lib/api.ts\`)
- All database operations go through typed API objects (mealsApi, planApi, etc.)
- Uses \`getCurrentUserId()\` for auth checks
- All update/delete operations include \`.eq('user_id', userId)\` for defense-in-depth
- Search uses PostgREST escaping to prevent injection

### Authentication (\`AuthContext.tsx\`)
- Uses Supabase auth with \`onAuthStateChange\` as single source of truth
- AbortController pattern for cleanup on unmount
- Session refresh with refs to avoid dependency loops

### Agent System
- Multi-agent architecture with orchestrator pattern
- Database-backed rate limiting (30 req/60s)
- CSRF protection via \`X-Requested-With\` header
- 30-second timeout on AI API calls

### State Management
- React Query for server state
- BroadcastChannel for multi-tab sync
- Local refs for mutable state in callbacks

## Security Considerations

### Implemented
- Row Level Security (RLS) on all tables
- User ID validation in application layer
- PostgREST operator escaping in search
- CSRF protection on agent endpoint
- Rate limiting (database-backed)
- XSS prevention via react-markdown
- Input validation (message length, file types)

### Important Notes
- Never trust client-side validation alone
- Always include \`.eq('user_id', userId)\` on mutations
- Rate limiter uses \`SECURITY DEFINER\` functions - users cannot modify their limits
- Error messages are sanitized before returning to client

## Common Tasks

### Adding a New API Endpoint
1. Add function to appropriate API object in \`api.ts\`
2. Include \`getCurrentUserId()\` check
3. Add \`.eq('user_id', userId)\` to queries
4. Use \`wrapResponse()\` for consistent return format
5. Add error logging via \`errorLogger.logApiError()\`

### Adding a New Edge Function
1. Create folder in \`supabase/functions/\`
2. Use \`corsHeaders\` from \`_shared/cors.ts\`
3. Validate JWT with \`supabase.auth.getUser()\`
4. Add timeout with AbortController
5. Sanitize error messages before returning

### Running Tests
\`\`\`bash
cd client
npx playwright test              # Run all tests
npx playwright test --ui         # Interactive mode
npx playwright test --debug      # Debug mode
\`\`\`

### Database Migrations
\`\`\`bash
supabase migration new <name>    # Create migration
supabase db push                 # Apply to remote
supabase migration list          # Check status
\`\`\`

## Known Issues / Tech Debt

1. **AuthContext**: Manual operations (login, register, checkAuth) dispatch state directly instead of relying solely on \`onAuthStateChange\`. Works but could be cleaner.

2. **PlanPageEnhanced**: Has 20+ useState calls. Could benefit from useReducer refactor.

3. **Mobile scroll**: Pre-existing UX issue with scroll behavior on mobile viewports.

## Testing Credentials

See \`TEST_CREDENTIALS.md\` for test account details.

## Environment Variables

### Client (.env.local)
\`\`\`
REACT_APP_SUPABASE_URL=
REACT_APP_SUPABASE_ANON_KEY=
\`\`\`

### Supabase Edge Functions (secrets)
\`\`\`
ANTHROPIC_API_KEY=
ALLOWED_ORIGINS=  # Comma-separated list
\`\`\`

## AI Edge Functions - Verified Working (2026-02)

All AI features have been tested and verified functional:

### parse-recipe-url-ai
Extracts recipe from any URL using Claude AI.
- **Tested with**: AllRecipes, Simply Recipes, Bon Appetit
- **Returns**: name, meal_type, servings, cook_time, ingredients, instructions, nutrition

### parse-recipe
Parses recipe from plain text.
- **Parameter**: `recipe_text` (not `text`)
- **Returns**: Structured recipe data with nutrition extraction

### parse-recipe-image
Extracts recipe from photos using Claude vision.
- **Input**: Base64-encoded image data
- **Returns**: Full recipe with kid-friendly rating, tags

### Test Files
- `client/src/tests/test-ai-features.sh` - Comprehensive AI test script
- `client/src/tests/test-data/test-recipes.json` - Sample URLs and text recipes

## Recent Changes (2026-02-04)

### Fixes Applied
1. **AuthContext loading state** - Changed `initializing` to `loading` in `App.tsx`
2. **CORS** - Added `localhost:3001` to allowed origins in `cors.ts`
3. **ESLint warnings** - Fixed all build warnings:
   - Removed unused imports in multiple pages
   - Added eslint-disable for reserved future-use variables
   - Fixed missing useEffect dependencies

### Files Modified
- `client/src/App.tsx` - ProtectedRoute uses `loading` not `initializing`
- `client/src/components/OnboardingTour.tsx` - Fixed dependency warnings
- `client/src/hooks/useRestaurants.ts` - Removed unused queryClient
- `client/src/pages/DiagnosticsPage.tsx` - Fixed imports and dependencies
- `client/src/pages/HolidayPlannerPage.tsx` - Fixed imports
- `client/src/pages/PlanPageEnhanced.tsx` - Fixed unused variable warnings
- `client/src/pages/RestaurantsPage.tsx` - Fixed imports
- `client/src/pages/SeasonalCookingPage.tsx` - Fixed imports and dependencies
- `supabase/functions/_shared/cors.ts` - Added localhost:3001

### Build Status
- Clean build with no warnings
- All 22 Playwright tests passing

---

## File Ownership (parallel work)
- `client/` — frontend app, splittable by feature
- `supabase/` — backend/database, independent from frontend
- Root `.md` files — planning docs, independent
