# Family Meal Planner

A modern, AI-powered meal planning application built with React and Supabase, designed for families with young children.

## Features

### Core Meal Planning
- **📅 Weekly Meal Plan** - Visual calendar-based meal planning with drag-and-drop
- **🍽️ Recipe Management** - Store and organize your favorite recipes
- **🔍 Smart Search & Browse** - Find meals by name, type, difficulty, or tags
- **⭐ Favorites** - Mark and filter your family's favorite meals
- **🎲 AI-Powered Suggestions** - Get meal recommendations based on your constraints

### AI-Powered Features
- **🤖 Recipe Parser** - Paste any recipe and let Claude AI extract ingredients and details
- **📸 School Menu Vision** - Upload photos of school menus and AI extracts all menu items
- **🧠 Smart Suggestions** - AI recommends meals based on your meal history and preferences
- **💬 AI Agent Chat** - Interactive chat with specialized meal planning AI agent

### Family Features
- **👶 Kid-Friendly Ratings** - Track which meals your kids actually eat
- **🥗 Leftover Tracking** - Manage leftovers with expiration dates and servings
- **🍎 School Menu Integration** - Track school lunch menus and plan alternatives
- **📝 Shopping Lists** - Auto-generate organized shopping lists from meal plans

### Technical Features
- **📱 Responsive Design** - Works beautifully on desktop, tablet, and mobile
- **⚡ Real-time Updates** - React Query for optimistic UI updates and caching
- **🎨 Modern UI** - Built with Tailwind CSS and shadcn/ui components
- **🔒 Type-Safe** - Full TypeScript with discriminated unions and strict mode
- **🔐 Secure** - Supabase Auth with Row Level Security, CSRF protection, XSS prevention
- **🔄 Multi-tab Sync** - BroadcastChannel API keeps tabs in sync
- **🛡️ Error Recovery** - Graceful error boundaries with partial recovery
- **⚙️ Rate Limiting** - Database-backed rate limiting with atomic operations
- **🧪 E2E Tested** - Playwright tests for critical user flows

## Quick Start

### Prerequisites
- Node.js 18+
- Supabase account
- Anthropic API Key (for AI features)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/adrianstier/meal-planning.git
   cd meal-planning
   ```

2. **Set up Supabase**
   - Create a new project at [supabase.com](https://supabase.com)
   - Go to SQL Editor and run `supabase/schema.sql`
   - Then run `supabase/rls_policies.sql`

3. **Configure environment**
   ```bash
   cd client
   cp .env.local.example .env.local
   # Edit .env.local with your Supabase credentials:
   # REACT_APP_SUPABASE_URL=your_supabase_url
   # REACT_APP_SUPABASE_ANON_KEY=your_anon_key
   ```

4. **Install dependencies and run**
   ```bash
   npm install
   npm start
   ```

Visit `http://localhost:3000` in your browser.

## Project Structure

```
meal-planning/
├── client/                    # React TypeScript frontend
│   ├── src/
│   │   ├── components/       # Reusable UI components
│   │   │   ├── ui/           # shadcn/ui primitives
│   │   │   └── features/     # Feature-specific components
│   │   ├── pages/            # Page components
│   │   ├── hooks/            # React Query hooks
│   │   ├── contexts/         # React contexts (Auth, DragDrop, BroadcastSync)
│   │   ├── lib/              # Supabase client & API layer
│   │   ├── utils/            # Utility functions (errorLogger, etc.)
│   │   └── types/            # TypeScript types
│   ├── public/               # Static assets
│   └── .env.local            # Environment variables
│
├── supabase/
│   ├── functions/            # Edge Functions (AI features)
│   │   ├── agent/            # AI agent endpoint
│   │   ├── parse-recipe/     # Recipe text parser
│   │   ├── parse-recipe-url/ # Recipe URL importer
│   │   ├── suggest-meal/     # AI meal suggestions
│   │   └── _shared/          # Shared utilities (CORS, etc.)
│   ├── migrations/           # Database migrations
│   ├── schema.sql            # Database schema
│   └── rls_policies.sql      # Row Level Security policies
│
├── CLAUDE.md                  # AI assistant guidelines
└── vercel.json               # Vercel deployment config
```

## Tech Stack

**Frontend:**
- React 19 with TypeScript
- React Query (@tanstack/react-query) for data fetching
- React Router DOM for routing
- Tailwind CSS v3 for styling
- Radix UI primitives for accessible components
- shadcn/ui component patterns
- date-fns for date handling
- react-markdown with remark-gfm for safe markdown rendering

**Backend:**
- Supabase (PostgreSQL database)
- Supabase Auth (JWT authentication)
- Row Level Security for data isolation
- Supabase Edge Functions (for AI features)

**Deployment:**
- Vercel (frontend hosting)
- Supabase (database & auth)

## Database Schema

The application uses Supabase PostgreSQL with Row Level Security:

**Core Tables:**
- `profiles` - User profiles (auto-created on signup)
- `meals` - Recipe storage with ingredients, instructions, and metadata
- `scheduled_meals` - Weekly meal planning
- `meal_plans` - Grouping of scheduled meals by week

