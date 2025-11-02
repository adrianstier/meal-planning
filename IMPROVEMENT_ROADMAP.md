# Meal Planning App - Comprehensive Improvement Roadmap

**Generated:** November 2, 2025
**Analysis Source:** Codebase audit and feature gap analysis

---

## 🚨 CRITICAL ISSUES (Fix Immediately)

### 1. Database Schema Inconsistencies ⚠️
**Impact:** Data corruption, feature breakage
**Priority:** P0 - CRITICAL

**Issues Found:**
- `leftovers_inventory` table: Column mismatch between schema and code
  - Schema: `meal_name`, `servings_left`, `date_cooked`, `expiration_date`
  - Code uses: `cooked_date`, `servings_remaining`, `expires_date`
- `meal_history` table: Inconsistent date column naming
  - Schema: `date_eaten`
  - Code references: Both `cooked_date` and `date_eaten`

**Action Required:**
- [ ] Create migration to standardize column names
- [ ] Update all code references
- [ ] Add database integrity tests

**Files to Fix:**
- `database/sql/schema.sql`
- `database/migrations/add_leftovers_feature.sql`
- `app.py` (lines referencing leftovers)

---

### 2. Missing Input Validation ⚠️
**Impact:** Server crashes, data corruption, security risks
**Priority:** P0 - CRITICAL

**Issues Found:**
```python
# app.py line 175-220: create_meal() - NO validation
- No check for required fields (name)
- No length limits on strings
- No range validation (cook_time, servings)
- Negative values allowed
```

**Action Required:**
- [ ] Add validation decorator/middleware
- [ ] Validate all POST/PUT endpoints
- [ ] Return 400 with clear error messages
- [ ] Add unit tests for validation

**Endpoints Needing Validation:**
- POST /api/meals
- PUT /api/meals/<id>
- POST /api/shopping
- POST /api/plan
- POST /api/school-menu

---

### 3. SQL Injection Risk ⚠️
**Impact:** Database compromise, data loss
**Priority:** P0 - CRITICAL

**Issues Found:**
```python
# app.py line 1110: Dynamic SQL with f-strings
query += f" AND cuisine IN ({cuisine_placeholders})"
# While this specific case uses parameterized queries for values,
# the pattern is risky
```

**Action Required:**
- [ ] Audit all SQL queries
- [ ] Use SQLAlchemy ORM or prepared statements everywhere
- [ ] Add SQL injection security tests

---

### 4. Missing Error Handling in AI Endpoints ⚠️
**Impact:** Server crashes on AI failures
**Priority:** P0 - CRITICAL

**Issues Found:**
- `app.py` line 687: Anthropic client creation without try-catch
- No timeout handling for AI calls
- No fallback when AI unavailable
- Recipe URL scraper: No timeout on HTTP requests

**Action Required:**
- [ ] Wrap all AI calls in try-catch
- [ ] Add timeout parameters
- [ ] Implement graceful degradation
- [ ] Add retry logic with exponential backoff

---

## 🔴 HIGH PRIORITY (Next Sprint)

### 5. Comprehensive API Testing
**Impact:** Bugs in production, poor reliability
**Priority:** P1 - HIGH

**Current State:**
- Only 9 endpoints have basic tests
- 53+ endpoints completely untested
- No integration tests
- No error scenario tests

**Action Required:**
- [ ] Create `tests/test_api_comprehensive.py`
- [ ] Test all CRUD operations
- [ ] Test error responses (400, 404, 500)
- [ ] Test edge cases (empty data, large payloads, special characters)
- [ ] Add API test automation to CI/CD

**Test Coverage Goals:**
- Meals API: 100% (currently ~20%)
- Plan API: 100% (currently 0%)
- Shopping API: 100% (currently ~15%)
- School Menu API: 100% (currently 0%)
- Leftovers API: 100% (currently 0%)

---

### 6. Update AI Models
**Impact:** Better accuracy, cost savings, performance
**Priority:** P1 - HIGH

**Current State:**
- Using `claude-3-haiku-20240307` (outdated)
- Comment says "only available model" (incorrect)

