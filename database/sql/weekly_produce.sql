-- Weekly Vegetables and Roots
-- Additional produce commonly used in family meal planning

-- Weekly Veggies
INSERT OR IGNORE INTO ingredients (name, category, kid_friendly_level, prep_difficulty, notes) VALUES
    ('Zucchini', 'veggie', 7, 'easy', 'Great roasted or in pasta'),
    ('Broccoli', 'veggie', 6, 'easy', 'Popular steamed or roasted'),
    ('Mixed lettuce', 'veggie', 8, 'easy', 'For salads and eggs'),
    ('Cauliflower', 'veggie', 6, 'easy', 'Versatile veggie, can be riced'),
    ('Asparagus', 'veggie', 5, 'easy', 'More adult-friendly veggie'),
    ('Cherry tomatoes', 'veggie', 9, 'easy', 'Kids love these as snacks'),
    ('Button mushrooms', 'veggie', 5, 'easy', 'Add umami to dishes'),
    ('Snow peas', 'veggie', 8, 'easy', 'Crunchy and slightly sweet');

-- Weekly Roots
INSERT OR IGNORE INTO ingredients (name, category, kid_friendly_level, prep_difficulty, notes) VALUES
    ('Fingerling potatoes', 'veggie', 9, 'easy', 'Great roasted'),
    ('Shallot', 'veggie', 6, 'easy', 'Milder than onions'),
    ('Garlic', 'veggie', 7, 'easy', 'Essential for flavor');

-- Note: Some items like 'Sweet potato', 'Onions' already exist in the database
-- This script uses INSERT OR IGNORE to avoid duplicates

-- Update existing ingredients if needed
UPDATE ingredients SET notes = 'Versatile root vegetable, kid-friendly' WHERE name = 'Sweet potatoes';
UPDATE ingredients SET notes = 'Essential aromatic for many dishes' WHERE name = 'Onions';
