# Deployment Guide - Railway & Render

**Last Updated**: 2025-01-12
**Status**: Ready for deployment with premium features

---

## Overview

This app can be deployed to either **Railway** (recommended) or **Render**. Both platforms support the full feature set including:
- ✅ React 19 frontend
- ✅ Flask backend with AI recipe parsing
- ✅ SQLite database with persistent storage
- ✅ Stripe payment integration
- ✅ Nutrition tracking
- ✅ Analytics dashboard
- ✅ Multi-user authentication

---

## Required Environment Variables

### Core Variables (Required)

| Variable | Description | Where to Get It | Required For |
|----------|-------------|-----------------|--------------|
| `ANTHROPIC_API_KEY` | Claude API key for AI recipe parsing | [console.anthropic.com](https://console.anthropic.com) | Recipe parsing |
| `STRIPE_SECRET_KEY` | Stripe API secret key | [dashboard.stripe.com/apikeys](https://dashboard.stripe.com/apikeys) | Payment processing |
| `SECRET_KEY` | Flask session secret (32+ char random string) | Generate: `python3 -c "import secrets; print(secrets.token_hex(32))"` | Session security |

### Optional Variables

| Variable | Description | Default | Notes |
|----------|-------------|---------|-------|
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret | None | Required for production webhooks |
| `PORT` | Server port | 5000 | Auto-set by hosting platform |
| `RAILWAY_VOLUME_MOUNT_PATH` | Railway persistent storage path | None | Auto-set by Railway |
| `FLASK_DEBUG` | Enable debug mode | 0 | Set to 0 in production |

---

## Railway Deployment (Recommended)

Railway provides the best experience with persistent storage and easy setup.

### Step 1: Initial Setup

1. **Create Railway account** at [railway.app](https://railway.app)
2. **Install Railway CLI** (optional):
   ```bash
   npm install -g @railway/cli
   railway login
   ```

### Step 2: Connect Repository

1. Go to Railway dashboard
2. Click **"New Project"**
3. Select **"Deploy from GitHub repo"**
4. Choose your meal-planning repository
5. Railway will auto-detect the configuration from `railway.toml`

### Step 3: Add Persistent Volume

**IMPORTANT**: Database persistence requires a volume!

1. In Railway project, click **"Settings"**
2. Go to **"Volumes"** tab
3. Click **"Add Volume"**
4. **Mount path**: `/app/data`
5. **Size**: 1GB (sufficient for thousands of users)
6. Click **"Add"**

The app will automatically use this path for the database via:
```python
volume_path = os.getenv('RAILWAY_VOLUME_MOUNT_PATH', '/app/data')
```

### Step 4: Set Environment Variables

In Railway project settings → **Variables** tab, add:

```bash
# Required
ANTHROPIC_API_KEY=sk-ant-xxxxx...
STRIPE_SECRET_KEY=sk_test_xxxxx... (or sk_live_xxxxx for production)
SECRET_KEY=<generate with: python3 -c "import secrets; print(secrets.token_hex(32))">

# Optional
STRIPE_WEBHOOK_SECRET=whsec_xxxxx... (add after webhook setup)
```

### Step 5: Configure Stripe Webhooks

1. **Get Railway app URL**: `https://your-app.railway.app`
2. **Go to Stripe Dashboard** → [Webhooks](https://dashboard.stripe.com/webhooks)
3. **Add endpoint**: `https://your-app.railway.app/api/stripe/webhook`
4. **Select events to listen to**:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
5. **Copy webhook signing secret** and add to Railway as `STRIPE_WEBHOOK_SECRET`

### Step 6: Deploy!

Railway will automatically deploy. Monitor the build logs:

```
🏗️  Building React app...
📦 Copying build files...
🔄 Running database migrations...
   ✅ Multi-user migration skipped (already applied)
   ✅ Subscriptions migration skipped (already applied)
   ✅ Nutrition tracking migration skipped (already applied)
✅ Build complete!
🚀 Starting gunicorn...
```

### Step 7: Verify Deployment

1. **Visit your app**: `https://your-app.railway.app`
2. **Test registration**: Create a new account
3. **Test pricing page**: `/pricing` should show 3 tiers
4. **Check logs**: Ensure no errors

---

## Render Deployment

Render is a good free alternative but lacks persistent storage (database resets on redeploy).

### Step 1: Initial Setup

1. **Create Render account** at [render.com](https://render.com)
2. **Create new Web Service**
3. **Connect GitHub repository**

### Step 2: Configure Service

Use these settings:

**Build & Deploy**:
- **Name**: meal-planning
- **Region**: Oregon (US West)
- **Branch**: main
- **Root Directory**: (leave blank)
- **Build Command**: `pip install -r requirements.txt && chmod +x railway-build.sh && ./railway-build.sh`
- **Start Command**: `python setup.py && gunicorn app:app --timeout 180 --workers 1 --log-level info`

**Environment**:
- **Python Version**: 3.11.0
- **Instance Type**: Free

### Step 3: Add Environment Variables

In Render dashboard, go to **Environment** tab and add:

```bash
# Required
ANTHROPIC_API_KEY=sk-ant-xxxxx...
STRIPE_SECRET_KEY=sk_test_xxxxx...
SECRET_KEY=<32+ character random string>
RENDER=true

# Optional
STRIPE_WEBHOOK_SECRET=whsec_xxxxx...
```

### Step 4: Add Persistent Storage (Paid Plan Only)

**Note**: Render Free tier does NOT support persistent disks. Database will reset on every deploy.

For paid plans:
1. Go to **"Disks"** tab
2. Click **"Add Disk"**
3. **Name**: database
4. **Mount Path**: `/app/data`
5. **Size**: 1GB

### Step 5: Deploy

Click **"Manual Deploy"** → **"Deploy latest commit"**

### Step 6: Configure Stripe Webhooks

Same as Railway steps, but use Render URL: `https://your-app.onrender.com/api/stripe/webhook`

---

## Migration Guide

### New Premium Features Migration (v2.0)

The following migrations are now included in the build script:

1. **Subscriptions** (`add_subscriptions.py`)
   - Creates `subscriptions` table
   - Creates `payment_history` table
   - Creates `plan_features` table
   - Creates `feature_usage` table

2. **Nutrition Tracking** (`add_nutrition_tracking.py`)
   - Adds nutrition columns to `meals` table
   - Creates `nutrition_logs` table
   - Creates `nutrition_goals` table
   - Creates `nutrition_summaries` table

These run automatically during build. Look for these log messages:

```
🔄 Running additional migrations...
   ⚠️  Subscriptions migration skipped (already applied)
   ⚠️  Nutrition tracking migration skipped (already applied)
```

"Skipped" is normal if migrations already ran successfully.

### Manual Migration (if needed)

If migrations fail during build, you can run them manually:

```bash
# SSH into Railway or Render shell
railway shell  # or Render SSH

# Run migrations manually
DB_PATH=$(python3 get_db_path.py)
python3 database/migrations/add_subscriptions.py "$DB_PATH"
python3 database/migrations/add_nutrition_tracking.py "$DB_PATH"
```

---

## Troubleshooting

### Build Failures

**Issue**: React build fails with memory error
```
FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory
```

**Solution**: Increase Node memory in build command:
```bash
NODE_OPTIONS=--max-old-space-size=4096 npm run build
```

---

**Issue**: Migration fails with "table already exists"
```
sqlite3.OperationalError: table subscriptions already exists
```

**Solution**: This is normal! Migrations are idempotent. The warning can be ignored.

---

**Issue**: Stripe key not found
```
ValueError: STRIPE_SECRET_KEY environment variable not set
```

**Solution**: Add `STRIPE_SECRET_KEY` to environment variables. Use test key for staging: `sk_test_...`

---

### Runtime Errors

**Issue**: 500 error on premium endpoints
```
GET /api/stripe/subscription → 500 Internal Server Error
```

**Solution**: Check logs for specific error:
```bash
railway logs  # or Render logs
```

Common causes:
1. Missing migration (run subscriptions migration)
2. Database locked (restart app)
3. Missing Stripe key (add environment variable)

---

**Issue**: Database resets on every deploy (Render)
```
Users and meals disappear after redeploy
```

**Solution**: Render Free tier has NO persistent storage. Options:
1. Upgrade to Render paid plan and add disk
2. Switch to Railway (has free persistent storage)
3. Use external PostgreSQL database

---

**Issue**: Webhook signature verification failed
```
Error: No signatures found matching the expected signature for payload
```

**Solution**: Add `STRIPE_WEBHOOK_SECRET` environment variable from Stripe dashboard

---

### Performance Issues

**Issue**: AI recipe parsing times out
```
504 Gateway Timeout
```

**Solution**: Increase gunicorn timeout (already set to 180s):
```bash
gunicorn app:app --timeout 180
```

---

**Issue**: App is slow with 100+ users

**Solution**: Upgrade plan and add workers:
```bash
gunicorn app:app --workers 4 --timeout 180
```

---

## Deployment Checklist

Use this checklist before deploying:

### Pre-Deployment ✅

- [ ] All tests passing (`python3 test_premium_live.py`)
- [ ] Environment variables documented
- [ ] Stripe test keys ready
- [ ] Database migrations tested locally
- [ ] React build succeeds
- [ ] Requirements.txt up to date
- [ ] SECRET_KEY generated (32+ chars)

### Railway Deployment ✅

- [ ] Repository connected to Railway
- [ ] Persistent volume added (1GB minimum)
- [ ] Environment variables set:
  - [ ] ANTHROPIC_API_KEY
  - [ ] STRIPE_SECRET_KEY
  - [ ] SECRET_KEY
- [ ] Build script runs successfully
- [ ] App accessible at Railway URL
- [ ] Database persists between deploys

### Render Deployment ✅

- [ ] Repository connected to Render
- [ ] Build command updated (includes React build)
- [ ] Start command includes gunicorn timeout
- [ ] Environment variables set (same as Railway)
- [ ] Render-specific env var added: `RENDER=true`
- [ ] Persistent disk added (paid plan only)

### Stripe Configuration ✅

- [ ] Stripe account created
- [ ] Test API keys obtained
- [ ] Webhook endpoint added
- [ ] Webhook events selected (6 events)
- [ ] Webhook secret added to env vars
- [ ] Test payment completed successfully

### Post-Deployment Verification ✅

- [ ] App loads at production URL
- [ ] User registration works
- [ ] Login works
- [ ] Recipe creation works
- [ ] AI parsing works (with valid API key)
- [ ] Pricing page displays correctly
- [ ] Checkout flow redirects to Stripe
- [ ] Free tier restrictions work
- [ ] Premium features require subscription

---

## Security Checklist

Before going to production:

### API Keys ✅

- [ ] Use production Stripe keys (not test keys)
- [ ] Use real Anthropic API key
- [ ] Generate strong SECRET_KEY (32+ random chars)
- [ ] Never commit keys to Git
- [ ] Use environment variables for all secrets

### Access Control ✅

- [ ] Premium features require authentication
- [ ] Free tier properly restricted
- [ ] Subscription checks use "fail closed" model
- [ ] SQL injection prevented (parameterized queries)
- [ ] Input validation on all endpoints
- [ ] HTTPS enforced in production

### Database ✅

- [ ] Persistent storage configured
- [ ] Regular backups enabled
- [ ] Database not exposed publicly
- [ ] Passwords hashed (SHA-256)
- [ ] Session cookies secure in production

---

## Cost Estimates

### Railway (Recommended)

**Free Tier**:
- ✅ $5/month credit
- ✅ Persistent storage included
- ✅ ~500 hours runtime/month
- ✅ Sufficient for MVP testing

**Paid Plan** (when you scale):
- Base: $5/month
- + Compute usage (~$0.000463/GB-sec)
- + Bandwidth (~$0.10/GB)
- **Estimated**: $10-20/month for 100 users

### Render

**Free Tier**:
- ❌ No persistent storage
- ❌ Sleeps after 15 min inactivity
- ❌ Not suitable for production

**Paid Plan**:
- Starter: $7/month
- + Persistent disk: $1/GB/month
- **Estimated**: $8-15/month for 100 users

### Stripe

**Processing Fees**:
- 2.9% + $0.30 per transaction
- $9.99 subscription = $0.59 fee
- $19.99 subscription = $0.88 fee

**Example Revenue** (100 users, 20% conversion):
- 20 users × $9.99 = $199.80/month
- Stripe fees: $11.80
- **Net**: $188/month

---

## Monitoring & Maintenance

### Health Checks

**Railway/Render automatically monitor**:
- HTTP response time
- Error rate
- Memory usage
- CPU usage

**Manual checks** (weekly):
```bash
# Check app health
curl https://your-app.railway.app/api/health

# Check database size
railway shell
ls -lh /app/data/meal_planner.db

# View recent errors
railway logs --tail 100
```

### Database Backups

**Railway** (recommended):
```bash
# Download database backup
railway shell
sqlite3 /app/data/meal_planner.db .dump > backup.sql

# Or use Railway's snapshot feature (paid plans)
```

**Render**:
- Set up daily backups using Render's disk snapshots (paid plans)

### Upgrade Path

When you outgrow SQLite (10,000+ users):

1. **Set up PostgreSQL**:
   - Railway: Add PostgreSQL service (free 512MB)
   - Render: Add PostgreSQL add-on ($7/month)

2. **Migrate data**:
   ```bash
   # Export from SQLite
   sqlite3 meal_planner.db .dump > backup.sql

   # Import to PostgreSQL
   # (conversion script needed - not yet created)
   ```

3. **Update code**:
   - Change database connection from SQLite to PostgreSQL
   - Update DATABASE_URL environment variable

---

## Support

### Railway

- **Docs**: [docs.railway.app](https://docs.railway.app)
- **Discord**: [discord.gg/railway](https://discord.gg/railway)
- **Status**: [status.railway.app](https://status.railway.app)

### Render

- **Docs**: [render.com/docs](https://render.com/docs)
- **Support**: support@render.com
- **Status**: [status.render.com](https://status.render.com)

### This App

- **Issues**: File in GitHub repo
- **Tests**: Run `python3 test_premium_live.py`
- **Docs**: See README.md and other docs in repo

---

## Quick Command Reference

### Railway

```bash
# Install CLI
npm install -g @railway/cli

# Login
railway login

# Link to project
railway link

# View logs
railway logs

# SSH into container
railway shell

# Run migrations
railway run python3 database/migrations/add_subscriptions.py

# Set environment variable
railway variables set STRIPE_SECRET_KEY=sk_test_...

# Deploy
git push origin main  # Auto-deploys
```

### Render

```bash
# View logs
# (Use Render dashboard - no CLI for logs)

# SSH into container
# (Use Render dashboard - SSH tab)

# Deploy
git push origin main  # Auto-deploys

# Environment variables
# (Set in Render dashboard - Environment tab)
```

### Local Development

```bash
# Run app locally
python3 app.py

# Run tests
python3 test_premium_live.py

# Run migrations
python3 database/migrations/add_subscriptions.py meal_planner.db

# Build React
cd client && npm run build

# Start with production settings
FLASK_DEBUG=0 gunicorn app:app --timeout 180
```

---

**Last Updated**: 2025-01-12
**Version**: 2.0 (with premium features)
**Status**: Production-ready ✅