**Action Required:**
- [ ] Update `ai_recipe_parser.py` to `claude-3-5-haiku-20241022`
- [ ] Update `school_menu_vision_parser.py` to `claude-3-5-sonnet-20241022` (better vision)
- [ ] Update prompts for new model capabilities
- [ ] Test accuracy improvements
- [ ] Monitor cost changes

**Files to Update:**
- `ai_recipe_parser.py` line 19
- `school_menu_vision_parser.py` line 16

---

### 7. Kid Rating Feature Completion
**Impact:** Core feature incomplete
**Priority:** P1 - HIGH

**Current State:**
- Database column exists ✅
- Frontend component exists ✅
- UI integration exists ✅
- Backend API endpoint MISSING ❌

**Action Required:**
- [ ] Add `PUT /api/meals/<id>/rating` endpoint
- [ ] Add validation (1-5 range)
- [ ] Update meal query to include `kid_rating`
- [ ] Add rating change tracking (history)
- [ ] Create tests

---

### 8. Frontend Validation & Error Handling
**Impact:** Poor UX, data quality issues
**Priority:** P1 - HIGH

**Current State:**
- No form validation before submit
- Generic error messages
- No retry logic
- No offline indicators

**Action Required:**
- [ ] Add Zod or Yup validation schemas
- [ ] Validate forms before submission
- [ ] Add field-level error display
- [ ] Add loading states
- [ ] Add retry buttons
- [ ] Add error boundaries
- [ ] Add toast notifications

**Components to Update:**
- RecipesPage (meal form)
- ListsPage (shopping items)
- SchoolMenuPage (menu items)
- PlanPage (meal selection)

---

## 🟡 MEDIUM PRIORITY (Following Sprints)

### 9. Complete Analytics Dashboard
**Status:** Not started
**Priority:** P2 - MEDIUM

**Requirements:**
- Weekly variety metrics
- Kid rating trends
- Most/least cooked meals
- Cuisine distribution
- Time spent cooking per week
- Cost tracking (if prices added)

**Action Required:**
- [ ] Design analytics schema
- [ ] Create backend API `/api/analytics`
- [ ] Create AnalyticsPage component
- [ ] Add charts (Recharts library)
- [ ] Add date range selector
- [ ] Add export to CSV

**Estimated Effort:** 2-3 days

---

### 10. Nutrition Tracking
**Status:** Not started
**Priority:** P2 - MEDIUM

**Requirements:**
- Nutrition data per meal (calories, protein, carbs, fat, fiber)
- Weekly nutrition summary
- Balanced week visualization
- Nutrition goals tracking

**Action Required:**
- [ ] Add nutrition columns to meals table
- [ ] Research nutrition APIs (Nutritionix, USDA)
- [ ] Add nutrition input form
- [ ] Auto-calculate from ingredients (if possible)
- [ ] Create weekly balance visualization
- [ ] Add nutrition filters

**Estimated Effort:** 3-4 days

---

### 11. Meal Prep Mode
**Status:** Not started
**Priority:** P2 - MEDIUM

**Requirements:**
- Timeline view for prep tasks
- Group similar tasks across meals
- Prep checklist
- Batch cooking intelligence
- Prep time estimation

**Action Required:**
- [ ] Design prep task schema
- [ ] Add prep_tasks column to meals
- [ ] Create MealPrepPage component
- [ ] Implement timeline visualization
- [ ] Add task grouping algorithm
- [ ] Add prep task completion tracking

**Estimated Effort:** 4-5 days

---

### 12. E2E Testing Suite
**Status:** Not started
**Priority:** P2 - MEDIUM

**Action Required:**
- [ ] Setup Playwright or Cypress
- [ ] Test critical user flows:
  - Add new recipe from URL
  - Generate weekly meal plan
  - Create shopping list
  - Add school menu from photo
  - Rate meals
- [ ] Add E2E tests to CI/CD
- [ ] Create test data fixtures

**Estimated Effort:** 2-3 days

---

## 🟢 LOW PRIORITY (Future Enhancements)

### 13. Bento Box Visual Planner
**Status:** Not started
**Priority:** P3 - LOW
**Estimated Effort:** 5-7 days

### 14. Advanced Authentication
**Status:** Not started
**Priority:** P3 - LOW
**Estimated Effort:** 3-4 days

