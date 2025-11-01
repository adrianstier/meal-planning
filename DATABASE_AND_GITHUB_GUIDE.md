
**Your Current Database:**

```
📋 Meals: 49 (you've added 5 since setup!)
   • Dinners: 28
   • Breakfasts: 9
   • Lunches: 6
   • Snacks: 6

🥘 Ingredients: 118
   • Veggies: 31
   • Starches: 20
   • Proteins: 19
   • And more...

📅 Meal Plans: 1 (this week's plan)
📍 Scheduled Meals: 19
💾 Size: 84 KB
```

---

## 🔄 How Data Persists

### Local Storage (Your Computer):

```
Every time you:
1. Add a recipe       → Saved to meal_planner.db
2. Generate a plan    → Saved to meal_planner.db
3. Close the app      → Data stays in meal_planner.db
4. Restart the app    → Reads from meal_planner.db
```

**The database file is just sitting on your hard drive**, like a Word document.

### What Happens When You:

**Restart Your Computer:**
- ✅ Database file still there
- ✅ All meals preserved
- ✅ Just run `./start.sh` again

**Update the Code (via git pull):**
- ✅ Database file unchanged
- ✅ Your meals still there
- ✅ Code updates don't affect your data

**Share Code on GitHub:**
- ✅ Others get the code
- ❌ They don't get your database
- ✅ They create their own from scratch

---

## 🌐 Sharing the App (Multiple Scenarios)

### Scenario 1: You & Your Wife on Same Computer

**Current Setup:**
- One database file
- Both use same http://localhost:5001
- Share the same meals
- Add recipes together

**Perfect for:**
- Family meal planning
- Collaborative recipe collection

### Scenario 2: Different Computers (Same House)

**Option A: Shared Database (Advanced)**
- Use a network-shared database
- Both computers access same database
- Requires PostgreSQL or MySQL

**Option B: Individual Databases (Simpler)**
- Each computer has own database
- Clone the GitHub repo to each computer
- Each starts with the 44 sample meals
- Add recipes independently
- Share by pushing to GitHub

### Scenario 3: Deploy to Internet (Optional)

**Deploy to Heroku/Railway:**
- App runs on internet
- Access from anywhere
- Use PostgreSQL database (cloud)
- Everyone shares same database
- Perfect for: Family access from multiple devices

---

## 🔧 Database Maintenance

### Backup Your Database:

```bash
# Simple copy
cp meal_planner.db meal_planner_backup_$(date +%Y%m%d).db

# Or use the automated backup
python3 -c "
import shutil
from datetime import datetime
backup = f'meal_planner_backup_{datetime.now().strftime(\"%Y%m%d_%H%M%S\")}.db'
shutil.copy('meal_planner.db', backup)
print(f'Backed up to: {backup}')
"
```

### Restore from Backup:

```bash
cp meal_planner_backup_20251101.db meal_planner.db
```

### Reset Database:

```bash
# Delete current database
rm meal_planner.db

# Rebuild from scratch
python3 setup.py

# You'll have the original 44 meals again
```

### Export Your Custom Meals:

```bash
# Export to SQL
python3 -c "
import sqlite3
conn = sqlite3.connect('meal_planner.db')

# Get all meals you've added (after ID 44)
cursor = conn.cursor()
cursor.execute('SELECT * FROM meals WHERE id > 44')

print('-- Your custom meals:')
for row in cursor.fetchall():
    print(f'-- {row}')
"
```

---

## 📦 What Happens on GitHub

### Your Repository Structure:

```
github.com/yourusername/meal-planning/
├── app.py                    ✅ In repo
├── meal_planner.py           ✅ In repo
├── schema.sql                ✅ In repo (database blueprint)
├── seed_data.sql             ✅ In repo (starter meals)
├── templates/                ✅ In repo
├── static/                   ✅ In repo
├── README.md                 ✅ In repo
├── .gitignore                ✅ In repo (protects secrets)
│
├── meal_planner.db           ❌ NOT in repo (your data)
├── .env                      ❌ NOT in repo (your key)
└── key.txt                   ❌ NOT in repo (your key)
```

### When You Push Updates:

```bash
# You add a new feature
git add app.py
git commit -m "Added export feature"
git push

# GitHub gets:
✅ Updated code
❌ NOT your database
❌ NOT your recipes
❌ NOT your API key
```

### When Someone Clones:

```bash
# Someone runs:
git clone https://github.com/yourusername/meal-planning
cd meal-planning
python3 setup.py

# They get:
✅ All your code
✅ A NEW database with 44 starter meals
✅ Your database SCHEMA (structure)
❌ NOT your personal meals (beyond the 44 samples)
❌ NOT your API key
```

---

## 🎯 Key Takeaways

1. **Database is Local**
   - Stored on your computer: `/Users/adrianstiermbp2023/meal-planning/meal_planner.db`
   - Currently 84 KB with 49 meals
   - Never uploaded to GitHub (protected by .gitignore)

2. **GitHub Gets Code, Not Data**
   - Code files → GitHub ✅
   - Database structure (schema) → GitHub ✅
   - Sample meals (44) → GitHub ✅
   - YOUR personal database → Stays local ❌
   - YOUR API key → Stays local ❌

3. **Data Persists Locally**
   - All meals saved to database file
   - Survives app restarts
   - Survives computer restarts
   - Independent of GitHub

4. **Sharing Options**
   - Share code: Push to GitHub
   - Share data: Manual database export/import
   - Collaborate: Deploy to cloud (Heroku/Railway)
   - Family use: Same computer = same database

5. **Security**
   - .gitignore protects secrets
   - API key never exposed
   - Personal data stays private
   - Safe to share code publicly

---

## 🚀 Quick Reference

```bash
# See what will be committed to GitHub
git status

# Check what's ignored
cat .gitignore

# Backup database
cp meal_planner.db meal_planner_backup.db

# See database size
ls -lh meal_planner.db

# Check database contents
python3 cli.py --stats

# Verify secrets are protected
git check-ignore .env key.txt meal_planner.db
# Should return all three filenames
```

---

**Summary**: Your database is a local SQLite file that stores all your meals and never goes to GitHub. GitHub only gets the code and the "recipe" for building a database. Your API key is also protected. This setup allows you to share your code publicly while keeping your personal data and secrets private! 🔒✨
