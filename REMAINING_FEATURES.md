# Remaining Features Implementation Guide

## What's Already Done ✅

### 1. PWA with Offline Support (COMPLETE)
- Files: `client/public/manifest.json`, `client/public/service-worker.js`, `client/src/serviceWorkerRegistration.ts`
- App installs on mobile devices
- Works offline after first visit
- Proper theme colors and icons

### 2. Enhanced Mobile UX (COMPLETE)
- Files: `client/src/pages/ListsPage.tsx`
- All touch targets are 48px+ (h-8 w-8 = 32px, h-10 w-10 = 40px, h-12 = 48px)
- Larger inputs (h-12, text-base)
- Active feedback (active:scale-95)
- Responsive layout

### 3. Shopping List Sharing (COMPLETE)
- Files: `client/src/pages/ListsPage.tsx` (handleShareList function)
- Web Share API with clipboard fallback
- Formats list by category with bullets

### 4. Database Infrastructure (COMPLETE)
- Files:
  - `database/migrations/add_meal_history_and_ratings.py`
  - `database/migrations/add_leftovers_table.py`
  - `setup.py` (runs migrations on deployment)
- Columns: `kid_rating`, `times_cooked`, `notes` in meals table
- Complete leftovers table with expiration tracking

## What Needs to Be Built 🚧

### 4. Kid Approval Ratings System ⭐
**Goal:** Let parents rate meals 1-5 stars for kid approval (Zada & Bowie)

**Files to Create/Modify:**
1. **Backend API** (`app.py`):
   ```python
   @app.route('/api/meals/<int:meal_id>/rating', methods=['PUT'])
   def update_meal_rating(meal_id):
       data = request.json
       rating = data.get('kid_rating')  # 1-5
       # Update meals.kid_rating column
       # Return updated meal
   ```

2. **Frontend Component** (`client/src/components/StarRating.tsx`):
   ```tsx
   // Create reusable star rating component
   // Takes: rating (number), onChange callback, readonly mode
   // Shows 5 stars, filled based on rating
   // Clickable stars to set rating
   ```

3. **Recipe Cards** (`client/src/pages/RecipesPage.tsx`):
   - Add star rating display below meal name
   - Show filled stars for current rating
   - Make clickable to change rating
   - Update via API call

4. **Recipe View Dialog**:
   - Add larger star rating widget
   - Show "Kid Rating: ⭐⭐⭐⭐⭐ (5/5)"

5. **Sorting/Filtering**:
   - Add "Kid Favorites" filter (rating >= 4)
   - Add sort by rating option

**UI Location:** Recipe cards, recipe view dialog

---

### 5. Leftover Tracker with Expiration Dates 🥡
**Goal:** Track leftovers, prevent food waste, suggest remixes

**Files to Create:**

1. **Backend API** (`app.py`):
   ```python
   @app.route('/api/leftovers', methods=['GET'])
   def get_leftovers():
       # Query leftovers table
       # JOIN with meals for meal_name
       # Return all active leftovers

   @app.route('/api/leftovers', methods=['POST'])
   def add_leftover():
       # Insert into leftovers table
       # Calculate expires_date (cooked_date + 3-5 days based on type)
       # Return created leftover

   @app.route('/api/leftovers/<int:id>/consume', methods=['PUT'])
   def consume_leftover(id):
       # Set is_consumed = true
   ```

2. **Frontend Hooks** (`client/src/hooks/useLeftovers.ts`):
   ```tsx
   export const useLeftovers = () => useQuery({...})
   export const useAddLeftover = () => useMutation({...})
   export const useConsumeLeftover = () => useMutation({...})
   ```

3. **Leftovers Page** (`client/src/pages/LeftoversPage.tsx`):
   ```tsx
   // Create new page in router
   // Show list of leftovers grouped by:
   //   - Expiring Soon (< 2 days)
   //   - Fresh (2-4 days)
   //   - Already Expired
   // Each item shows:
   //   - Meal name
   //   - Portions remaining
   //   - Container location
   //   - Days until expiration (color-coded)
   //   - "Mark as Consumed" button
   ```

4. **Add Leftover Dialog**:
   ```tsx
   // Dialog with form:
   //   - Select meal (from recent meals)
   //   - Portions (number input)
   //   - Container location (e.g., "Top shelf, blue container")
   //   - Cooked date (defaults to today)
   //   - Notes (optional)
   ```

5. **Navigation** (`client/src/App.tsx`):
   - Add "Leftovers" tab/link to navigation

**UI Location:** New page in main navigation, badge on nav showing count of expiring items

---

### 6. Smart Weekly Plan Auto-Generation 🤖
**Goal:** AI learns preferences and suggests full week based on history

**Files to Modify:**

