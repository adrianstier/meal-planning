# Urgent Fix Required - Generate Week & Shopping List Buttons

## Issue Report
**Date:** November 2, 2025
**Severity:** HIGH
**Affected Features:**
- Generate Week button (PlanPage)
- Shopping List button (PlanPage)

## Symptoms
User reports both buttons are not working.

## Potential Causes

### 1. Frontend JavaScript Error
**Check:** Browser console for errors
```javascript
// Open browser console (F12)
// Look for errors when clicking buttons
```

### 2. API Endpoint Error
**Check:** Network tab for failed requests
- Status code 500 = Server error
- Status code 404 = Endpoint not found
- Status code 400 = Bad request

### 3. Missing Dependencies (Most Likely)
**Issue:** `beautifulsoup4` not installed on production

**Solution:**
```bash
# Check if deployed
curl https://your-app.onrender.com/api/meals

# If 500 error, check logs for:
# ModuleNotFoundError: No module named 'bs4'
```

### 4. Import Error in app.py
**Check:** Does app.py import properly?
```python
# Test locally
python3 -c "import app"
```

## Quick Fixes

### Fix 1: Frontend Build
```bash
cd client
npm run build
git add -A
git commit -m "Rebuild frontend"
git push
```

### Fix 2: Check Requirements
```bash
# Verify beautifulsoup4 is in requirements.txt
cat requirements.txt | grep beautifulsoup

# If missing:
echo "beautifulsoup4>=4.12.0" >> requirements.txt
git add requirements.txt
git commit -m "Add beautifulsoup4"
git push
```

### Fix 3: Rollback Recent Changes
```bash
# If image extraction caused issues
git revert HEAD~2  # Revert last 2 commits
git push
```

## Debugging Steps

### Step 1: Check Browser Console
1. Open the app in browser
2. Press F12 to open DevTools
3. Go to Console tab
4. Click "Generate Week" button
5. Look for error messages

### Step 2: Check Network Requests
1. In DevTools, go to Network tab
2. Click "Generate Week" button
3. Look for failed requests (red)
4. Click on the request
5. Check Response tab for error message

### Step 3: Check Server Logs
If deployed on Render:
1. Go to Render Dashboard
2. Select your service
3. Click "Logs" tab
4. Look for error messages around the time you clicked the button

### Step 4: Test API Directly
```bash
# Test generate-week endpoint
curl -X POST http://localhost:5000/api/plan/generate-week \
  -H "Content-Type: application/json" \
  -d '{
    "start_date": "2025-11-02",
    "num_days": 7,
    "meal_types": ["dinner"]
  }'

# Test shopping list generation
curl -X POST http://localhost:5000/api/shopping/generate \
  -H "Content-Type: application/json" \
  -d '{
    "start_date": "2025-11-02",
    "end_date": "2025-11-08"
  }'
```

## Most Likely Issue: beautifulsoup4 Dependency

The image extraction feature added `beautifulsoup4` as a dependency to `ai_recipe_parser.py`.

This import happens when `app.py` starts:
```python
from ai_recipe_parser import RecipeParser
```

Which imports:
```python
from bs4 import BeautifulSoup  # This will fail if not installed!
```

**This breaks the ENTIRE app**, not just image extraction!

## Immediate Fix

### Option 1: Make beautifulsoup4 Optional (RECOMMENDED)
Edit `ai_recipe_parser.py`:

```python
# At top of file
try:
    from bs4 import BeautifulSoup
    HAS_BS4 = True
except ImportError:
    HAS_BS4 = False
    print("⚠️  BeautifulSoup not available - image extraction disabled")

# In _extract_image_from_url method
def _extract_image_from_url(self, url: str) -> Optional[str]:
    if not HAS_BS4:
        print("⚠️  BeautifulSoup not installed - skipping image extraction")
        return None
    # ... rest of code
```

### Option 2: Ensure Dependency is Installed
```bash
pip install beautifulsoup4
```

Or in production (Render):
1. requirements.txt MUST include `beautifulsoup4>=4.12.0`
2. Trigger redeploy

## Prevention

### For Future Deploys
1. Always test imports before deploying
2. Make new dependencies optional when possible
3. Add try/except for optional features
4. Test in production-like environment first

## Status Check Commands

```bash
# Check if app starts
python3 app.py

# Check if import works
python3 -c "from ai_recipe_parser import RecipeParser; print('✅ Import OK')"

# Check requirements
cat requirements.txt

# Check what's installed
pip list | grep beautifulsoup
```

## Emergency Rollback

If all else fails:
```bash
# Revert to last known good version
git log --oneline -10  # Find last good commit
git revert <commit-hash>  # Revert problematic commit
git push
```

## Resolution

Once fixed, verify:
- [ ] Generate Week button works
- [ ] Shopping List button works
- [ ] No console errors
- [ ] API endpoints respond
- [ ] Recipe creation still works
- [ ] Image extraction still works (if kept)

---

**Priority:** P0 - CRITICAL
**Impact:** Major features broken
**ETA:** Should be fixed within minutes once cause identified
