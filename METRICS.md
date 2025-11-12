# Meal Planning App - Success Metrics & KPIs

**Last Updated**: 2025-01-11
**Current Phase**: Phase 1 - Make It Bulletproof

---

## 🎯 ULTIMATE GOAL

**Exit Target**: $3-5M acquisition or $50K+/month passive income lifestyle business

**Key Metric**: $100,000 Monthly Recurring Revenue (MRR)

---

## 📊 CURRENT METRICS (Baseline)

### Business Metrics
- **Total Users**: 0 (not yet launched)
- **Paying Customers**: 0
- **Monthly Recurring Revenue (MRR)**: $0
- **Annual Recurring Revenue (ARR)**: $0
- **Customer Acquisition Cost (CAC)**: TBD
- **Lifetime Value (LTV)**: TBD
- **LTV:CAC Ratio**: TBD (Target: >3:1)
- **Monthly Churn Rate**: TBD (Target: <5%)

### Product Metrics
- **Daily Active Users (DAU)**: 0
- **Monthly Active Users (MAU)**: 0
- **DAU/MAU Ratio**: TBD (Target: >20%)
- **Weekly Meal Plans Created**: 0
- **Recipes Saved**: ~100 (seed data)
- **AI Recipes Parsed**: 0
- **Shopping Lists Generated**: 0

### Technical Metrics
- **API Endpoints**: 91 ✅
- **API Test Coverage**: ~15% ⚠️ (Target: 100%)
- **Frontend Test Coverage**: ~5% ⚠️ (Target: 80%)
- **API Response Time (p95)**: TBD (Target: <200ms)
- **Error Rate**: TBD (Target: <0.1%)
- **Uptime**: TBD (Target: 99.9%)

### Development Metrics
- **Total Lines of Code**: ~25,758
- **Backend (Python)**: ~14,652 lines
- **Frontend (TypeScript)**: ~11,106 lines
- **Open Critical Issues**: 4 (from IMPROVEMENT_ROADMAP.md)
- **Open High Priority Issues**: 4
- **Commits This Month**: Check with `git log --since="1 month ago" --oneline | wc -l`

---

## 🎯 MILESTONE TARGETS

### Month 3 Targets (First Revenue)
- [ ] **Total Signups**: 500
- [ ] **Paying Customers**: 50
- [ ] **MRR**: $500
- [ ] **Conversion Rate (Free → Paid)**: 5%
- [ ] **Monthly Churn**: <10%
- [ ] **NPS Score**: >40

### Month 6 Targets (Product-Market Fit)
- [ ] **Total Signups**: 2,000
- [ ] **Paying Customers**: 300
- [ ] **MRR**: $3,000
- [ ] **Conversion Rate**: 7%
- [ ] **Monthly Churn**: <7%
- [ ] **Monthly Organic Traffic**: 1,000+ visitors
- [ ] **Break-even on costs**: Revenue ≥ Expenses

### Month 12 Targets (Scaling)
- [ ] **Total Signups**: 10,000
- [ ] **Paying Customers**: 2,000
- [ ] **MRR**: $20,000 ($240K ARR)
- [ ] **Conversion Rate**: 10%
- [ ] **Monthly Churn**: <5%
- [ ] **Monthly Organic Traffic**: 10,000+ visitors
- [ ] **Monthly Profit**: $10,000+
- [ ] **LTV:CAC**: >3:1

### Month 18 Targets (Growth)
- [ ] **Total Signups**: 30,000
- [ ] **Paying Customers**: 6,000
- [ ] **MRR**: $60,000 ($720K ARR)
- [ ] **Monthly Churn**: <4%
- [ ] **Monthly Profit**: $40,000+
- [ ] **Team Size**: 3-5 people

### Month 24 Targets (EXIT/RETIREMENT)
- [ ] **Total Signups**: 50,000+
- [ ] **Paying Customers**: 10,000
- [ ] **MRR**: $100,000+ ($1.2M ARR)
- [ ] **Monthly Churn**: <3%
- [ ] **Monthly Profit**: $50,000+
- [ ] **Company Valuation**: $4-6M (4-5x ARR)
- [ ] **Exit Ready**: Financial docs prepared, buyer outreach initiated

---

## 📈 GROWTH METRICS TO TRACK

### Acquisition Metrics
- **Website Visitors**: Unique monthly visitors
- **Signup Conversion Rate**: Visitors → Signups
- **Source Breakdown**: Organic, Paid, Referral, Direct
- **Cost Per Acquisition (CPA)**: Ad spend ÷ Signups
- **Viral Coefficient**: Referrals per user

### Activation Metrics
- **Onboarding Completion Rate**: % who complete setup
- **Time to First Value**: Hours until first meal planned
- **First Week Retention**: % who return day 7
- **Feature Adoption**: % using AI parser, meal planner, shopping lists

