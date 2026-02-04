# Meal Planning App - Frontend

A modern meal planning application with AI-powered recipe import and intelligent meal scheduling.

## Features

- **AI Recipe Import** - Import recipes from URLs, photos, or text using Claude AI
- **Weekly Meal Planning** - Drag-and-drop meal scheduling with multi-week view
- **Recipe Management** - Full CRUD with favorites, tags, and ratings
- **Smart Shopping Lists** - Auto-generated from meal plans
- **Seasonal Cooking** - CSA box tracking and seasonal produce suggestions
- **Restaurant Database** - Save and track favorite restaurants
- **Holiday Planning** - Special event meal planning with timelines

## Tech Stack

- React 19 with TypeScript
- TanStack React Query for data fetching
- Tailwind CSS + Radix UI components
- React Router v7
- Supabase (Auth + Database)
- Playwright for E2E testing

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation
```bash
npm install
```

### Environment Setup
Create a `.env.local` file:
```
REACT_APP_SUPABASE_URL=your-supabase-url
REACT_APP_SUPABASE_ANON_KEY=your-anon-key
```

### Development
```bash
# Start dev server (port 3001 recommended to avoid conflicts)
PORT=3001 npm start

# Or default port
npm start
```

### Build
```bash
npm run build
```

### Testing
```bash
# Run Playwright E2E tests
npx playwright test

# Run with UI
npx playwright test --ui

# Run specific test
npx playwright test --grep "recipe"
```

## Project Structure

```
src/
├── components/           # Reusable UI components
│   ├── ui/              # Base components (Button, Card, Dialog, etc.)
│   └── features/        # Feature-specific components
├── contexts/            # React contexts
│   ├── AuthContext.tsx  # Authentication state
│   └── DragDropContext.tsx
├── hooks/               # Custom React hooks
│   ├── useMeals.ts      # Recipe/meal operations
│   ├── usePlan.ts       # Meal planning operations
│   └── useRestaurants.ts
├── lib/
│   ├── api.ts           # API client (all endpoints)
│   ├── supabase.ts      # Supabase client
│   └── utils.ts         # Utility functions
├── pages/               # Page components
│   ├── RecipesPage.tsx  # Recipe management
│   ├── PlanPageEnhanced.tsx  # Meal planning
│   └── ...
└── tests/               # Test files
    └── user-simulations/  # Playwright tests
```

## AI Features

The app uses Anthropic Claude for intelligent recipe parsing:

| Feature | Endpoint | Description |
|---------|----------|-------------|
| URL Import | `parse-recipe-url-ai` | Extracts recipe from any URL |
| Photo Import | `parse-recipe-image` | Extracts recipe from photos |
| Text Parsing | `parse-recipe` | Parses plain text recipes |

All AI features extract:
- Recipe name, ingredients, instructions
- Prep/cook times, servings, difficulty
- Cuisine type, tags, nutrition info
- Kid-friendly rating

## Test Credentials

For development/testing:
- Email: `claudetest@mealplanner.dev`
- Password: `ClaudeTest2024`

## Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Start development server |
| `npm run build` | Production build |
| `npm test` | Run Jest tests |
| `npx playwright test` | Run E2E tests |

## Configuration

### Playwright
Configuration in `playwright.config.ts`:
- Base URL: `http://localhost:3001`
- Browser: Chromium
- Screenshots on failure
- Video on retry

### TypeScript
Strict mode enabled with comprehensive type checking.

## Deployment

The app is deployed on Vercel:
- Production: Connected to `main` branch
- Preview: Auto-deploy on PRs

## Related Documentation

- [CLAUDE.md](../CLAUDE.md) - Full project context for Claude Code
- [BUG_REPORT.md](../BUG_REPORT.md) - Bug tracking and fixes
- [.claude/system.md](../.claude/system.md) - Development priorities
