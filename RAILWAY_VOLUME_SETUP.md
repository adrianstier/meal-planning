# Railway Persistent Volume Setup

## Problem
SQLite database data is being lost on every deployment because Railway uses ephemeral storage.

## Solution: Add a Persistent Volume

1. **Go to Railway Dashboard**
   - Open your project: https://railway.app/
   - Select your web service

2. **Add a Volume**
   - Click "Variables" tab
   - Scroll down to "Volumes" section
   - Click "+ New Volume"
   - Mount path: `/app/data`
   - Volume name: `meal-planner-data` (or any name)

3. **Update the code to use the volume**
   - The database path needs to check if we're on Railway
   - If volume exists, use `/app/data/meal_planner.db`
   - Otherwise use local `meal_planner.db`

## Next Steps
After adding the volume in Railway dashboard, I'll update the code to use it.
