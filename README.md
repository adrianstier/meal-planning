# Family Meal Planner

A modern, AI-powered meal planning application designed for families with young children.

## Features

- **AI Recipe Parser** - Paste any recipe and let AI extract ingredients and details
- **Smart Meal Randomizer** - Generate weekly meal plans with customizable filters
- **Kid-Friendly Ratings** - Every meal rated for kid appeal (1-10 scale)
- **Dietary Filters** - Vegetarian and pescatarian options
- **Time-Based Planning** - Filter by quick meals (≤30 min) or weekend projects
- **Auto Shopping Lists** - Generate organized shopping lists from meal plans
- **Responsive Design** - Works beautifully on desktop, tablet, and mobile

## Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/adrianstier/meal-planning.git
   cd meal-planning
   ```

2. **Set up environment**
   ```bash
   # Create .env file
   echo "ANTHROPIC_API_KEY=your_api_key_here" > .env
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Initialize database**
   ```bash
   python setup.py
   ```

5. **Run the app**
   ```bash
   ./start.sh
   ```

   Or manually:
   ```bash
   python3 app.py
   ```

Visit `http://localhost:5001` in your browser.

## Tech Stack

- **Backend**: Python, Flask
- **Database**: SQLite
- **AI**: Anthropic Claude (Haiku model)
- **Frontend**: HTML, CSS, Vanilla JavaScript
- **Deployment**: Railway (cloud-ready)

## Usage

### Meal Randomizer
1. Go to "Meal Randomizer" tab
2. Select your filters (dietary, time, kid-friendly level)
3. Click "Generate Meal Plan"
4. Get a complete 7-day meal plan instantly

### AI Recipe Parser
1. Go to "Add Recipe" tab
2. Paste any recipe text or URL
3. Click "Parse with AI"
4. Review and save to your database

### Browse & Search
- Search through all your meals
- Filter by meal type
- View ingredients and nutrition info

### Shopping Lists
- Auto-generate from meal plans
- Organized by ingredient category
- Check off items as you shop

## Configuration

The app is configured via environment variables in `.env`:

```
ANTHROPIC_API_KEY=your_api_key_here
FLASK_ENV=development
FLASK_DEBUG=1
```

## Database

Your meals are stored in `meal_planner.db` (SQLite). The database includes:
- 44+ starter meals
- 100+ ingredients
- Meal plans and scheduling
- Shopping lists

## Deployment

### Railway
See [RAILWAY_DEPLOYMENT.md](RAILWAY_DEPLOYMENT.md) for detailed deployment instructions.

Quick deploy:
1. Push to GitHub
2. Connect Railway to your repo
3. Add `ANTHROPIC_API_KEY` environment variable
4. Deploy automatically

## Development

### Project Structure
```
meal-planning/
├── app.py                 # Flask web server
├── meal_planner.py        # Database manager
├── ai_recipe_parser.py    # AI integration
├── cli.py                 # Command-line interface
├── schema.sql             # Database schema
├── seed_data.sql          # Starter meals
├── templates/             # HTML templates
├── static/                # CSS & JavaScript
└── tests/                 # Test suite
```

### Running Tests
```bash
bash ./run_all_tests.sh
```

## CLI Commands

```bash
# View statistics
python cli.py --stats

# Search meals
python cli.py --search "chicken"

# View weekly plan
python cli.py --week

# Generate shopping list
python cli.py --shopping

# Kid-friendly meals
python cli.py --kid-friendly 7
```

## License

MIT License - feel free to use and modify for your family!

## Contributing

This is a personal family project, but suggestions are welcome via issues.

---

Built with love for family meal planning
