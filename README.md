# Family Meal Planner

A modern, AI-powered meal planning application built with React and Flask, designed for families with young children.

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
- **🔒 Type-Safe** - Full TypeScript support in frontend

## Quick Start

### Prerequisites
- Python 3.9+
- Node.js 18+
- Anthropic API Key (for AI features)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/adrianstier/meal-planning.git
   cd meal-planning
   ```

2. **Set up environment**
   ```bash
   # Create .env file with your API key
   cp .env.example .env
   # Edit .env and add your ANTHROPIC_API_KEY
   ```

3. **Install Python dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Install and build React frontend**
   ```bash
   cd client
   npm install
   npm run build
   cd ..
   ```

5. **Initialize database**
   ```bash
   python setup.py
   ```

6. **Run the application**
   ```bash
   python app.py
   ```

Visit `http://localhost:5001` in your browser.

## Development

### Running in Development Mode

**Backend (Flask):**
```bash
python app.py
# Runs on http://localhost:5001
```

**Frontend (React Dev Server):**
```bash
cd client
npm start
# Runs on http://localhost:3000 with hot reload
```

The React dev server will proxy API requests to Flask on port 5001.

### Project Structure

```
meal-planning/
├── app.py                          # Flask web server & REST API
├── meal_planner.py                 # Database manager
├── ai_recipe_parser.py             # AI recipe parsing
├── school_menu_vision_parser.py    # AI vision for school menus
├── cli.py                          # Command-line interface
├── setup.py                        # Database initialization
│
├── client/                         # React TypeScript frontend
│   ├── src/
│   │   ├── components/            # Reusable UI components
│   │   ├── pages/                 # Page components
│   │   ├── hooks/                 # React Query hooks
│   │   ├── lib/                   # API client & utilities
│   │   └── types/                 # TypeScript types
│   ├── public/                    # Static assets
│   └── build/                     # Production build (gitignored)
│
├── database/
│   ├── sql/                       # Schema and seed data
│   │   ├── schema.sql
│   │   ├── seed_data.sql
│   │   ├── additional_meals.sql
│   │   └── weekly_produce.sql
│   └── migrations/                # Database migrations
│       ├── migrate_to_react_schema.py
│       └── *.sql
│
├── tests/                         # Test files
│   ├── test_app.py
│   ├── test_ai_parser.py
│   └── test_integration.py
│
├── templates/                     # Flask templates (serves React)
│   └── index.html
├── static/                        # Static files (React build)
│   ├── css/
│   ├── js/
│   └── media/
│
├── static_vanilla_backup/         # Original vanilla JS (backup)
└── templates_vanilla_backup/      # Original templates (backup)
```

### Tech Stack

**Frontend:**
- React 18 with TypeScript
- React Query (@tanstack/react-query) for data fetching
- React Router DOM for routing
- Tailwind CSS v3 for styling
- Radix UI primitives for accessible components
- shadcn/ui component patterns
- date-fns for date handling

**Backend:**
- Python 3.9+
- Flask web framework
- SQLite database
- Anthropic Claude API (Sonnet 3.5 for vision, Haiku for recipes)
- Flask-CORS for API access

**Deployment:**
- Railway (cloud hosting)
- Gunicorn WSGI server
- GitHub integration for CI/CD

## API Endpoints

### Meals
- `GET /api/meals` - Get all meals
- `GET /api/meals/:id` - Get meal by ID
- `POST /api/meals` - Create new meal
- `PUT /api/meals/:id` - Update meal
- `DELETE /api/meals/:id` - Delete meal
- `POST /api/meals/parse` - Parse recipe with AI
- `GET /api/meals/search?q=query` - Search meals

### Meal Plans
- `GET /api/plan/week?start_date=YYYY-MM-DD` - Get week's meal plan
- `POST /api/plan` - Add meal to plan
- `PUT /api/plan/:id` - Update planned meal
- `DELETE /api/plan/:id` - Remove from plan
- `POST /api/plan/suggest` - Get AI meal suggestions

### Leftovers
- `GET /api/leftovers` - Get active leftovers
- `POST /api/leftovers` - Add leftover
- `POST /api/leftovers/:id/consume` - Mark as consumed
- `PUT /api/leftovers/:id/servings` - Update servings
- `GET /api/leftovers/suggestions` - Get leftover-based suggestions

### School Menu
- `GET /api/school-menu?date=YYYY-MM-DD` - Get menu for date
- `POST /api/school-menu` - Add menu item(s)
- `DELETE /api/school-menu/:id` - Delete menu item
- `POST /api/school-menu/parse-photo` - Parse menu photo with AI
- `POST /api/school-menu/feedback` - Add feedback for menu item
- `GET /api/school-menu/calendar` - Get calendar view

### Shopping List
- `GET /api/shopping` - Get shopping list
- `POST /api/shopping` - Add item
- `PUT /api/shopping/:id` - Update item
- `DELETE /api/shopping/:id` - Delete item
- `POST /api/shopping/:id/toggle` - Toggle purchased
- `POST /api/shopping/generate` - Generate from meal plan

## Configuration

### Environment Variables

```bash
# Required for AI features
ANTHROPIC_API_KEY=your_api_key_here

# Optional Flask configuration
FLASK_ENV=development
FLASK_DEBUG=1
```

### Database

The application uses SQLite with the following tables:
- `meals` - Recipe storage with ingredients, instructions, and metadata
- `meal_plans` - Weekly meal planning
- `leftovers` - Leftover tracking with expiration
- `school_menu_items` - School lunch menus
- `menu_feedback` - Kid feedback on school meals
- `shopping_items` - Shopping list management
- `meal_history` - Historical meal tracking

## Deployment

### Railway Deployment

See [RAILWAY_DEPLOYMENT.md](RAILWAY_DEPLOYMENT.md) for detailed instructions.

**Quick deploy:**
1. Push to GitHub
2. Connect Railway to your repository
3. Add `ANTHROPIC_API_KEY` environment variable in Railway
4. Deploy automatically

The app is configured for Railway with:
- `Procfile` - Gunicorn configuration
- `runtime.txt` - Python version specification
- `requirements.txt` - Python dependencies
- Automatic database initialization on first deploy

## CLI Commands

```bash
# View database statistics
python cli.py --stats

# Search meals
python cli.py --search "chicken"

# View this week's meal plan
python cli.py --week

# Generate shopping list
python cli.py --shopping

# Find kid-friendly meals (rating ≥ 7)
python cli.py --kid-friendly 7

# Quick meals (≤ 30 minutes)
python cli.py --quick

# View all commands
python cli.py --help
```

## Testing

```bash
# Run all tests
bash ./run_all_tests.sh

# Run specific test file
python -m pytest tests/test_app.py

# Run with coverage
python -m pytest --cov=. tests/
```

## Features in Detail

### AI Recipe Parser
The recipe parser uses Claude AI (Haiku) to extract structured data from any recipe text. Simply paste a recipe URL or text, and it automatically extracts:
- Meal name and description
- Ingredients list with quantities
- Step-by-step instructions
- Prep and cook times
- Servings
- Difficulty level
- Dietary tags

### School Menu Vision Parser
Upload a photo of your child's school lunch menu, and Claude Vision (Sonnet 3.5) will:
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
- UI components from [shadcn/ui](https://ui.shadcn.com)
- Icons from [Lucide](https://lucide.dev)

---

**Built with ❤️ for family meal planning**
