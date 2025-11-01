# How to Get Your Anthropic API Key

The AI recipe parser feature requires an Anthropic API key to use Claude to automatically parse recipes.

## Step 1: Create an Anthropic Account

1. Go to: **https://console.anthropic.com/**
2. Click "Sign Up" (or "Log In" if you already have an account)
3. Create your account with your email

## Step 2: Get Your API Key

1. Once logged in, go to: **https://console.anthropic.com/settings/keys**
2. Click "Create Key" or "+ Create API Key"
3. Give it a name (e.g., "Meal Planner")
4. Copy the key immediately (it won't be shown again!)

The key will look something like:
```
sk-ant-api03-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

## Step 3: Add the Key to Your App

### Option A: Using .env File (Recommended)

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Open `.env` in a text editor:
   ```bash
   nano .env
   # or
   open .env
   ```

3. Replace `your_api_key_here` with your actual key:
   ```
   ANTHROPIC_API_KEY=sk-ant-api03-your-actual-key-here
   FLASK_ENV=development
   FLASK_DEBUG=1
   ```

4. Save the file

### Option B: Set Environment Variable Directly

**macOS/Linux:**
```bash
export ANTHROPIC_API_KEY="sk-ant-api03-your-actual-key-here"
```

**Windows (PowerShell):**
```powershell
$env:ANTHROPIC_API_KEY="sk-ant-api03-your-actual-key-here"
```

**Windows (Command Prompt):**
```cmd
set ANTHROPIC_API_KEY=sk-ant-api03-your-actual-key-here
```

## Step 4: Verify It Works

Run the app and check if AI parsing is enabled:

```bash
python3 app.py
```

You should see:
```
🤖 AI Recipe Parser: Enabled
```

Instead of:
```
⚠️  No ANTHROPIC_API_KEY found. Recipe parsing will be disabled.
```

## Step 5: Test the AI Parser

1. Start the app: `python3 app.py`
2. Open http://localhost:5000
3. Go to "Add Recipe" tab
4. Paste this sample recipe:

```
Chicken Tacos

Ingredients:
- 1 lb chicken breast
- 8 taco shells
- 1 cup shredded cheese
- Lettuce, tomatoes

Instructions:
1. Cook chicken with taco seasoning
2. Assemble tacos

Prep: 10 min
Cook: 15 min
```

5. Click "Parse with AI"
6. The AI should automatically extract:
   - Meal name: Chicken Tacos
   - Meal type: dinner
   - Kid-friendly level: ~8-9/10
   - Prep/cook times
   - Ingredients categorized by type

## Pricing

Anthropic offers:
- **Free tier**: $5 in free credits to start
- **Pay as you go**: Very affordable for personal use
  - Claude Sonnet: ~$3 per million input tokens
  - For recipe parsing, expect ~$0.01-0.02 per recipe

For a family meal planner, you'd probably spend less than $1/month even with heavy use!

## Security Notes

⚠️ **IMPORTANT**:
- Never commit your `.env` file to git (it's already in `.gitignore`)
- Never share your API key publicly
- If you accidentally expose it, delete it and create a new one
- The key gives access to your Anthropic account and credits

## Troubleshooting

### "No ANTHROPIC_API_KEY found"

**Check:**
1. Is the `.env` file in the same directory as `app.py`?
2. Is the key actually in the file? Run: `cat .env`
3. Did you restart the app after adding the key?
4. Is there a typo in `ANTHROPIC_API_KEY`? (must be exact)

**Fix:**
```bash
# Check if .env exists
ls -la .env

# Check contents
cat .env

# Should show:
# ANTHROPIC_API_KEY=sk-ant-api03-...

# Restart the app
python3 app.py
```

### "AI parsing failed"

**Possible causes:**
1. Invalid API key
2. Out of credits
3. Network issue

**Fix:**
- Check your Anthropic console for account status
- Verify the key is correct
- Check internet connection

### "Rate limit exceeded"

If you're parsing many recipes quickly:
- Wait a few seconds between requests
- Anthropic has rate limits to prevent abuse
- For normal use, you won't hit these

## Alternative: Use Manual Entry

Don't have an API key yet? No problem!

You can still use ALL features except AI parsing:
- ✅ Meal randomizer
- ✅ Shopping lists
- ✅ Browse/search meals
- ✅ Manual recipe entry

Just use the "Edit Manually" button in the Add Recipe tab.

## Getting Help

- Anthropic docs: https://docs.anthropic.com/
- API pricing: https://www.anthropic.com/pricing
- Support: https://support.anthropic.com/

---

**Ready to start?**
1. Get your key: https://console.anthropic.com/settings/keys
2. Add to `.env`
3. Run `python3 app.py`
4. Start planning meals! 🍽️
