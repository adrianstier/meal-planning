# How to Fix Database Data Loss on Railway

## The Problem

Your recipes are disappearing after every deployment because Railway uses **ephemeral storage**:
- Railway containers reset on every deploy
- The `meal_planner.db` file is NOT in git (it's in `.gitignore`)
- Every deployment starts with a fresh, empty database

## The Solution

Use Railway's **Persistent Volumes** to store the database permanently.

## Step-by-Step Instructions

### 1. Add a Volume in Railway Dashboard

1. Go to https://railway.app/
2. Select your project
3. Click on your web service
4. Click the "Variables" tab
5. Scroll down to find the "Volumes" section
6. Click "+ New Volume" button
7. Enter the mount path: `/app/data`
8. Give it a name (e.g., `meal-planner-data`)
9. Click "Add Volume"

### 2. Deploy the Code I Just Committed

The code is already ready - I've updated it to automatically detect and use the Railway volume:

```bash
git push
```

### 3. Wait for Deployment

Railway will rebuild and redeploy with the new volume mounted.

### 4. Verify It's Working

After deployment, check the Railway logs. You should see:
```
📁 Using persistent volume database: /app/data/meal_planner.db
```

Instead of:
```
📁 Using local database: meal_planner.db
```

## What This Does

- **With volume**: Database is stored in `/app/data/meal_planner.db` (persists across deployments)
- **Without volume**: Database is stored in `meal_planner.db` (ephemeral, resets on deploy)
- The code automatically detects which to use

## After Setup

Once the volume is added:
✅ Your recipes will persist across deployments
✅ Meal plans will be saved permanently  
✅ Bento box items won't disappear
✅ You can deploy updates without losing data

## Current Status

- ✅ Code is ready and committed
- ⏳ Waiting for you to add the volume in Railway dashboard
- ⏳ Then push to deploy

Let me know once you've added the volume and I'll push the code!