### Engagement Metrics
- **Weekly Active Users (WAU)**: Users active each week
- **Average Session Duration**: Time spent per visit
- **Meal Plans Per User**: Average plans created
- **Recipes Saved Per User**: Average recipe collection size
- **Shopping Lists Generated**: Usage of premium feature

### Revenue Metrics
- **Average Revenue Per User (ARPU)**: Total revenue ÷ Users
- **Conversion Rate by Plan**: Free → Family → Premium
- **Upgrade Rate**: Free → Paid conversion %
- **Downgrade Rate**: Paid → Free %
- **Revenue Per Paying Customer**: Monthly average

### Retention Metrics
- **Day 1 Retention**: % return next day
- **Day 7 Retention**: % return after 1 week
- **Day 30 Retention**: % return after 1 month
- **Monthly Churn**: % who cancel each month
- **Cohort Analysis**: Retention by signup month

### Product Metrics
- **Feature Usage**: % using each major feature
- **AI Success Rate**: % of successful AI parses
- **Error Rate**: Errors per 1000 requests
- **Page Load Time**: p95 load time
- **Mobile vs Desktop**: Usage breakdown

---

## 🔍 HOW TO TRACK

### Analytics Tools
- [ ] **PostHog** (Product analytics) - Set up in Week 4
- [ ] **Google Analytics 4** (Website traffic) - Set up with marketing site
- [ ] **Stripe Dashboard** (Revenue metrics) - Automatic with Stripe
- [ ] **Sentry** (Error tracking) - Set up in Week 3

### Weekly Review
Every Monday, review:
1. New signups last week
2. MRR growth
3. Churn events
4. Feature usage trends
5. Top errors from Sentry
6. User feedback themes

### Monthly Review
Every month, review:
1. All milestone progress
2. LTV:CAC ratio trend
3. Cohort retention analysis
4. Revenue vs. expense
5. Runway (months of cash remaining)
6. Feature adoption rates
7. Customer feedback and NPS

### Quarterly Review
Every quarter:
1. Roadmap alignment check
2. Competitive landscape
3. Pricing optimization
4. Team capacity planning
5. Major feature planning

---

## 📊 DASHBOARD SETUP

### Create dashboards for:

**Business Dashboard** (Stripe + PostHog):
- MRR trend (daily)
- New vs. churned customers
- Revenue by plan tier
- Conversion funnel (visitor → signup → paid)

**Product Dashboard** (PostHog):
- DAU/MAU trend
- Feature usage heatmap
- User journey funnel
- Retention cohorts

**Technical Dashboard** (Sentry + Custom):
- Error rate trend
- API response times
- Database query performance
- Uptime percentage

---

## 🎯 NORTH STAR METRIC

**Primary**: Monthly Recurring Revenue (MRR)

**Why**: MRR directly correlates with company valuation and is the clearest indicator of business health and growth.

**Secondary Metrics**:
1. **Weekly Active Users** - Indicates product stickiness
2. **Net Revenue Retention** - Indicates expansion revenue
3. **Time to First Value** - Indicates onboarding quality

---

## 📝 NOTES

### Metric Calculation Formulas

**MRR** = Sum of all monthly subscription revenue
**ARR** = MRR × 12
**Churn Rate** = (Customers lost this month ÷ Customers at start of month) × 100
**LTV** = ARPU ÷ Churn Rate
**CAC** = Total acquisition costs ÷ New customers
**LTV:CAC** = LTV ÷ CAC

### Industry Benchmarks (SaaS)
- **Good LTV:CAC**: 3:1 or higher
- **Good Churn**: <5% monthly for consumer, <2% for enterprise
- **Good Conversion**: 2-5% visitor → signup, 10-20% signup → paid
- **Good NPS**: >50 is excellent, 30-50 is good
- **Good Gross Margin**: 80%+ for SaaS

### Exit Valuation Multiples
- **Revenue Multiple**: 4-8x ARR (for growing SaaS)
- **Profit Multiple**: 3-5x annual profit (for lifestyle businesses)
- **Strategic Premium**: 10-20% premium for strategic buyers

**Example**: $1.2M ARR with 30% growth → $5-6M valuation

---

## ✅ METRIC TRACKING CHECKLIST

### Week 1-2 Setup
- [ ] Set up PostHog analytics
- [ ] Install Sentry error tracking
- [ ] Create basic Stripe test account
- [ ] Set up Google Analytics on marketing site
- [ ] Create metrics spreadsheet for manual tracking

### Week 3-4 Instrumentation
- [ ] Add PostHog events for key actions
- [ ] Track signup funnel
- [ ] Track feature usage
- [ ] Track payment events
- [ ] Create dashboard views

### Ongoing
- [ ] Weekly metrics review (every Monday)
- [ ] Monthly cohort analysis
- [ ] Quarterly roadmap alignment
- [ ] Update this file with actual metrics as they come in

---

**Remember**: You can't improve what you don't measure. Track everything, optimize constantly, and stay focused on MRR growth.

**Next Update**: When first user signs up (update Current Metrics section)
