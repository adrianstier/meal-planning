# MASTER PLAN: Full Multi-User Authentication Implementation

## Executive Summary

**Goal**: Enable multiple users to beta test the meal planning app with separate, isolated data.

**Status**: Foundation complete (40%), Implementation remaining (60%)

**Estimated Time**: 6-8 hours across 3-4 sessions

**Approach**: Phased implementation with testing at each stage

---

## Architecture Overview

### How Multi-User Works

```
User Registration/Login
    ↓
Session Created (HTTP-only cookie)
    ↓
API Requests Include Session
    ↓
@login_required Decorator Validates Session
    ↓
get_current_user_id() Returns user_id
    ↓
Database Queries Filter by user_id
    ↓
User Only Sees Their Own Data
```

### Security Model

- **Authentication**: Session-based (Flask sessions)
- **Password Storage**: SHA-256 + random salt
- **Session Security**: HTTP-only cookies, SameSite=Lax
- **Data Isolation**: Every query filters by user_id
- **Authorization**: Users can only access their own data

---

## SESSION 1: Foundation (COMPLETED ✅)

### Completed Items:

1. **Database Schema**
   - Created `users` table
   - Added `user_id` foreign keys to all tables
   - Migration assigns existing data to admin user
   - File: [database/migrations/add_users_and_auth.py](database/migrations/add_users_and_auth.py)

2. **Authentication Module**
   - Password hashing/verification
   - User creation and authentication
   - Session management functions
   - `@login_required` decorator
   - File: [auth.py](auth.py)

3. **Backend Auth Endpoints**
   - POST `/api/auth/register` - Create new user
   - POST `/api/auth/login` - Authenticate user
   - POST `/api/auth/logout` - End session
   - GET `/api/auth/me` - Get current user info
   - File: [app.py](app.py) lines 161-252

4. **Session Configuration**
   - Secret key for session encryption
   - HTTP-only cookies
   - CORS with credentials support
   - File: [app.py](app.py) lines 36-41

### Test Commands:

```bash
# Run migration locally
python3 database/migrations/add_users_and_auth.py

# Test auth endpoints
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"SAVED_PASSWORD"}' \
  -c cookies.txt

curl http://localhost:5000/api/auth/me -b cookies.txt
```

---

## SESSION 2: Backend Routes Protection (2-3 hours)

### Goal: Add @login_required and user_id filtering to all API routes

### Routes to Update (Priority Order):

#### Group 1: Meals Routes (Highest Priority)
**File**: app.py, lines ~270-500

1. `GET /api/meals` - List user's meals
2. `POST /api/meals` - Create new meal for user
3. `GET /api/meals/<id>` - Get specific meal (verify ownership)
4. `PUT /api/meals/<id>` - Update meal (verify ownership)
5. `DELETE /api/meals/<id>` - Delete meal (verify ownership)
6. `POST /api/meals/<id>/favorite` - Toggle favorite
7. `DELETE /api/meals/<id>/favorite` - Remove favorite
8. `POST /api/meals/parse` - Parse recipe for user
9. `GET /api/meals/kid-friendly` - Get user's kid-friendly meals
10. `POST /api/meals/randomize` - Randomize from user's meals

**Pattern for Each Route**:
```python
@app.route('/api/meals', methods=['GET'])
@login_required  # ADD THIS
def get_meals():
    user_id = get_current_user_id()  # ADD THIS

    # MODIFY QUERY to filter by user_id
    cursor.execute("""
        SELECT * FROM meals
        WHERE user_id = ?  # ADD THIS
        ORDER BY created_at DESC
    """, (user_id,))  # ADD user_id parameter
```

#### Group 2: Shopping Routes
**File**: app.py, lines ~620-720

1. `GET /api/shopping` - Get user's shopping list
2. `POST /api/shopping` - Add item to user's list
3. `PUT /api/shopping/<id>` - Update item (verify ownership)
4. `DELETE /api/shopping/<id>` - Delete item (verify ownership)

#### Group 3: Meal Plan Routes
**File**: app.py, lines ~590-620, ~1150-1450

1. `GET /api/plan/week` - Get user's weekly plan
2. `POST /api/plan` - Create plan for user
3. `GET /api/meal-plans` - Get user's meal plans
4. `POST /api/meal-plans` - Create meal plan