**Family Features:**
- `leftovers_inventory` - Leftover tracking with expiration
- `school_menu_items` - School lunch menus
- `school_menu_feedback` - Kid feedback on school meals
- `bento_items` / `bento_plans` - Bento box planning

**Utilities:**
- `shopping_items` - Shopping list management
- `meal_history` - Historical meal tracking
- `restaurants` - Local restaurant tracking
- `rate_limits` - Database-backed rate limiting for API endpoints

**Subscription:**
- `subscriptions` - User subscription tiers
- `plan_features` - Feature limits per tier
- `feature_usage` - Usage tracking

All user data is protected by RLS policies ensuring users can only access their own data.

## Deployment

### Vercel Deployment

1. **Push to GitHub**

2. **Connect to Vercel**
   - Import your repository at [vercel.com](https://vercel.com)
   - Vercel will auto-detect the configuration from `vercel.json`

3. **Add environment variables in Vercel dashboard:**
   - `REACT_APP_SUPABASE_URL`
   - `REACT_APP_SUPABASE_ANON_KEY`

4. **Deploy**
   - Vercel will automatically build and deploy on every push

### Supabase Edge Functions (for AI features)

AI features require Supabase Edge Functions with the Anthropic API:

```bash
# Install Supabase CLI
npm install -g supabase

# Login and link project
supabase login
supabase link --project-ref your-project-ref

# Deploy edge functions
supabase functions deploy parse-recipe
supabase functions deploy parse-recipe-url
supabase functions deploy parse-recipe-url-ai
supabase functions deploy parse-school-menu
supabase functions deploy suggest-meal
supabase functions deploy agent
```

Set the `ANTHROPIC_API_KEY` secret in your Supabase dashboard.

**Rate Limiting:** AI endpoints are rate-limited to 30 requests per minute per user, using database-backed tracking that persists across worker restarts.

## Features in Detail

### AI Recipe Parser
The recipe parser uses Claude AI to extract structured data from any recipe text. Simply paste a recipe URL or text, and it automatically extracts:
- Meal name and description
- Ingredients list with quantities
- Step-by-step instructions
- Prep and cook times
- Servings
- Difficulty level
- Dietary tags

### School Menu Vision Parser
Upload a photo of your child's school lunch menu, and Claude Vision will:
- Extract all menu items and dates
- Identify main dishes, sides, and drinks
- Automatically add to your calendar
- Enable feedback tracking for each item

### Smart Meal Suggestions
When planning meals, the AI considers:
- Your meal history and favorites
- Dietary preferences
- Time constraints
- Available leftovers
- Recent meals (avoids repetition)
- Kid-friendly ratings

## Architecture Patterns

### State Management
- **AuthContext** uses a `useReducer` state machine with discriminated unions to prevent race conditions
- **PlanPageEnhanced** groups related state into reducers (dialog state, meal selection state)
- **React Query** handles server state with 5-minute stale time

### Error Handling
- **ErrorBoundary** supports partial recovery without full page reload
- **API errors** are sanitized to hide internal details from users
- **errorLogger** has fallback buffer for localStorage failures

### Performance
- Event handlers wrapped with `useCallback` to prevent unnecessary re-renders
- Pagination built into all list APIs (default: 50 items)
- Multi-tab sync via BroadcastChannel API

### Type Safety
- Discriminated unions for auth state: `'initializing' | 'loading' | 'authenticated' | 'unauthenticated' | 'error'`
- No `any` types - proper interfaces throughout
- Strict TypeScript mode enabled

### Security
- **CSRF Protection** - X-Requested-With header validation on API requests
- **XSS Prevention** - react-markdown for safe AI response rendering
- **SQL Injection** - PostgREST operator escaping for search queries
- **Rate Limiting** - Atomic operations (INSERT ON CONFLICT) prevent race conditions
- **RLS Policies** - Rate limit records are read-only to users; only SECURITY DEFINER functions can modify

## Testing

### E2E Tests (Playwright)

The application includes end-to-end tests using Playwright:

```bash
cd client

# Run all tests
npx playwright test

# Run with UI mode
npx playwright test --ui

# Run specific test file
npx playwright test tests/e2e/meals.spec.ts
```

Tests cover critical flows including authentication, meal CRUD operations, drag-and-drop planning, and AI features.

### Test Configuration

- Tests run against localhost with test credentials
- Configured in `client/playwright.config.ts`
- Test files located in `client/src/tests/`

## Contributing

This is a personal family project, but suggestions and bug reports are welcome via GitHub issues.

## License

MIT License - feel free to use and modify for your family!

## Acknowledgments

- Built with [Anthropic Claude](https://anthropic.com) AI
- Database and Auth by [Supabase](https://supabase.com)
- UI components from [shadcn/ui](https://ui.shadcn.com)
- Icons from [Lucide](https://lucide.dev)
- Hosted on [Vercel](https://vercel.com)

---

**Built with love for family meal planning**
