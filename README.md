# Family Meal Planner

A web application for planning family meals with AI-powered recipe parsing and intelligent meal randomization.

## Features

- **AI Recipe Parser**: Paste any recipe URL or text, and the AI automatically extracts ingredients, cooking times, and dietary information
- **Meal Randomizer**: Generate weekly meal plans with filters for:
  - Dietary preferences (All, Vegetarian, Pescatarian)
  - Time constraints (Quick 30-min meals, Weekend meals)
  - Kid-friendly level (1-10 scale)
- **Recipe Database**: Store all your family's favorite recipes
- **Shopping List Generator**: Automatically create shopping lists from meal plans
- **Browse & Search**: Find meals by name, ingredient, or type

## Quick Start

### Prerequisites

- Python 3.8+
- Anthropic API key (for AI recipe parsing)

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd meal-planning
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY
```

4. Initialize the database:
```bash
python meal_planner.py
```

5. Run the web app:
```bash
python app.py
```

6. Open your browser to: `http://localhost:5000`

## Usage

### Adding Recipes

1. Go to the "Add Recipe" tab
2. Paste a recipe URL or text
3. Click "Parse with AI"
4. Review and save to database

Or manually enter recipe details using the manual entry form.

### Generating Meal Plans

1. Go to the "Meal Randomizer" tab
2. Select your preferences:
   - Dietary preference (All/Vegetarian/Pescatarian)
   - Time constraint (Any/Quick/Weekend)
   - Kid-friendly minimum level
   - Number of days to plan
3. Click "Generate Meal Plan"

### Shopping Lists

1. Go to the "Shopping List" tab
2. Click "Generate Shopping List"
3. Check off items as you shop

## Database Schema

The app uses SQLite with the following main tables:

- `meals`: Recipe information
- `ingredients`: Ingredient catalog
- `meal_ingredients`: Links meals to ingredients
- `meal_plans`: Weekly meal plans
- `scheduled_meals`: Scheduled meals in plans
- `shopping_lists`: Generated shopping lists

See [schema.sql](schema.sql) for full schema.

## CLI Usage

The app also includes a command-line interface:

```bash
# Show this week's meal plan
python cli.py --week

# Generate shopping list
python cli.py --shopping

# Search for meals
python cli.py --search chicken

# Show kid-friendly meals
python cli.py --kid-friendly

# Show all dinners
python cli.py --meals dinner

# Database statistics
python cli.py --stats

# Add a meal interactively
python cli.py --add-meal
```

## Deployment

### Local Development

```bash
python app.py
```

### Production (Heroku, Railway, etc.)

The app is ready to deploy to any platform that supports Python web apps:

1. Set `ANTHROPIC_API_KEY` environment variable
2. Use `gunicorn` to run:
```bash
gunicorn app:app
```

### Docker (Optional)

Create a `Dockerfile`:
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
EXPOSE 5000
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "app:app"]
```

## Technology Stack

- **Backend**: Flask (Python)
- **Database**: SQLite
- **AI**: Anthropic Claude API
- **Frontend**: Vanilla JavaScript, HTML, CSS
- **Styling**: Custom CSS with responsive design

## Data Models

### Meal
- Name, type (dinner/lunch/snack/breakfast)
- Kid-friendly level (1-10)
- Prep and cook time
- Adult-friendly flag
- Notes

### Ingredient
- Name, category
- Kid-friendly level
- Prep difficulty
- Notes

### Meal Plan
- Week dates
- Scheduled meals for each day
- Generated shopping lists

## Contributing

Feel free to add your own meals to the database! The more variety, the better the meal randomizer works.

## Meal Ideas Already Included

The database comes pre-loaded with:
- **Dinners**: Chicken, fish, pasta, quesadillas, burgers, soups, and more
- **Lunches**: Sandwiches, wraps, leftovers
- **Snacks**: Chips & guac, hummus, fruit, yogurt
- **Breakfasts**: Oatmeal, eggs, smoothies, bagels

## Tips for Best Results

1. **Kid-Friendly Ratings**:
   - 8-10: Foods most kids love (mac & cheese, quesadillas)
   - 5-7: Hit or miss (fish, certain veggies)
   - 1-4: Usually for adults (mussels, spicy foods)

2. **Time Constraints**:
   - Quick meals: 30 min or less (weeknight go-tos)
   - Weekend meals: More involved, fun cooking projects

3. **Dietary Filters**:
   - Use "Vegetarian" for meatless weeks
   - Use "Pescatarian" when you want fish but not meat

## License

MIT License - Feel free to use and modify for your family!

## Support

For issues or questions, please open a GitHub issue.

---

Made with ❤️ for families who want to simplify meal planning