#### Group 4: School Menu Routes
**File**: app.py, lines ~730-850

1. `GET /api/school-menu` - Get user's school menu items
2. `POST /api/school-menu` - Add menu item for user
3. `PUT /api/school-menu/<id>` - Update menu item
4. `DELETE /api/school-menu/<id>` - Delete menu item

#### Group 5: Bento Routes
**File**: app.py, lines ~950-1100

1. `GET /api/bento/items` - Get user's bento items
2. `POST /api/bento/items` - Add bento item for user
3. `PUT /api/bento/items/<id>` - Update bento item
4. `DELETE /api/bento/items/<id>` - Delete bento item
5. `GET /api/bento/plans` - Get user's bento plans
6. `POST /api/bento/plans` - Create bento plan
7. `PUT /api/bento/plans/<id>` - Update bento plan

### Testing Strategy:

After each group:
```bash
# 1. Start app
python3 app.py

# 2. Login as admin
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"PASSWORD"}' \
  -c cookies.txt

# 3. Test protected endpoint
curl http://localhost:5000/api/meals -b cookies.txt

# 4. Test without auth (should fail)
curl http://localhost:5000/api/meals
```

### Deliverables:

- [ ] All 50+ routes have `@login_required`
- [ ] All SELECT queries filter by `user_id`
- [ ] All INSERT queries include `user_id`
- [ ] All UPDATE/DELETE queries verify ownership
- [ ] Local testing passes for each group

---

## SESSION 3: React Frontend Authentication (2-3 hours)

### Goal: Add login UI and authentication state management

### Files to Create:

#### 1. AuthContext (`client/src/contexts/AuthContext.tsx`)
**Purpose**: Global auth state management

**Features**:
- Track current user
- Login/logout/register functions
- Auto-check auth status on load
- Loading states

**Code**: See [MULTI_USER_IMPLEMENTATION_PLAN.md](MULTI_USER_IMPLEMENTATION_PLAN.md) Section 6.1

#### 2. LoginPage (`client/src/pages/LoginPage.tsx`)
**Purpose**: Login and registration UI

**Features**:
- Login form
- Registration form
- Toggle between login/register
- Error handling
- Form validation

**Code**: See [MULTI_USER_IMPLEMENTATION_PLAN.md](MULTI_USER_IMPLEMENTATION_PLAN.md) Section 6.2

#### 3. Update App.tsx
**Purpose**: Wrap app with auth, show login when needed

**Changes**:
- Wrap app in `<AuthProvider>`
- Show `<LoginPage>` when not authenticated
- Show loading state while checking auth
- Pass user to components that need it

**Code**: See [MULTI_USER_IMPLEMENTATION_PLAN.md](MULTI_USER_IMPLEMENTATION_PLAN.md) Section 6.3

### Testing Strategy:

```bash
# 1. Start both servers
python3 app.py  # Terminal 1
cd client && npm start  # Terminal 2

# 2. Test flow:
# - App loads, checks /api/auth/me
# - Shows login page (not authenticated)
# - Enter admin credentials
# - Redirects to main app
# - Can see meals/plans
# - Click logout
# - Returns to login page

# 3. Test registration:
# - Click "Register"
# - Fill form with new user
# - Auto-logs in
# - Shows empty app (new user)
```

### Deliverables:

- [ ] AuthContext manages authentication state
- [ ] LoginPage shows login/register forms
- [ ] App.tsx protects routes
- [ ] Login/logout works
- [ ] Registration works and auto-logs in
- [ ] Auth persists on page reload

---

## SESSION 4: Integration Testing & Deployment (1-2 hours)

### Goal: Test multi-user isolation and deploy to Railway

### Local Integration Tests:

```bash
# 1. Create two test users
python3 -c "from auth import create_user; create_user('user1', 'u1@test.com', 'pass1', 'User 1')"
python3 -c "from auth import create_user; create_user('user2', 'u2@test.com', 'pass2', 'User 2')"

# 2. Test data isolation:
# - Login as user1
# - Add a meal
# - Logout
# - Login as user2
# - Verify user2 doesn't see user1's meal
# - Add a different meal
# - Logout
# - Login as user1
# - Verify user1 only sees their meal

# 3. Test all features as different users:
# - Meals CRUD
# - Shopping lists
# - Meal plans
# - Bento boxes
# - School menus
```

