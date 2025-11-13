# CSA Box Manager - Feature Guide

## Overview

The CSA (Community Supported Agriculture) Box Manager helps you track your CSA deliveries, farmers market hauls, and find recipes that use your fresh ingredients efficiently while maximizing ingredient diversity.

## Key Features

### 1. **CSA Box Management**
- Create unlimited CSA boxes/deliveries
- Track delivery date, source farm, and notes
- View statistics: total items, used items, unused items
- Delete boxes when fully consumed

### 2. **Ingredient Tracking**
- Add ingredients individually or in bulk
- Track quantity, unit, and estimated expiry
- Mark ingredients as used/unused
- Link used ingredients to specific recipes
- Delete individual items

### 3. **Smart Recipe Matching** 🧠
The system finds recipes that work well with your CSA ingredients using two key metrics:

#### **Diversity Score** (Primary)
- Measures how many different CSA ingredients a recipe uses
- Higher score = better variety utilization
- Example: Recipe using 5 different CSA items > recipe using 2

#### **Match Score**
- Percentage of CSA ingredients the recipe can use
- Shows how efficiently it uses your box
- Example: 80% match = uses 4 out of 5 CSA ingredients

**Why Diversity First?**
Sorting by diversity helps you:
- Use a wider variety of ingredients
- Avoid making the same dishes repeatedly
- Reduce food waste by distributing ingredients across meals
- Discover creative combinations

### 4. **Bulk Input**
Paste your CSA list directly:
```
tomatoes, 5 lbs
carrots, 2 bunches
kale
onions, 3 lbs
bell peppers
```

The system parses each line and creates items automatically!

### 5. **CSA Schedules** (API Ready)
Backend support for recurring deliveries:
- Weekly, bi-weekly, or custom frequency
- Automatic box creation
- Default ingredient templates
- Perfect for regular CSA subscriptions

## How to Use

### Create Your First CSA Box

1. **Navigate to CSA Box page** (Sprout icon in menu)
2. **Click "New CSA Box"**
3. **Fill in details**:
   - Name: "Weekly Veggie Box"
   - Delivery Date: Today's date
   - Source: "Green Valley Farm" (optional)
   - Notes: Any special info

4. **Add ingredients** using either:
   - **Quick Add**: Paste your entire list
   - **Individual Add**: Add one item at a time with quantity/unit

### Find Recipe Matches

1. **Select a CSA box** from the list
2. **Click "Find Recipes"**
3. **View recommendations** sorted by diversity:
   - Green badges show diversity score
   - Gray badges show match percentage
   - See which CSA ingredients each recipe uses
   - View missing ingredients you'd need

### Track Usage

1. **Mark ingredients as used** when you cook with them
2. **Optionally link to recipe** (coming soon in UI)
3. **View used vs. unused stats** on each box
4. **Used items move to "Used Ingredients" section**

## Database Schema

### Tables Created

1. **csa_boxes**: Stores each CSA delivery
   - id, user_id, name, delivery_date, source, notes
   - is_active, created_at

2. **csa_box_items**: Individual ingredients in each box
   - id, box_id, ingredient_name, quantity, unit
   - estimated_expiry_days, is_used, used_in_recipe_id
   - used_date, notes, created_at

3. **csa_schedules**: Recurring delivery schedules
   - id, user_id, name, source, frequency
   - delivery_day, start_date, end_date
   - is_active, auto_create_boxes, default_items

4. **recipe_csa_matches**: Cached recipe recommendations
   - id, box_id, recipe_id, match_score
   - matched_ingredients, missing_ingredients
   - diversity_score, calculated_at

### Indexes for Performance
- `idx_csa_boxes_user_date`: Fast box queries by user and date
- `idx_csa_box_items_box`: Quick item lookups
- `idx_csa_schedules_user`: Efficient schedule queries
- `idx_recipe_matches_box`: Speedy recipe matching

## API Endpoints

### Boxes
- `GET /api/csa/boxes` - List all boxes
- `GET /api/csa/boxes/:id` - Get box with items
- `POST /api/csa/boxes` - Create new box
- `PUT /api/csa/boxes/:id` - Update box
- `DELETE /api/csa/boxes/:id` - Delete box