### 15. Multi-User Support
**Status:** Not started
**Priority:** P3 - LOW
**Estimated Effort:** 5-7 days

### 16. Mobile App (React Native)
**Status:** Not started
**Priority:** P3 - LOW
**Estimated Effort:** 3-4 weeks

---

## 📋 QUICK WINS (Easy Improvements)

### Documentation
- [ ] Add docstrings to all complex functions
- [ ] Create API documentation (Swagger/OpenAPI)
- [ ] Add architecture diagram
- [ ] Document deployment process
- [ ] Create troubleshooting guide

### Code Quality
- [ ] Add type hints to Python functions
- [ ] Fix all ESLint warnings
- [ ] Add pre-commit hooks (black, isort, eslint)
- [ ] Add code coverage reporting
- [ ] Set up Dependabot for dependency updates

### Performance
- [ ] Add pagination to /api/meals
- [ ] Implement query result caching
- [ ] Add database indexes
- [ ] Optimize N+1 queries
- [ ] Add lazy loading for ingredients

### Security
- [ ] Add rate limiting (Flask-Limiter)
- [ ] Restrict CORS to specific domains
- [ ] Add request size limits
- [ ] Add CSRF protection
- [ ] Add security headers

---

## 📊 SUCCESS METRICS

### Code Quality Targets
- [ ] API Test Coverage: 100%
- [ ] Frontend Test Coverage: 80%+
- [ ] No P0 issues
- [ ] No SQL injection vulnerabilities
- [ ] All inputs validated

### Feature Completeness
- [ ] Kid ratings: 100% functional
- [ ] Analytics: Basic dashboard
- [ ] Nutrition: Data entry complete
- [ ] All REMAINING_FEATURES items addressed

### Performance Targets
- [ ] API response time: <200ms (p95)
- [ ] Page load time: <2s
- [ ] AI generation: <5s
- [ ] Zero crashes in 30 days

---

## 🎯 SPRINT PLANNING

### Sprint 1 (Current - Week 1)
**Focus:** Critical Fixes
- ✅ Cuisine filtering (completed)
- [ ] Database schema fixes
- [ ] Input validation
- [ ] SQL injection audit
- [ ] AI error handling

### Sprint 2 (Week 2)
**Focus:** Testing & Stability
- [ ] Comprehensive API tests
- [ ] Frontend validation
- [ ] Update AI models
- [ ] Kid rating endpoint

### Sprint 3 (Week 3)
**Focus:** New Features
- [ ] Analytics dashboard
- [ ] Nutrition tracking foundation
- [ ] E2E testing setup

### Sprint 4 (Week 4)
**Focus:** Polish & Performance
- [ ] Meal prep mode
- [ ] Performance optimization
- [ ] Documentation
- [ ] Security hardening

---

## 🔄 CONTINUOUS IMPROVEMENTS

### Monitoring & Alerts
- [ ] Setup error tracking (Sentry)
- [ ] Add performance monitoring
- [ ] Create health check dashboard
- [ ] Setup uptime monitoring
- [ ] Add usage analytics

### Developer Experience
- [ ] Setup development environment guide
- [ ] Add sample data generator
- [ ] Create database seeding scripts
- [ ] Add Docker development environment
- [ ] Setup hot reload for both frontend/backend

---

## 📝 NOTES

### Technical Debt Items
1. Replace manual SQL with SQLAlchemy ORM
2. Migrate to TypeScript (frontend already is)
3. Add Redis for caching
4. Setup proper logging infrastructure
5. Move secrets to proper secret management

### Future Architecture Considerations
1. Microservices for AI processing
2. Queue system for async tasks (Celery)
3. GraphQL API as alternative to REST
4. Real-time updates (WebSockets)
5. CDN for static assets

---

## ✅ COMPLETED ITEMS

- ✅ Kid rating UI component
- ✅ Cuisine filtering system
- ✅ Recipe URL scraping
- ✅ Image downloads
- ✅ Cuisine balancing algorithm
- ✅ PWA support
- ✅ Mobile responsive UI
- ✅ School menu vision parser
- ✅ Shopping list generation
- ✅ Leftover tracking (UI)

---

**Last Updated:** November 2, 2025
**Next Review:** Weekly during sprint planning
**Owner:** Development Team