### Deployment to Railway:

```bash
# 1. Commit all changes
git add .
git commit -m "Implement full multi-user authentication"

# 2. Push to Railway
git push

# 3. Monitor deployment
# - Watch Railway logs
# - Migration runs automatically
# - Saves admin password in logs
# - CRITICAL: Copy admin password from first deployment!

# 4. Test on Railway
curl -X POST https://your-app.up.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"FROM_LOGS"}'
```

### Post-Deployment:

1. **Create Beta Tester Account**:
   ```bash
   # Via Railway CLI or directly in app
   railway run python3 -c "from auth import create_user; create_user('betauser', 'beta@email.com', 'securepass123', 'Beta Tester')"
   ```

2. **Share Credentials**: Send beta tester their login info

3. **Monitor Usage**: Check Railway logs for any auth errors

### Deliverables:

- [ ] Local multi-user testing passes
- [ ] Deployed to Railway
- [ ] Admin password saved
- [ ] Beta tester account created
- [ ] Beta tester can log in and use app
- [ ] Data isolation verified in production

---

## Rollback Plan

If something breaks during implementation:

### Option 1: Disable Auth Temporarily
```python
# In app.py, comment out @login_required decorators
# App works as single-user until fixed
```

### Option 2: Revert Specific Session
```bash
git log --oneline  # Find commit before breaking change
git revert <commit-hash>
git push
```

### Option 3: Full Rollback
```bash
git reset --hard <last-working-commit>
git push --force  # Only if necessary!
```

---

## Success Criteria

### Must Have:
- ✅ Users can register and login
- ✅ Users only see their own meals
- ✅ Users only see their own shopping lists
- ✅ Users only see their own meal plans
- ✅ Users can logout
- ✅ Auth persists across page reloads

### Nice to Have:
- Password reset functionality
- Email verification
- Profile editing
- User settings
- Remember me option

---

## Files Reference

### Created/Modified in Session 1:
- `database/migrations/add_users_and_auth.py` - User schema
- `auth.py` - Authentication utilities
- `app.py` - Session config + auth endpoints
- `setup.py` - Migration integration

### To Create in Session 3:
- `client/src/contexts/AuthContext.tsx`
- `client/src/pages/LoginPage.tsx`
- `client/src/App.tsx` (modifications)

### Documentation:
- `MULTI_USER_IMPLEMENTATION_PLAN.md` - Complete code examples
- `MULTIUSER_STATUS.md` - Current status
- `REALISTIC_MULTIUSER_NEXT_STEPS.md` - Practical next steps
- `MASTER_PLAN_MULTIUSER.md` - This file

---

## Next Session Checklist

**Before starting Session 2:**
- [ ] Review this master plan
- [ ] Have app.py open
- [ ] Have implementation plan open for reference
- [ ] Test environment running (python3 app.py works)
- [ ] Ready to update ~50 routes

**Session 2 Start Command:**
> "I'm ready to implement Session 2 of the multi-user plan. Let's start with Group 1: Meals Routes. Please update the GET /api/meals endpoint first."

**Session 3 Start Command:**
> "Backend routes are done. Let's implement Session 3: React frontend authentication. Start with creating the AuthContext."

**Session 4 Start Command:**
> "Frontend is done. Let's do Session 4: Integration testing and deployment to Railway."

---

## Estimated Timeline

| Session | Task | Time | Complexity |
|---------|------|------|------------|
| 1 ✅ | Foundation & Database | 1-2h | Medium |
| 2 | Backend Route Updates | 2-3h | High |
| 3 | React Frontend Auth | 2-3h | Medium |
| 4 | Testing & Deployment | 1-2h | Low |
| **TOTAL** | **Full Implementation** | **6-10h** | **Medium-High** |

---

## Questions to Resolve

Before Session 2:
- Should admins see all users' data? (Currently: No)
- Password requirements? (Currently: None)
- Session timeout? (Currently: Browser session)

Let me know when you're ready to start Session 2!