### Items
- `POST /api/csa/boxes/:boxId/items` - Add item
- `PUT /api/csa/boxes/:boxId/items/:itemId` - Update item
- `DELETE /api/csa/boxes/:boxId/items/:itemId` - Delete item
- `POST /api/csa/boxes/:boxId/items/:itemId/mark-used` - Mark as used

### Recipe Matching
- `GET /api/csa/boxes/:boxId/recipe-matches` - Get recommendations

### Schedules
- `GET /api/csa/schedules` - List schedules
- `POST /api/csa/schedules` - Create schedule
- `DELETE /api/csa/schedules/:id` - Delete schedule

## Recipe Matching Algorithm

```python
def calculate_match(csa_ingredients, recipe_ingredients):
    matched = []
    for csa_ing in csa_ingredients:
        for recipe_ing in recipe_ingredients:
            if csa_ing in recipe_ing or recipe_ing in csa_ing:
                matched.append(csa_ing)
                break

    # Match score: % of CSA ingredients used
    match_score = len(matched) / len(csa_ingredients) * 100

    # Diversity score: unique CSA ingredients used
    diversity_score = len(set(matched)) / len(csa_ingredients) * 100

    return {
        'match_score': match_score,
        'diversity_score': diversity_score,
        'matched': matched
    }
```

**Sorting**: Results sorted by `(diversity_score DESC, match_score DESC)`

This ensures recipes using the most variety of ingredients appear first!

## Use Cases

### Weekly CSA Subscription
1. Create new box each week
2. Add all items from delivery
3. Find diverse recipes throughout the week
4. Mark items as used
5. Track what you loved/didn't use

### Farmers Market Shopping
1. Create box after market visit
2. Bulk add your haul
3. Get recipe ideas for unusual items
4. Maximize variety in meals

### Meal Planning Integration
1. Find CSA-based recipes
2. Add to your weekly meal plan
3. Auto-generate shopping list for missing items
4. Track CSA usage over time

### Food Waste Reduction
1. See unused items at a glance
2. Prioritize recipes using expiring items
3. Track estimated expiry days
4. Get alerts (future feature)

## Tips for Best Results

### Ingredient Naming
- Use common names: "tomatoes" not "heirloom tomatoes"
- Keep it simple: "kale" not "lacinato kale"
- The algorithm does fuzzy matching!

### Recipe Setup
Ensure your recipes have detailed ingredient lists for best matching:
```json
{
  "name": "tomatoes",
  "quantity": 2,
  "unit": "cups"
}
```

### Bulk Adding
Format: `ingredient, quantity unit`
- ✅ "tomatoes, 5 lbs"
- ✅ "carrots, 2 bunches"
- ✅ "kale" (no quantity)
- ✅ "onions, 3 pounds"

## Future Enhancements

- [ ] Recipe quick-link from matches
- [ ] Expiry date alerts
- [ ] Usage history analytics
- [ ] Auto-schedule box creation
- [ ] Import from CSA farm websites
- [ ] Share boxes with household
- [ ] Photo upload for items
- [ ] Nutrition tracking integration

## Benefits

✅ **Never Forget** what's in your CSA box
✅ **Reduce Waste** by tracking and using all items
✅ **Discover Recipes** that use your fresh ingredients
✅ **Maximize Variety** with diversity-first recommendations
✅ **Save Time** with bulk ingredient input
✅ **Track History** of what you received and used
✅ **Plan Better** meals around seasonal produce

## Mobile Support

The CSA Box Manager is fully mobile-responsive:
- Touch-friendly buttons (44x44 minimum)
- Responsive grid layout
- Easy bulk input on mobile
- Swipe-friendly lists
- Works great on tablets too!

---

**Built with**: Flask, SQLite, React, TypeScript, Tailwind CSS
**Deployed to**: Railway & Render (auto-deploy from GitHub)
**Migration**: `database/migrations/add_csa_boxes.py`
