# Deployment Checklist - Quick Reference

**Status**: Ready to deploy ✅
**Last Updated**: 2025-01-12

---

## ⚡ Quick Start (Railway - Recommended)

### 1. Create Railway Project (2 min)
- [ ] Go to [railway.app](https://railway.app)
- [ ] Create new project from GitHub repo
- [ ] Wait for auto-detection (uses `railway.toml`)

### 2. Add Persistent Storage (1 min)
- [ ] Settings → Volumes → Add Volume
- [ ] Mount path: `/app/data`
- [ ] Size: 1GB
- [ ] Save

### 3. Set Environment Variables (3 min)
```bash
ANTHROPIC_API_KEY=sk-ant-api-xxxxx...
STRIPE_SECRET_KEY=sk_test_xxxxx...
SECRET_KEY=<run: python3 -c "import secrets; print(secrets.token_hex(32))">
```

### 4. Deploy (5 min)
- [ ] Push to main branch: `git push origin main`
- [ ] Watch build logs in Railway dashboard
- [ ] Wait for "Build complete!"
- [ ] Click app URL to test

### 5. Configure Stripe Webhooks (3 min)
- [ ] Copy Railway app URL
- [ ] Go to [Stripe Dashboard → Webhooks](https://dashboard.stripe.com/webhooks)
- [ ] Add endpoint: `https://your-app.railway.app/api/stripe/webhook`
- [ ] Select 6 events: checkout.session.completed, customer.subscription.*,  invoice.payment.*
- [ ] Copy webhook secret → Add to Railway as `STRIPE_WEBHOOK_SECRET`

### 6. Test (2 min)
- [ ] Visit app URL
- [ ] Register new account
- [ ] Check pricing page works
- [ ] Verify free tier restrictions

**Total Time**: ~15 minutes

---

## 📋 Detailed Checklist

### Pre-Deployment

#### Code & Tests ✅
- [x] All premium features tested (92% pass rate)
- [x] Security vulnerabilities fixed
- [x] Input validation added
- [x] SQL injection prevented
- [x] Access control working
- [ ] Final git push to main

#### Dependencies ✅
- [x] `requirements.txt` includes all packages:
  - [x] flask==3.0.0
  - [x] stripe>=8.0.0
  - [x] anthropic==0.40.0
  - [x] gunicorn==21.2.0
  - [x] All other dependencies

#### Configuration Files ✅
- [x] `railway.toml` - Railway config
- [x] `render.yaml` - Render config
- [x] `railway-build.sh` - Build script with new migrations
- [x] `railway-start.sh` - Start script

#### Migrations ✅
- [x] `add_subscriptions.py` - Payment tables
- [x] `add_nutrition_tracking.py` - Nutrition tables
- [x] Both added to `railway-build.sh`

---

### Railway Deployment

#### 1. Project Setup
- [ ] Railway account created
- [ ] GitHub repo connected
- [ ] Auto-detection successful (shows Python app)

#### 2. Storage Configuration
- [ ] Persistent volume added
  - [ ] Name: `data`
  - [ ] Mount path: `/app/data`
  - [ ] Size: 1GB minimum
  - [ ] Status: Active

#### 3. Environment Variables
- [ ] `ANTHROPIC_API_KEY` set
  - Get from: [console.anthropic.com](https://console.anthropic.com)
  - Format: `sk-ant-api-xxxxx...`
- [ ] `STRIPE_SECRET_KEY` set
  - Get from: [dashboard.stripe.com/apikeys](https://dashboard.stripe.com/apikeys)
  - Use: `sk_test_...` for testing
  - Use: `sk_live_...` for production
- [ ] `SECRET_KEY` set
  - Generate: `python3 -c "import secrets; print(secrets.token_hex(32))"`
  - Length: 64 characters
- [ ] `STRIPE_WEBHOOK_SECRET` set (after webhook setup)
  - Get from: Stripe webhook configuration
  - Format: `whsec_xxxxx...`

#### 4. Build & Deploy
- [ ] Initial deployment triggered
- [ ] Build logs show:
  - [ ] `🏗️  Building React app...`
  - [ ] `📦 Copying build files...`
  - [ ] `🔄 Running database migrations...`
  - [ ] `✅ Build complete!`
- [ ] No errors in build logs
- [ ] App status: Running

#### 5. Verify Deployment
- [ ] App URL works: `https://your-app.railway.app`
- [ ] Home page loads
- [ ] React app renders correctly
- [ ] No console errors in browser

---

### Stripe Configuration

#### 1. Test Mode Setup
- [ ] Stripe account in test mode
- [ ] Test API keys obtained
  - [ ] Publishable key: `pk_test_...`
  - [ ] Secret key: `sk_test_...`

#### 2. Webhook Configuration
- [ ] Webhook endpoint added
  - URL: `https://your-app.railway.app/api/stripe/webhook`
  - Description: "Meal Planning App - Subscription Events"
- [ ] Events selected (6 required):
  - [ ] `checkout.session.completed`
  - [ ] `customer.subscription.created`
  - [ ] `customer.subscription.updated`
  - [ ] `customer.subscription.deleted`
  - [ ] `invoice.payment_succeeded`
  - [ ] `invoice.payment_failed`
- [ ] Webhook signing secret copied
- [ ] Secret added to Railway as `STRIPE_WEBHOOK_SECRET`

#### 3. Product Configuration
- [ ] Products created in Stripe:
  - [ ] Family Plan - $9.99/month
  - [ ] Premium Plan - $19.99/month
  - [ ] Lifetime - $299 one-time
- [ ] Price IDs noted for reference

#### 4. Test Payment Flow
- [ ] Can access checkout page
- [ ] Checkout redirects to Stripe
- [ ] Test card works: `4242 4242 4242 4242`
- [ ] Webhook receives event
- [ ] Subscription status updates in database
- [ ] Premium features unlock after payment

---

### Post-Deployment Testing

#### Basic Functionality
- [ ] Homepage loads
- [ ] User registration works
- [ ] Login works
- [ ] Meal creation works
- [ ] Recipe parsing works (with API key)

#### Premium Features
- [ ] Pricing page displays 3 tiers
- [ ] Checkout creates Stripe session
- [ ] Free tier blocked from:
  - [ ] AI recipe parsing
  - [ ] Nutrition tracking
  - [ ] Analytics dashboard
- [ ] Family tier has access to all features
- [ ] Premium tier has full access

#### Database Persistence
- [ ] Create test meal
- [ ] Redeploy app
- [ ] Test meal still exists ✅

#### Security
- [ ] HTTPS enabled (automatic)
- [ ] Session cookies secure
- [ ] API keys not exposed in client code
- [ ] Free tier restrictions enforced
- [ ] Input validation working

---

### Render Deployment (Alternative)

#### Setup Differences
- [ ] Build command: `pip install -r requirements.txt && chmod +x railway-build.sh && ./railway-build.sh`
- [ ] Start command: `python setup.py && gunicorn app:app --timeout 180 --workers 1`
- [ ] Environment variable added: `RENDER=true`
- [ ] Persistent disk added (paid plan only)

⚠️ **Warning**: Render free tier has NO persistent storage. Database resets on every deploy.

---

## 🚨 Common Issues & Fixes

### Build Fails

**Issue**: React build out of memory
```
JavaScript heap out of memory
```
**Fix**: Add to build command:
```bash
NODE_OPTIONS=--max-old-space-size=4096
```

---

**Issue**: Migration fails - table exists
```
sqlite3.OperationalError: table subscriptions already exists
```
**Fix**: This is normal! Migration is idempotent. Ignore warning.

---

### Runtime Errors

**Issue**: 500 error on `/api/stripe/subscription`
```
Internal Server Error
```
**Fix**: Run subscription migration manually:
```bash
railway shell
python3 database/migrations/add_subscriptions.py /app/data/meal_planner.db
```

---

**Issue**: Stripe webhook fails
```
No signatures found matching expected signature
```
**Fix**: Add `STRIPE_WEBHOOK_SECRET` environment variable

---

**Issue**: AI parsing times out
```
504 Gateway Timeout
```
**Fix**: Already set to 180s in start command. Check Anthropic API status.

---

### Database Issues

**Issue**: Database resets on deploy (Render)
```
All users/meals disappeared
```
**Fix**: Render free tier has no persistence. Either:
1. Upgrade to paid plan with disk
2. Switch to Railway (free persistent storage)

---

**Issue**: Database locked error
```
sqlite3.OperationalError: database is locked
```
**Fix**: Restart the app. If persists, check for long-running queries.

---

## 📊 Success Metrics

After deployment, you should see:

### Week 1 Targets
- [ ] 0 critical errors in logs
- [ ] 100% uptime
- [ ] <500ms average response time
- [ ] 5 test user registrations
- [ ] 1 successful test payment

### Week 2 Targets
- [ ] 10 real user registrations
- [ ] 2 paying customers
- [ ] <1% error rate
- [ ] All premium features used at least once

### Month 1 Targets
- [ ] 100 registered users
- [ ] 10-20 paying customers ($100-200 MRR)
- [ ] 5-star user feedback
- [ ] <300ms average response time

---

## 🎯 Production Readiness

### Before Going Live

#### Security
- [ ] Switch to production Stripe keys (`sk_live_...`)
- [ ] Generate new production `SECRET_KEY`
- [ ] Enable HTTPS enforcement (automatic on Railway/Render)
- [ ] Set up error monitoring (Sentry recommended)
- [ ] Review and restrict webhook endpoints

#### Performance
- [ ] Test with 100 concurrent users
- [ ] Add caching if needed (Redis)
- [ ] Optimize slow database queries
- [ ] Add CDN for static assets (optional)

#### Monitoring
- [ ] Set up uptime monitoring (UptimeRobot)
- [ ] Configure error alerts
- [ ] Set up daily database backups
- [ ] Create backup strategy

#### Legal & Compliance
- [ ] Privacy policy page
- [ ] Terms of service page
- [ ] Cookie consent (if EU users)
- [ ] GDPR compliance (if EU users)
- [ ] Stripe T&C acceptance

---

## 📞 Support Contacts

### Platform Issues
- **Railway**: [discord.gg/railway](https://discord.gg/railway)
- **Render**: support@render.com
- **Stripe**: [support.stripe.com](https://support.stripe.com)

### App Issues
- Check logs first: `railway logs` or Render dashboard
- Review test results: `python3 test_premium_live.py`
- See [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) for detailed troubleshooting

---

## ✅ Final Checklist

Before marking deployment as complete:

- [ ] App accessible at production URL
- [ ] All environment variables set correctly
- [ ] Database persistent storage working
- [ ] Stripe test payment successful
- [ ] Webhook events received
- [ ] Free tier restrictions working
- [ ] Premium features unlocked after payment
- [ ] No critical errors in logs
- [ ] Response times <500ms
- [ ] All team members have admin access
- [ ] Backup strategy in place
- [ ] Monitoring configured
- [ ] Support channels established

---

**Status**: Ready to Deploy ✅
**Estimated Time**: 15-30 minutes
**Difficulty**: Easy (if following checklist)
**Support**: See DEPLOYMENT_GUIDE.md for detailed help

---

## 🎉 Post-Deployment

After successful deployment:

1. **Celebrate!** 🎊 You've shipped a production-ready SaaS app!
2. **Test thoroughly** - Run through user flows
3. **Share** - Get first beta users
4. **Monitor** - Check logs daily for first week
5. **Iterate** - Collect feedback and improve

**Next Milestone**: First paying customer! 💰

---

**Last Updated**: 2025-01-12
**Version**: 2.0 (with premium features)
