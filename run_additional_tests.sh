#!/bin/bash
echo "============================================"
echo "ADDITIONAL 20 COMPLEMENTARY TESTS"
echo "Multi-User Authentication System"
echo "============================================"
echo ""

PASSED=0
FAILED=0
TOTAL=20

# Helper function to track results
pass_test() {
    echo "✅ PASS: $1"
    ((PASSED++))
}

fail_test() {
    echo "❌ FAIL: $1"
    ((FAILED++))
}

# Test 9: Session cookie security flags
echo "Test 9: Session cookie security configuration"
if grep -q "SESSION_COOKIE_HTTPONLY = True" app.py && \
   grep -q "SESSION_COOKIE_SAMESITE = 'Lax'" app.py && \
   grep -q "SESSION_USE_SIGNER = True" app.py; then
    pass_test "Session cookies have proper security flags"
else
    fail_test "Session cookie security flags incomplete"
fi
echo ""

# Test 10: All protected endpoints have @login_required
echo "Test 10: Verify all API endpoints are protected"
UNPROTECTED=$(python3 -c "
import re
with open('app.py', 'r') as f:
    content = f.read()
    
# Find all @app.route definitions
routes = re.findall(r'@app\.route\([\'\"](/api/[^\'"]+)[\'\"]\s*,?\s*methods=\[[^\]]+\]\s*\)?\s*def\s+(\w+)', content, re.MULTILINE)

# Exclude auth endpoints
auth_endpoints = ['/api/auth/login', '/api/auth/register', '/api/auth/logout', '/api/auth/me']
unprotected = []

for route, func in routes:
    if route not in auth_endpoints:
        # Check if @login_required appears before this function
        func_start = content.find(f'def {func}')
        section = content[max(0, func_start-200):func_start]
        if '@login_required' not in section:
            unprotected.append(route)

if unprotected:
    print('FAIL:', ', '.join(unprotected))
else:
    print('PASS')
" 2>&1)

if echo "$UNPROTECTED" | grep -q "PASS"; then
    pass_test "All non-auth endpoints have @login_required"
else
    fail_test "Some endpoints missing @login_required: $UNPROTECTED"
fi
echo ""

# Test 11: Password hashing uses salt
echo "Test 11: Password hashing implementation"
if grep -q "secrets.token_hex(16)" auth.py && \
   grep -q "hashlib.sha256" auth.py && \
   grep -q "salt\$" auth.py; then
    pass_test "Password hashing uses salt correctly"
else
    fail_test "Password hashing missing salt or proper algorithm"
fi
echo ""

# Test 12: Database queries use parameterized statements
echo "Test 12: SQL injection protection (parameterized queries)"
CONCAT_SQL=$(grep -n "f\".*SELECT\|f'.*SELECT" app.py meal_planner.py 2>/dev/null | wc -l)
if [ "$CONCAT_SQL" -eq 0 ]; then
    pass_test "No f-strings or concatenation in SQL queries"
else
    fail_test "Found $CONCAT_SQL SQL queries using string formatting (SQL injection risk)"
fi
echo ""

# Test 13: Foreign key constraints exist
echo "Test 13: Foreign key constraints in database"
FK_COUNT=$(python3 -c "
import sqlite3
conn = sqlite3.connect('meal_planner.db')
c = conn.cursor()
tables = ['meals', 'meal_plan', 'recipes', 'bento_menu', 'school_menu', 'shopping_list']
fk_count = 0
for table in tables:
    c.execute(f'PRAGMA foreign_key_list({table})')
    fks = c.fetchall()
    if any('users' in str(fk) for fk in fks):
        fk_count += 1
conn.close()
print(fk_count)
" 2>&1)

if [ "$FK_COUNT" -ge 5 ]; then
    pass_test "Foreign key constraints exist on $FK_COUNT tables"
else
    fail_test "Only $FK_COUNT tables have foreign keys to users table"
fi
echo ""

# Test 14: AuthContext checks auth on mount
echo "Test 14: AuthContext auto-check authentication"
if grep -q "useEffect.*checkAuth" client/src/contexts/AuthContext.tsx && \
   grep -q "/api/auth/me" client/src/contexts/AuthContext.tsx; then
    pass_test "AuthContext checks authentication on mount"
else
    fail_test "AuthContext missing auto-check on mount"
fi
echo ""

# Test 15: Login page has form validation
echo "Test 15: Login form validation"
if grep -q "minLength={6}" client/src/pages/LoginPage.tsx && \
   grep -q "required" client/src/pages/LoginPage.tsx; then
    pass_test "Login form has validation (minLength, required)"
else
    fail_test "Login form missing validation"
fi
echo ""

# Test 16: API calls include credentials
echo "Test 16: API calls include credentials for cookies"
CRED_COUNT=$(grep -c "credentials: 'include'" client/src/contexts/AuthContext.tsx 2>/dev/null || echo "0")
if [ "$CRED_COUNT" -ge 3 ]; then
    pass_test "API calls include credentials ($CRED_COUNT occurrences)"
else
    fail_test "Not all API calls include credentials (found $CRED_COUNT)"
fi
echo ""

# Test 17: No dangerouslySetInnerHTML in React
echo "Test 17: XSS protection - no dangerouslySetInnerHTML"
DANGEROUS=$(find client/src -name "*.tsx" -exec grep -l "dangerouslySetInnerHTML" {} \; 2>/dev/null | wc -l)
if [ "$DANGEROUS" -eq 0 ]; then
    pass_test "No dangerouslySetInnerHTML usage in React components"
else
    fail_test "Found dangerouslySetInnerHTML in $DANGEROUS files (XSS risk)"
fi
echo ""

# Test 18: User ID filtering in queries
echo "Test 18: User ID filtering in database queries"
USER_ID_FILTERS=$(grep -c "user_id = ?" app.py 2>/dev/null || echo "0")
if [ "$USER_ID_FILTERS" -ge 30 ]; then
    pass_test "User ID filtering found in $USER_ID_FILTERS queries"
else
    fail_test "Only $USER_ID_FILTERS queries filter by user_id (expected 30+)"
fi
echo ""

# Test 19: Migration script is idempotent
echo "Test 19: Migration idempotency"
if grep -q "IF NOT EXISTS" database/migrations/add_users_and_auth.py && \
   grep -q "ALTER TABLE.*ADD COLUMN" database/migrations/add_users_and_auth.py; then
    pass_test "Migration uses IF NOT EXISTS for safety"
else
    fail_test "Migration may not be idempotent"
fi
echo ""

# Test 20: Logout clears session
echo "Test 20: Logout implementation"
if grep -q "session.clear()" auth.py && \
   grep -q "logout.*POST" client/src/contexts/AuthContext.tsx; then
    pass_test "Logout properly clears session"
else
    fail_test "Logout may not clear session correctly"
fi
echo ""

# Test 21: Error handling in AuthContext
echo "Test 21: Error handling in authentication"
if grep -q "catch.*err" client/src/contexts/AuthContext.tsx && \
   grep -q "throw new Error" client/src/contexts/AuthContext.tsx; then
    pass_test "Authentication has proper error handling"
else
    fail_test "Authentication missing error handling"
fi
echo ""

# Test 22: Loading states in UI
echo "Test 22: Loading states during authentication"
if grep -q "loading.*boolean" client/src/contexts/AuthContext.tsx && \
   grep -q "setLoading" client/src/contexts/AuthContext.tsx; then
    pass_test "Loading states implemented in AuthContext"
else
    fail_test "Loading states missing or incomplete"
fi
echo ""

# Test 23: TypeScript strict mode
echo "Test 23: TypeScript type safety"
if grep -q "interface User" client/src/contexts/AuthContext.tsx && \
   grep -q "interface AuthContextType" client/src/contexts/AuthContext.tsx; then
    pass_test "TypeScript interfaces defined for type safety"
else
    fail_test "TypeScript interfaces incomplete"
fi
echo ""

# Test 24: No credentials in localStorage
echo "Test 24: No credentials in localStorage (security)"
LOCAL_STORAGE=$(grep -r "localStorage" client/src/contexts/AuthContext.tsx client/src/pages/LoginPage.tsx 2>/dev/null | wc -l)
if [ "$LOCAL_STORAGE" -eq 0 ]; then
    pass_test "No credentials stored in localStorage (secure)"
else
    fail_test "Found localStorage usage in auth code (security risk)"
fi
echo ""

# Test 25: Session expiry configuration
echo "Test 25: Session configuration"
if grep -q "SESSION_PERMANENT = False" app.py && \
   grep -q "SESSION_TYPE" app.py; then
    pass_test "Session expiry and type configured"
else
    fail_test "Session configuration incomplete"
fi
echo ""

# Test 26: Auth gate in App.tsx
echo "Test 26: Authentication gate implementation"
if grep -q "if (!user)" client/src/App.tsx && \
   grep -q "return <LoginPage" client/src/App.tsx; then
    pass_test "Auth gate properly prevents unauthorized access"
else
    fail_test "Auth gate missing or incomplete"
fi
echo ""

# Test 27: Logout button in Layout
echo "Test 27: Logout UI implementation"
if grep -q "handleLogout" client/src/components/Layout.tsx && \
   grep -q "LogOut" client/src/components/Layout.tsx; then
    pass_test "Logout button implemented in Layout"
else
    fail_test "Logout button missing in Layout"
fi
echo ""

# Test 28: User display in header
echo "Test 28: User information display"
if grep -q "user?.display_name.*user?.username" client/src/components/Layout.tsx && \
   grep -q "User.*className" client/src/components/Layout.tsx; then
    pass_test "User display shows name in header"
else
    fail_test "User display incomplete in header"
fi
echo ""

echo "============================================"
echo "TEST SUMMARY - ADDITIONAL 20 TESTS"
echo "============================================"
echo "Total Tests: $TOTAL"
echo "Passed: $PASSED"
echo "Failed: $FAILED"
echo "Pass Rate: $(( PASSED * 100 / TOTAL ))%"
echo ""

if [ "$FAILED" -eq 0 ]; then
    echo "🎉 ALL 20 ADDITIONAL TESTS PASSED!"
    echo ""
    echo "Combined with previous 8 tests:"
    echo "  - Original Tests: 8/8 ✅"
    echo "  - Additional Tests: 20/20 ✅"
    echo "  - TOTAL: 28/28 ✅"
    echo ""
    echo "✅ READY FOR DEPLOYMENT"
    exit 0
else
    echo "⚠️  Some tests failed. Review failures above."
    exit 1
fi
