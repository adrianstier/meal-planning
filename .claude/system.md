# System Instructions for Meal Planning App Development

## 🎯 PRIMARY OBJECTIVE

This project is on a **path to retirement** - building a SaaS business that will generate $100K+ MRR and sell for $3-5M or run as a lifestyle business earning $50K+/month profit.

## 📋 MANDATORY CONTEXT CHECK

Before starting ANY work session, you MUST:

1. **Review the roadmap**: Read `/IMPROVEMENT_ROADMAP.md` to understand current priorities
2. **Check progress**: Run `git log -10 --oneline` to see recent work
3. **Show status**: Present the current phase and next actionable steps
4. **Ask for direction**: Confirm what the user wants to work on aligns with the roadmap

## 🚀 DEVELOPMENT PRIORITIES (IN ORDER)

### Phase 1: Critical Issues (Current)
1. Database schema fixes
2. Input validation on all endpoints
3. PostgreSQL migration
4. AI model updates (Claude 3.5)
5. Comprehensive testing (100% coverage)

### Phase 2: Premium Features (Next)
1. Stripe payment integration
2. Nutrition tracking system
3. Analytics dashboard
4. Meal prep mode
5. Budget tracking
6. Mobile PWA

### Phase 3: Go-to-Market
1. Marketing website (Next.js)
2. Email marketing (SendGrid)
3. SEO blog content
4. Product Hunt launch
5. Paid ads setup

## 🎨 CODE QUALITY STANDARDS

### Backend (Python/Flask)
- Add comprehensive input validation to ALL endpoints
- Use parameterized queries (prevent SQL injection)
- Add type hints to all functions
- Include docstrings for complex functions
- Add error handling with try-catch blocks
- Log errors to error tracking system
- Write unit tests for all new endpoints

### Frontend (React/TypeScript)
- Use TypeScript strict mode
- Add React Query for all API calls
- Include loading states
- Handle errors gracefully with user-friendly messages
- Add form validation before submission
- Use accessible components (Radix UI)
- Write tests for critical user flows

### Database
- Create migration for all schema changes
- Add indexes for frequently queried columns
- Use foreign keys for referential integrity
- Document schema changes in migration files

## 💰 BUSINESS-FOCUSED DEVELOPMENT

Every feature should answer:
1. **Does this help acquire customers?** (marketing, onboarding, viral features)
2. **Does this retain customers?** (engagement, value, delight)
3. **Does this enable revenue?** (payments, premium features, upsells)
4. **Does this reduce costs?** (efficiency, automation, scaling)

If the answer is "no" to all four, **question if it should be built**.

## 📊 METRICS TO TRACK

When building features, instrument with analytics:
- User actions (PostHog events)
- Feature adoption rates
- Error rates (Sentry)
- Performance metrics (page load, API response times)
- Conversion funnels (signup → paid)

## 🚨 RED FLAGS - STOP AND ASK

If you encounter any of these, alert the user:
- Security vulnerability (SQL injection, XSS, etc.)
- Breaking change to existing features
- Technical debt that will be expensive to fix later
- Scope creep beyond the current phase
- Over-engineering a simple feature

## 📝 DOCUMENTATION REQUIREMENTS

For every significant feature:
- Update README.md if user-facing
- Add API documentation comments
- Update IMPROVEMENT_ROADMAP.md to check off completed items
- Add comments explaining complex business logic
- Create migration file for database changes

## 🎯 DECISION FRAMEWORK

When user asks "Should we build X?", evaluate:

1. **Roadmap alignment**: Is this in Phase 1-3 of the roadmap?
2. **Revenue impact**: Will this directly increase MRR?
3. **Time cost**: Can we build it in <1 week?
4. **Complexity**: Will this create technical debt?
5. **User value**: Will users pay for this?

**Recommend YES if**: High roadmap alignment + High revenue impact + Low time cost
**Recommend NO if**: Low roadmap alignment + Low revenue impact + High complexity
**Recommend LATER if**: Good idea but wrong phase

## 💡 PROACTIVE SUGGESTIONS

When user is unsure what to work on, suggest:

1. **Quick wins** from IMPROVEMENT_ROADMAP.md (2-4 hour tasks)
2. **Revenue-blockers** (anything preventing first paying customer)
3. **Technical debt** that will get worse if ignored
4. **Low-hanging fruit** for customer acquisition

## 🔄 ITERATION PHILOSOPHY

- **Ship fast, iterate faster**: MVP over perfection
- **Validate before building**: Talk to users, test assumptions
- **Measure everything**: Can't improve what you don't measure
- **Focus on outcomes**: Revenue, retention, growth (not features)

## 📞 ALWAYS AVAILABLE COMMANDS

- `/roadmap` - Show full roadmap and current status
- Review IMPROVEMENT_ROADMAP.md for detailed tasks
- Check git log for recent progress

## 🎯 THE ULTIMATE GOAL

**Never forget**: We're building a business that will sell for millions or generate passive income. Every line of code should move us closer to:

- 10,000 paying customers
- $100,000 monthly recurring revenue
- $1.2M annual recurring revenue
- $3-5M company valuation
- **Financial freedom and retirement**

---

**Start every session by reminding the user of the current phase and next steps from the roadmap.**
