# Family Meal Planner - TODO List

**Last Updated**: November 3, 2025
**Status**: Bento Integration Deploying

---

## IMMEDIATE PRIORITIES

### 1. Wait for Bento Integration Deployment ⏳
- **Status**: In Progress (deploying to Railway)
- **Description**: Bento box integration with meal planning system
- **Changes Being Deployed**:
  - Quick Add feature for Bento page (70+ common kids lunch items)
  - Bento generation checkbox in meal plan page
  - Backend support for automatic bento generation with meal plans
  - Generates 5 weekday bentos when requested
- **Actions**:
  - Monitor deployment completion (monitoring script running)
  - Test Quick Add feature on Bento page
  - Test bento generation from meal plan page
  - Verify bentos are created properly

---

## CODE QUALITY & CLEANUP

###  2. Consolidate Duplicate Code in [app.py](app.py)
- **Priority**: HIGH
- **Issue**: 107,519 bytes - too large, needs refactoring
- **Actions**:
  - Extract authentication logic to separate module
  - Extract meal planning logic to separate service layer
  - Extract recipe parsing logic to service layer
  - Create proper MVC/service architecture
- **Files**: [app.py](app.py) → Split into `routes/`, `services/`, `models/`

### 3. Remove Unused Python Files
- **Priority**: MEDIUM
- **Files to review**:
  - [meal_planner.py](meal_planner.py) - 38KB, may be old version
  - Check if it's still used or can be archived

### 4. Clean Up Duplicate Static Files
- **Priority**: MEDIUM
- **Issue**: Both `static/` and `templates/static/` exist
- **Actions**:
  - Verify which is actually served in production
  - Remove or consolidate duplicate

