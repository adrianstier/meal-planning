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

### Family Features
- **👶 Kid-Friendly Ratings** - Track which meals your kids actually eat
- **🥗 Leftover Tracking** - Manage leftovers with expiration dates and servings
- **🍎 School Menu Integration** - Track school lunch menus and plan alternatives
- **📝 Shopping Lists** - Auto-generate organized shopping lists from meal plans

### Technical Features
- **📱 Responsive Design** - Works beautifully on desktop, tablet, and mobile
- **⚡ Real-time Updates** - React Query for optimistic UI updates and caching
- **🎨 Modern UI** - Built with Tailwind CSS and shadcn/ui components
- **🔒 Type-Safe** - Full TypeScript support
- **🔐 Secure** - Supabase Auth with Row Level Security

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
│   │   ├── pages/            # Page components
│   │   ├── hooks/            # React Query hooks
│   │   ├── contexts/         # React contexts (Auth)
│   │   ├── lib/              # Supabase client & API
│   │   └── types/            # TypeScript types
│   ├── public/               # Static assets
│   └── .env.local            # Environment variables
│
├── supabase/
│   ├── schema.sql            # Database schema
│   └── rls_policies.sql      # Row Level Security policies
│
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

- `profiles` - User profiles (auto-created on signup)
- `meals` - Recipe storage with ingredients, instructions, and metadata
- `scheduled_meals` - Weekly meal planning
- `leftovers_inventory` - Leftover tracking with expiration
- `school_menu_items` - School lunch menus
- `menu_feedback` - Kid feedback on school meals
- `shopping_items` - Shopping list management
- `meal_history` - Historical meal tracking

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
supabase functions deploy parse-school-menu
```

Set the `ANTHROPIC_API_KEY` secret in your Supabase dashboard.

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
