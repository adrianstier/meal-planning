# Quick Start Guide

Get your Family Meal Planner up and running in 5 minutes!

## Step 1: Install Dependencies

```bash
pip install -r requirements.txt
```

## Step 2: Set Up Database

```bash
python setup.py
```

This will create a SQLite database with:
- 44 meals (dinners, lunches, snacks, breakfasts)
- 103 ingredients
- Sample weekly meal plan

## Step 3: Configure API Key (Optional)

The AI recipe parser requires an Anthropic API key. If you don't have one yet, you can still use all other features!

```bash
# Copy the example env file
cp .env.example .env

# Edit .env and add your API key
# ANTHROPIC_API_KEY=your_key_here
```

Get your API key at: https://console.anthropic.com/

## Step 4: Start the App

### Option A: Web App (Recommended)

```bash
python app.py
```

Then open: http://localhost:5000

### Option B: Command Line

```bash
# View this week's meal plan
python cli.py --week

# Generate a shopping list
python cli.py --shopping

# Search for meals
python cli.py --search chicken

# Show kid-friendly meals
python cli.py --kid-friendly

# Get help
python cli.py --help
```

## Quick Tour

### 1. Meal Randomizer

Generate a weekly meal plan with your preferences:
- Choose dietary option (All/Vegetarian/Pescatarian)
- Select time constraint (Quick 30-min meals or Weekend meals)
- Set minimum kid-friendly level (1-10)
- Pick number of days to plan

### 2. Add Recipe (AI-Powered)

Paste any recipe URL or text:
```
Chicken Tacos

Ingredients:
- 1 lb chicken breast
- 8 taco shells
- Lettuce, cheese, tomatoes

Instructions:
Cook chicken, assemble tacos...
```

The AI will automatically extract:
- Meal name and type
- Kid-friendly rating
- Prep/cook times
- Ingredients with categories
- Dietary information

### 3. Browse Meals

Search through your 44+ recipes by:
- Name (e.g., "pasta")
- Ingredient (e.g., "chicken")
- Type (dinner, lunch, snack, breakfast)

### 4. Shopping List

Automatically generate shopping lists organized by category:
- Proteins
- Vegetables
- Starches
- Fruits
- Dairy
- Pantry items

## Example Workflow

1. **Monday**: Use meal randomizer to plan the week
   - Select "Quick meals" for weeknights
   - Choose "Pescatarian" option
   - Set kid-friendly level to 7+

2. **Tuesday**: Find a new recipe online
   - Copy recipe text
   - Paste into "Add Recipe" tab
   - Let AI parse it
   - Save to database

3. **Wednesday**: Generate shopping list
   - Click "Generate Shopping List"
   - Check off items as you shop

4. **Throughout the week**: Browse meals when you need inspiration

## Sample Meals Included

### Kid Favorites (9-10/10)
- Quesadillas
- Mac & Cheese
- Chicken Tenders
- Grilled Cheese
- PB&J Sandwiches

### Quick Weeknight Dinners (<30 min)
- Pesto Pasta
- Grilled Chicken with Corn
- Veggie Burgers
- Turkey & Cheese Melts
- Quesadillas with Beans

### Weekend Meals (More involved)
- Baked Chicken with Roasted Veggies
- Beef Meatballs
- Tortilla Soup
- Dinner Crepes
- Mussels Frites (adult option)

### Breakfast Options
- Overnight Banana Oats
- Scrambled Eggs
- Yogurt Bowl
- Berry Smoothie
- Avocado Toast

## Tips for Best Results

1. **Kid-Friendly Ratings**:
   - 8-10: Kids will likely love it
   - 5-7: Hit or miss
   - 1-4: Usually adult-only

2. **Mix It Up**:
   - Use randomizer for variety
   - Add your own family favorites
   - Note what works and what doesn't

3. **Shopping Lists**:
   - Generate at start of week
   - Check pantry first
   - Adjust quantities as needed

4. **Recipe Input**:
   - More detail = better AI parsing
   - Include prep/cook times if available
   - Note any kid preferences

## Troubleshooting

### "No ANTHROPIC_API_KEY found"
- Recipe parsing won't work, but everything else will
- You can still add recipes manually
- Get an API key to enable AI parsing

### "Database not found"
- Run: `python setup.py`

### "Import error"
- Run: `pip install -r requirements.txt`

### "No meals match your criteria"
- Lower the kid-friendly minimum
- Change dietary filter
- Add more meals to database

## Next Steps

- Add your family's favorite recipes
- Customize kid-friendly ratings based on your kids' tastes
- Share recipes with friends
- Contribute back to the project!

## Need Help?

- Check the full [README.md](README.md)
- Run `python cli.py --help`
- Open an issue on GitHub

---

Happy meal planning! 🍽️