1. **Backend AI Logic** (`app.py` - enhance existing `/api/plan/week` endpoint):
   ```python
   def generate_smart_week_plan(start_date, preferences):
       # Get meal history (most/least cooked)
       # Get kid ratings (prefer rated >= 4)
       # Get last_cooked dates (avoid recent repeats)
       # Consider day of week:
       #   - Monday-Thursday: quick meals (<=30 min)
       #   - Friday-Sunday: can be longer
       # Mix protein sources
       # Include 1-2 leftover-friendly meals
       # Include 1-2 bento-friendly for lunches
       # Return 7 days of suggestions
   ```

2. **Enhanced Planning** (`client/src/pages/PlanPage.tsx`):
   - Add "Auto-Generate Week" button
   - Dialog with options:
     - Week start date
     - Dietary preferences (vegetarian days, etc.)
     - Time constraints (all quick, mix, etc.)
     - "Prioritize kid favorites" checkbox
   - Show preview of suggested week
   - Allow editing individual days before saving

3. **AI Prompt Enhancement** (use Claude API):
   ```
   Suggest 7 dinners for a family with 2 kids considering:
   - Previous week's meals: [list]
   - Kid ratings: [meals with 4-5 stars]
   - Avoid repeating: [meals from last 10 days]
   - Monday-Thursday: prefer quick meals
   - Friday: ok for longer cooking
   - Include 1 leftover-friendly meal
   - Include 1 bento-friendly meal
   ```

**UI Location:** Plan page header, prominent "Auto-Generate" button

---

### 7. Bento Box Visual Planner 🍱
**Goal:** Visual grid for planning balanced bento lunches

**Files to Create:**

1. **Bento Planner Component** (`client/src/components/BentoPlanner.tsx`):
   ```tsx
   // Visual grid with 4-6 sections
   // Each section is a "bento compartment"
   // Drag & drop or click to fill:
   //   - Protein (meat, egg, tofu)
   //   - Carb (rice, pasta, bread)
   //   - Veggie 1
   //   - Veggie 2
   //   - Fruit
   //   - Treat
   // Color-coded by food group
   // Visual representation of portions
   ```

2. **Bento Templates** (predefined balanced combos):
   ```tsx
   const bentoTemplates = {
     "Classic Japanese": {
       protein: "Teriyaki chicken",
       carb: "White rice",
       veggie1: "Steamed broccoli",
       veggie2: "Carrot sticks",
       fruit: "Mandarin orange",
       treat: "Seaweed snack"
     },
     // Add 5-10 templates
   }
   ```

3. **Integration with Meal Planning**:
   - Add to PlanPage for lunch slots
   - Save as custom meal type "bento"
   - Generate shopping list from bento components

**UI Location:** Plan page lunch slots, expandable bento planner view

---

### 8. Meal Prep Mode & Batch Cooking 👨‍🍳
**Goal:** Group all week's prep tasks, show timeline

**Files to Create:**

1. **Prep Mode View** (`client/src/pages/PrepModePage.tsx`):
   ```tsx
   // Timeline view showing:
   //   - All ingredients needed for week
   //   - Grouped by prep task:
   //     * Sunday 2pm: Chop all vegetables (30 min)
   //     * Sunday 3pm: Cook rice for week (20 min)
   //     * Sunday 4pm: Marinate chicken (10 min prep)
   //   - What can be done in advance
   //   - What must be done day-of
   //   - Storage instructions
   ```

2. **Batch Cooking Intelligence**:
   ```tsx
   // Analyze week's meals and find:
   //   - Common ingredients (e.g., 3 meals need rice)
   //   - Suggest: "Cook 6 cups rice on Sunday"
   //   - Common prep (e.g., 4 meals need diced onion)
   //   - Suggest: "Dice 2 onions on Sunday"
   //   - Same protein multiple times
   //   - Suggest: "Marinate all chicken on Sunday"
   ```

3. **Prep Checklist**:
   ```tsx
   // Interactive checklist for Sunday prep:
   //   ☐ Wash and chop vegetables
   //   ☐ Cook grains (rice, quinoa)
   //   ☐ Marinate proteins
   //   ☐ Make sauces
   //   ☐ Portion snacks
   // Save progress, resume later
   ```

**UI Location:** New "Prep Mode" button on Plan page, separate prep view

---

### 9. Nutrition Tracking & Balanced Week View 🥗
**Goal:** Ensure balanced nutrition across the week

**Files to Create:**

1. **Nutrition Data** (add to meals table or separate):
   ```sql
   ALTER TABLE meals ADD COLUMN calories INTEGER;
   ALTER TABLE meals ADD COLUMN protein_grams INTEGER;
   ALTER TABLE meals ADD COLUMN carbs_grams INTEGER;
   ALTER TABLE meals ADD COLUMN fat_grams INTEGER;
   ALTER TABLE meals ADD COLUMN fiber_grams INTEGER;
   ```

2. **Nutrition Display** (`client/src/components/NutritionBadge.tsx`):
   ```tsx
   // Show on recipe cards:
   //   - Calories per serving
   //   - Macro breakdown (P/C/F)
   //   - High in: Protein/Fiber/etc
   ```