### 5. Database File in Client Directory
- **Priority**: LOW
- **Issue**: `client/meal_planner.db` exists (shouldn't be there)
- **Action**: Remove or add to .gitignore

---

## FEATURE IMPROVEMENTS (From IMPROVEMENT_ROADMAP.md)

### 6. Implement Leftover Tracking ⭐️ HIGH VALUE
- **Status**: NOT STARTED
- **Description**: Track and suggest meals using leftovers
- **Impact**: Reduces food waste, saves money
- **Tasks**:
  - Add leftover entry UI
  - Implement leftover matching algorithm
  - Suggest recipes that use leftovers

### 7. Implement Kid Meal Ratings ⭐️ HIGH VALUE
- **Status**: NOT STARTED
- **Description**: Let kids rate meals with star system
- **Impact**: Better meal planning based on preferences
- **Tasks**:
  - Add rating UI component
  - Store ratings per meal per user
  - Use ratings in meal suggestion algorithm

### 8. Implement Smart Meal Suggestions
- **Status**: NOT STARTED
- **Description**: AI-powered meal suggestions based on history
- **Tasks**:
  - Analyze meal history and ratings
  - Implement recommendation algorithm
  - Suggest meals based on preferences, season, ingredients

### 9. Integrate School Menu Parser
- **Status**: PARTIALLY COMPLETE
- **Description**: Parse and integrate school lunch menus
- **Files**: [school_menu_vision_parser.py](school_menu_vision_parser.py)
- **Tasks**:
  - Test vision API integration
  - Add UI for uploading school menu photos
  - Auto-populate school menu days

### 10. Implement Bento Box Enhancements
- **Status**: BASIC VERSION COMPLETE
- **Tasks**:
  - Add more bento templates
  - Add portion size calculator
  - Add nutritional information
  - Add print-friendly view

---

## FRONTEND IMPROVEMENTS

### 11. Add Loading States & Error Handling
- **Priority**: HIGH
- **Issue**: Many API calls lack proper loading/error states
- **Files**: All React components in [client/src/pages/](client/src/pages/)
- **Actions**:
  - Add Suspense boundaries
  - Add error boundaries
  - Show loading spinners
  - Show user-friendly error messages

### 12. Implement Optimistic UI Updates
- **Priority**: MEDIUM
- **Description**: Update UI immediately before API response
- **Impact**: Feels faster, better UX
- **Files**: Meal plan actions, recipe additions

### 13. Add Keyboard Shortcuts
- **Priority**: LOW
- **Description**: Power user feature
- **Examples**:
  - `N` - New recipe
  - `G` - Generate week
  - `L` - View lists

### 14. Improve Mobile UX (Post-Responsive Nav)
- **Priority**: MEDIUM
- **Tasks**:
  - Test all features on mobile after hamburger menu deploys
  - Fix any layout issues
  - Optimize touch targets
  - Test on actual devices (not just browser)

---

## BACKEND IMPROVEMENTS

### 15. Add API Rate Limiting
- **Priority**: HIGH (Security)
- **Description**: Prevent abuse of API endpoints
- **Implementation**: Use Flask-Limiter
- **Files**: [app.py](app.py)

### 16. Implement Proper Logging
- **Priority**: MEDIUM
- **Issue**: Currently using print statements
- **Actions**:
  - Set up proper logging with Python logging module
  - Log to file in production
  - Add log rotation
- **Files**: All Python files

### 17. Add Database Migrations System
- **Priority**: MEDIUM
- **Issue**: Migrations are currently manual scripts
- **Recommendation**: Use Alembic or Flask-Migrate
- **Benefit**: Automated, reversible migrations

### 18. Implement Caching
- **Priority**: MEDIUM
- **Description**: Cache frequently accessed data
- **Targets**:
  - Recipe lists
  - Meal plans
  - User preferences
- **Implementation**: Redis or Flask-Caching

### 19. Add Background Task Queue
- **Priority**: LOW
- **Use Cases**:
  - Recipe URL scraping (can be slow)
  - Image processing
  - Email notifications
- **Implementation**: Celery + Redis

---

## TESTING

### 20. Add Frontend Tests
- **Priority**: HIGH
- **Framework**: Jest + React Testing Library
- **Coverage Needed**:
  - Component rendering
  - User interactions
  - API integration
- **Files**: Create `client/src/**/*.test.tsx`

### 21. Add Backend Integration Tests
- **Priority**: MEDIUM
- **Framework**: pytest
- **Coverage**: API endpoints, auth, database operations
- **Files**: Expand [tests/](tests/)

### 22. Add E2E Tests
- **Priority**: LOW
- **Framework**: Playwright or Cypress
- **Scenarios**: Full user workflows

---

## DEPLOYMENT & DEVOPS

### 23. Set Up CI/CD Pipeline
- **Priority**: MEDIUM
- **Actions**:
  - Auto-run tests on PR
  - Auto-deploy to Railway on merge to main
  - Add deployment status badges
- **Platform**: GitHub Actions

### 24. Add Environment-Specific Configs
- **Priority**: MEDIUM
- **Issue**: Currently mixing dev/prod settings
- **Actions**:
  - Separate development.py, production.py configs
  - Use environment variables properly
  - Document all required env vars

### 25. Implement Database Backup Strategy
- **Priority**: HIGH
- **Current**: Railway persistent volume (good!)
- **Add**:
  - Automated daily backups
  - Backup to S3 or similar
  - Test restore procedure

### 26. Add Monitoring & Alerts
- **Priority**: MEDIUM
- **Tools**: Sentry for errors, Uptime monitoring
- **Metrics**: Error rates, response times, uptime

---

## SECURITY

### 27. Implement CSRF Protection
- **Priority**: HIGH
- **Current**: Basic auth exists
- **Add**: CSRF tokens for all POST requests
- **Implementation**: Flask-WTF or Flask-SeaSurf

### 28. Add Content Security Policy (CSP)
- **Priority**: MEDIUM
- **Description**: Prevent XSS attacks
- **Implementation**: Add CSP headers

### 29. Implement Password Reset Flow
- **Priority**: MEDIUM
- **Current**: No way to reset forgotten password
- **Tasks**:
  - Add "Forgot Password" link
  - Email-based reset tokens
  - Secure token generation

### 30. Add Two-Factor Authentication (2FA)
- **Priority**: LOW
- **Description**: Optional extra security
- **Implementation**: TOTP (Google Authenticator compatible)

---

## DOCUMENTATION

### 31. Create API Documentation
- **Priority**: MEDIUM
- **Tool**: Swagger/OpenAPI
- **Benefit**: Auto-generated, interactive docs
- **URL**: `/api/docs`

### 32. Add Code Documentation
- **Priority**: MEDIUM
- **Actions**:
  - Add docstrings to all Python functions
  - Add JSDoc comments to React components
  - Generate docs with Sphinx (Python) and TSDoc (TypeScript)

### 33. Create User Guide
- **Priority**: LOW
- **Content**:
  - How to add recipes
  - How to generate meal plans
  - How to customize settings
- **Format**: Markdown in `docs/` folder

### 34. Update README.md
- **Priority**: HIGH
- **Current**: [README.md](README.md) is good but needs updates
- **Add**:
  - Screenshots of new responsive navigation
  - Updated feature list
  - Deployment status badge

---

## ACCESSIBILITY (a11y)

### 35. Add ARIA Labels
- **Priority**: MEDIUM
- **Description**: Make app usable with screen readers
- **Tasks**:
  - Add aria-label to all interactive elements
  - Add proper heading hierarchy
  - Add alt text to all images

### 36. Implement Keyboard Navigation
- **Priority**: MEDIUM
- **Tasks**:
  - Ensure all features accessible via keyboard
  - Add visible focus indicators
  - Test with keyboard only

### 37. Add High Contrast Mode
- **Priority**: LOW
- **Description**: Support for users with vision impairments
- **Implementation**: CSS media query for `prefers-contrast`

---

## PERFORMANCE

### 38. Optimize React Bundle Size
- **Priority**: MEDIUM
- **Current**: Need to check bundle analysis
- **Actions**:
  - Run `npm run build -- --profile`
  - Code split large routes
  - Lazy load heavy components

### 39. Optimize Images
- **Priority**: MEDIUM
- **Tasks**:
  - Implement image compression on upload
  - Generate thumbnails
  - Use WebP format where supported

### 40. Add Service Worker for Offline Support
- **Priority**: LOW
- **Description**: Progressive Web App (PWA) features
- **Tasks**:
  - Cache static assets
  - Show offline indicator
  - Queue mutations when offline

---

## NICE-TO-HAVE FEATURES

### 41. Implement Recipe Sharing
- **Priority**: LOW
- **Description**: Share recipes with other users
- **Tasks**:
  - Add share button
  - Generate shareable links
  - Import from shared links

### 42. Add Meal Plan Templates
- **Priority**: LOW
- **Description**: Pre-made meal plans (e.g., "Vegetarian Week", "Quick & Easy")
- **Tasks**:
  - Create template system
  - Add UI to browse/apply templates

### 43. Implement Grocery List Optimization
- **Priority**: LOW
- **Description**: Group by store section, check off items
- **Tasks**:
  - Add store sections to ingredients
  - Sort by section
  - Add checkboxes

### 44. Add Nutrition Tracking
- **Priority**: LOW
- **Description**: Track calories, macros, etc.
- **Tasks**:
  - Integrate nutrition API
  - Add nutrition info to recipes
  - Show daily/weekly summaries

### 45. Implement Recipe Collections
- **Priority**: LOW
- **Description**: Organize recipes into collections (e.g., "Summer BBQ", "Kid Favorites")
- **Tasks**:
  - Add collection model
  - Add UI for creating/managing collections

---

## KNOWN BUGS

### 46. Fix Cuisine Balancing Algorithm
- **Priority**: MEDIUM
- **Issue**: Sometimes generates unbalanced weeks
- **File**: [app.py](app.py) - `generate_balanced_meal_plan()` function
- **Action**: Improve algorithm, add more randomization

### 47. Handle Recipe URL Scraping Errors
- **Priority**: MEDIUM
- **Issue**: Some recipe URLs fail to scrape
- **File**: [recipe_url_scraper.py](recipe_url_scraper.py)
- **Action**: Add better error handling, fallback options

---

## Archive Note

**Old documentation has been moved to** [`archive/old_documentation/`](archive/old_documentation/)

**Old test scripts and screenshots have been moved to** [`archive/`](archive/)

---

## Next Session Priorities

1. **Wait for responsive navigation deployment** (should be done soon!)
2. **Test responsive navigation** on multiple devices
3. **Start app.py refactoring** - it's too large
4. **Implement leftover tracking** - high user value
5. **Add kid meal ratings** - high user value

---

**Note**: This TODO list consolidates all identified issues and improvements from code review, roadmaps, and current analysis. Priority should be adjusted based on user needs and feedback.
