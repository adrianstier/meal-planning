# 🚂 Railway Deployment Guide

Your code is now on GitHub: https://github.com/adrianstier/meal-planning

## 🎯 Quick Deploy Steps

### Option 1: Railway Web UI (Easiest - Recommended!)

1. **Go to Railway**: https://railway.app
2. **Sign up/Login**: Use your GitHub account
3. **New Project**:
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose `adrianstier/meal-planning`
4. **Add Environment Variable**:
   - In the project dashboard, click "Variables"
   - Add new variable:
     - Name: `ANTHROPIC_API_KEY`
     - Value: `[Your Anthropic API key from .env file]`
5. **Deploy**: Railway automatically deploys!

Railway will:
- Detect your configuration files
- Install Python dependencies
- Run `python setup.py` to create database
- Start app with gunicorn
- Give you a live URL like: `https://meal-planning-production.up.railway.app`

---

### Option 2: Railway CLI

Open your **terminal** (outside Claude Code) and run:

```bash
cd /Users/adrianstiermbp2023/meal-planning

# Login (opens browser)
railway login

# Link to your GitHub repo
railway link

# Set environment variable (use your API key from .env)
railway variables set ANTHROPIC_API_KEY=your-api-key-here

# Deploy
railway up
```

---

## ✅ What Happens on Railway

1. **Build Phase**:
   - Detects Python 3.9 (from nixpacks.toml)
   - Installs requirements.txt dependencies
   - Runs setup.py to create database with 44 meals

2. **Deploy Phase**:
   - Starts gunicorn server
   - Binds to Railway's dynamic port
   - Your app goes live!

3. **Database**:
   - SQLite database created fresh on Railway
   - Starts with 44 sample meals
   - All meals you add will be stored on Railway's server
   - Accessible from anywhere!

---

## 🌐 After Deployment

Once deployed, you'll get a URL like:
```
https://meal-planning-production-xxxx.up.railway.app
```

**Share this URL with your wife!** Both of you can:
- Access from any device
- Add recipes together
- Generate meal plans
- Use AI recipe parser
- Share same cloud database

---

## 💰 Railway Costs

**Free Tier**:
- $5 free credit per month
- Perfect for personal projects
- Your meal planner will use minimal resources

**Estimated Usage**:
- App hosting: ~$3-4/month
- Should stay under free tier!

---

## 🔄 Future Updates

When you make changes to the code:

```bash
# Make your changes locally
git add .
git commit -m "Your update message"
git push

# Railway auto-redeploys from GitHub!
```

---

## 🎉 Ready to Deploy!

**Your code is on GitHub**: ✅
**Railway configuration ready**: ✅
**API key ready to add**: ✅
**Database setup automated**: ✅

**Next Step**: Go to https://railway.app and deploy!