3. **Weekly Balance View** (`client/src/components/WeeklyNutrition.tsx`):
   ```tsx
   // Visual chart showing:
   //   - Daily calories (bar chart)
   //   - Protein distribution (line graph)
   //   - Variety score (# different vegetables)
   //   - Color balance (eat the rainbow)
   //   - Warnings: "Low fiber Tuesday"
   //   - Suggestions: "Add a salad to balance"
   ```

4. **Nutrition Goals**:
   ```tsx
   // Settings page:
   //   - Daily calorie target
   //   - Macro ratios
   //   - Dietary restrictions
   //   - Highlight meals that meet goals
   ```

**UI Location:** Recipe cards, Plan page weekly summary

---

### 10. Analytics Dashboard with Insights 📊
**Goal:** Show patterns, favorites, time/budget analysis

**Files to Create:**

1. **Analytics Page** (`client/src/pages/AnalyticsPage.tsx`):
   ```tsx
   // Dashboard with cards showing:
   //
   // COOKING PATTERNS:
   //   - Most cooked meals (top 10)
   //   - Least cooked meals (might want to remove?)
   //   - Average cook time by day of week
   //   - Busiest cooking days
   //
   // KID FAVORITES:
   //   - Zada's top rated meals
   //   - Bowie's top rated meals
   //   - Most rejected meals (low ratings)
   //
   // TIME ANALYSIS:
   //   - Average prep time per meal
   //   - Quick meal % (<=30 min)
   //   - Time saved vs eating out
   //
   // VARIETY:
   //   - # unique meals last 30 days
   //   - Protein variety (chicken %, beef %, etc)
   //   - Most used ingredients
   //
   // SHOPPING:
   //   - Most purchased items
   //   - Category spending patterns
   ```

2. **Backend Analytics API** (`app.py`):
   ```python
   @app.route('/api/analytics/summary')
   def get_analytics_summary():
       # Query database for:
       #   - times_cooked aggregates
       #   - kid_rating averages
       #   - last_cooked patterns
       #   - meal_plans history
       # Return JSON with all stats
   ```

3. **Charts** (use recharts library):
   ```bash
   cd client && npm install recharts
   ```
   ```tsx
   import { BarChart, LineChart, PieChart } from 'recharts'
   // Create visualizations for all insights
   ```

**UI Location:** New "Analytics" tab in navigation

---

## Priority Order for Implementation

### High Priority (Do These First):
1. **Kid Approval Ratings** - Simple, high value for family
2. **Leftover Tracker** - Prevents waste, saves money
3. **Smart Weekly Auto-Generation** - Biggest time saver

### Medium Priority:
4. **Meal Prep Mode** - Helpful for Sunday batch cooking
5. **Analytics Dashboard** - Nice insights, not critical

### Lower Priority (Nice to Have):
6. **Bento Box Planner** - Niche use case
7. **Nutrition Tracking** - Complex, requires nutrition data

---

## Technical Notes

### API Endpoints Needed:
```
PUT  /api/meals/<id>/rating        # Update kid_rating
GET  /api/leftovers                # Get all leftovers
POST /api/leftovers                # Add leftover
PUT  /api/leftovers/<id>/consume   # Mark consumed
POST /api/plan/auto-generate       # AI weekly plan
GET  /api/analytics/summary        # All stats
```

### Database Schema Already Ready:
- ✅ `meals.kid_rating` (INTEGER 1-5)
- ✅ `meals.times_cooked` (INTEGER)
- ✅ `meals.notes` (TEXT)
- ✅ `leftovers` table (complete)

### Frontend Dependencies to Add:
```bash
cd client
npm install recharts  # For analytics charts
npm install @dnd-kit/core @dnd-kit/sortable  # For bento drag-drop
```

### Deployment Checklist:
1. Database migrations run automatically via `setup.py`
2. Build React app: `cd client && npm run build`
3. Copy static files: `cp -r client/build/static/* static/`
4. Update `templates/index.html` with new bundle hash
5. Commit and push to GitHub
6. Render auto-deploys from GitHub

---

## Quick Wins (Can Build in 1 Hour Each):

1. **Kid Rating Stars** - Add to existing recipe cards
2. **Leftover Alert** - Just show count of expiring items
3. **Auto-Generate Button** - Use existing AI logic, just make it 7 days

## Testing Checklist:

For each feature:
- [ ] Works on mobile (touch targets, responsive)
- [ ] Works offline (if applicable)
- [ ] Database persists data correctly
- [ ] React Query cache updates properly
- [ ] Loading states shown
- [ ] Error handling works
- [ ] Accessible (aria-labels, keyboard nav)

---

## Current Git Commits:
- `4c48611` - PWA + mobile UX + sharing
- `a561992` - Database migrations
- `be82d15` - Star icon import (prep for ratings)

## Live App:
- URL: https://meal-planning-3xub.onrender.com
- GitHub: https://github.com/adrianstier/meal-planning
- Current bundle: `main.ecc3ab0b.js`
