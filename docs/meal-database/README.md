# Meal Idea Database

This is a sidecar meal and food database built from Adrian's rough starter list. It is intentionally separate from the live Supabase schema until the Supabase project connection is restored.

## Files

- `meal-ideas.csv` - 100 potential meals, sides, breakfasts, cookbook recipes, and things to learn.
- `foods-and-staples.csv` - 35 weekly vegetables, roots, breakfast staples, pantry staples, freezer staples, and non-food kitchen staples.
- `source-notes/` - typed transcriptions and interpretation notes for photo or handwritten sources.

## Field Notes

`meal-ideas.csv` uses:

- `collection` - the source bucket from the rough list, such as `regular_meals_with_meat`, `easy_meals`, `veggie_recipes_to_try`, `breakfast`, `photo_1_weekly_plan`, or `photo_1_brainstorm`.
- `meal_type` - `breakfast`, `dinner`, or `side`.
- `protein` - rough planning label, not nutrition analysis.
- `source_type` - `family`, `cookbook`, or `url`.
- `source`, `page`, `url` - cookbook or web reference when supplied.
- `tags` - semicolon-separated planning tags.
- `notes` - uncertainty, original spellings, or context from the pasted list.

`foods-and-staples.csv` uses:

- `collection` - planning bucket, such as `weekly_veggies`, `weekly_roots`, `breakfast_staples`, `pantry_staples`, `freezer_staples`, or `non_organic_supply`.
- `food_type` - rough grocery/food category.
- `frequency` - currently `weekly` or `as_needed`.

## Import Direction

When Supabase is reachable again, these rows can be imported either into the existing `meals` table as lightweight recipe placeholders or into a new `meal_ideas` table. A separate `meal_ideas` table is cleaner because many rows are ideas, sides, or cookbook references rather than full recipes with ingredients and instructions.
