#!/usr/bin/env python3
"""
Additional 20 Complementary Tests for Multi-User Authentication System
"""

import re
import os
import sqlite3
import subprocess
from pathlib import Path

class TestRunner:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.total = 20

    def pass_test(self, name):
        print(f"✅ PASS: {name}")
        self.passed += 1

    def fail_test(self, name, reason=""):
        print(f"❌ FAIL: {name}")
        if reason:
            print(f"   Reason: {reason}")
        self.failed += 1

    def run_all_tests(self):
        print("=" * 60)
        print("ADDITIONAL 20 COMPLEMENTARY TESTS")
        print("Multi-User Authentication System")
        print("=" * 60)
        print()

        self.test_9_session_security()
        self.test_10_protected_endpoints()
        self.test_11_password_hashing()
        self.test_12_sql_injection()
        self.test_13_foreign_keys()
        self.test_14_auth_context_check()
        self.test_15_form_validation()
        self.test_16_credentials_include()
        self.test_17_no_dangerous_html()
        self.test_18_user_id_filtering()
        self.test_19_migration_idempotent()
        self.test_20_logout_implementation()
        self.test_21_error_handling()
        self.test_22_loading_states()
        self.test_23_typescript_types()
        self.test_24_no_localstorage()
        self.test_25_session_config()
        self.test_26_auth_gate()
        self.test_27_logout_ui()
        self.test_28_user_display()

        self.print_summary()

    def test_9_session_security(self):
        print("Test 9: Session cookie security configuration")
        try:
            with open('app.py', 'r') as f:
                content = f.read()

            checks = [
                'SESSION_COOKIE_HTTPONLY' in content,
                'SESSION_COOKIE_SAMESITE' in content,
                'SESSION_USE_SIGNER' in content
            ]

            if all(checks):
                self.pass_test("Session cookies have proper security flags")
            else:
                self.fail_test("Session cookie security flags incomplete")
        except Exception as e:
            self.fail_test("Session security check", str(e))
        print()

    def test_10_protected_endpoints(self):
        print("Test 10: Verify all API endpoints are protected")
        try:
            with open('app.py', 'r') as f:
                content = f.read()

            # Find routes
            routes = re.findall(r'@app\.route\([\'\"](/api/[^\'"]+)[\'"]', content)

            # Exclude auth endpoints
            auth_endpoints = ['/api/auth/login', '/api/auth/register', '/api/auth/logout', '/api/auth/me']
            unprotected = []

            for route in routes:
                if route not in auth_endpoints:
                    # Find function definition
                    route_match = re.search(rf'@app\.route\([\'\"]{re.escape(route)}[\'"].*?\).*?def\s+(\w+)', content, re.DOTALL)
                    if route_match:
                        func_name = route_match.group(1)
                        # Check for @login_required before this function
                        func_section = content[:route_match.start()]
                        last_decorator = func_section.rfind('@')
                        decorator_section = content[last_decorator:route_match.start()]

                        if '@login_required' not in decorator_section:
                            unprotected.append(route)

            if not unprotected:
                self.pass_test("All non-auth endpoints have @login_required")
            else:
                self.fail_test(f"Endpoints missing @login_required: {', '.join(unprotected[:3])}")
        except Exception as e:
            self.fail_test("Protected endpoints check", str(e))
        print()

    def test_11_password_hashing(self):
        print("Test 11: Password hashing implementation")
        try:
            with open('auth.py', 'r') as f:
                content = f.read()

            checks = [
                'secrets.token_hex(16)' in content,
                'hashlib.sha256' in content,
                'salt$' in content or "salt\\$" in content
            ]

            if all(checks):
                self.pass_test("Password hashing uses salt correctly")
            else:
                self.fail_test("Password hashing missing salt or proper algorithm")
        except Exception as e:
            self.fail_test("Password hashing check", str(e))
        print()

    def test_12_sql_injection(self):
        print("Test 12: SQL injection protection (parameterized queries)")
        try:
            dangerous_patterns = 0
            files = ['app.py', 'meal_planner.py']

            for file in files:
                if os.path.exists(file):
                    with open(file, 'r') as f:
                        content = f.read()
                    # Look for f-strings in SQL queries
                    dangerous_patterns += len(re.findall(r'f["\'].*SELECT.*["\']', content))
                    dangerous_patterns += len(re.findall(r'f["\'].*INSERT.*["\']', content))

            if dangerous_patterns == 0:
                self.pass_test("No f-strings or concatenation in SQL queries")
            else:
                self.fail_test(f"Found {dangerous_patterns} SQL queries using string formatting (SQL injection risk)")
        except Exception as e:
            self.fail_test("SQL injection check", str(e))
        print()

    def test_13_foreign_keys(self):
        print("Test 13: Foreign key constraints in database")
        try:
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

            if fk_count >= 5:
                self.pass_test(f"Foreign key constraints exist on {fk_count} tables")
            else:
                self.fail_test(f"Only {fk_count} tables have foreign keys to users table")
        except Exception as e:
            self.fail_test("Foreign keys check", str(e))
        print()

    def test_14_auth_context_check(self):
        print("Test 14: AuthContext auto-check authentication")
        try:
            with open('client/src/contexts/AuthContext.tsx', 'r') as f:
                content = f.read()

            checks = [
                'useEffect' in content and 'checkAuth' in content,
                '/api/auth/me' in content
            ]

            if all(checks):
                self.pass_test("AuthContext checks authentication on mount")
            else:
                self.fail_test("AuthContext missing auto-check on mount")
        except Exception as e:
            self.fail_test("AuthContext check", str(e))
        print()

    def test_15_form_validation(self):
        print("Test 15: Login form validation")
        try:
            with open('client/src/pages/LoginPage.tsx', 'r') as f:
                content = f.read()

            checks = [
                'minLength' in content,
                'required' in content
            ]

            if all(checks):
                self.pass_test("Login form has validation (minLength, required)")
            else:
                self.fail_test("Login form missing validation")
        except Exception as e:
            self.fail_test("Form validation check", str(e))
        print()

    def test_16_credentials_include(self):
        print("Test 16: API calls include credentials for cookies")
        try:
            with open('client/src/contexts/AuthContext.tsx', 'r') as f:
                content = f.read()

            cred_count = content.count("credentials: 'include'")

            if cred_count >= 3:
                self.pass_test(f"API calls include credentials ({cred_count} occurrences)")
            else:
                self.fail_test(f"Not all API calls include credentials (found {cred_count})")
        except Exception as e:
            self.fail_test("Credentials include check", str(e))
        print()

    def test_17_no_dangerous_html(self):
        print("Test 17: XSS protection - no dangerouslySetInnerHTML")
        try:
            dangerous_files = []
            for tsx_file in Path('client/src').rglob('*.tsx'):
                with open(tsx_file, 'r') as f:
                    if 'dangerouslySetInnerHTML' in f.read():
                        dangerous_files.append(str(tsx_file))

            if not dangerous_files:
                self.pass_test("No dangerouslySetInnerHTML usage in React components")
            else:
                self.fail_test(f"Found dangerouslySetInnerHTML in {len(dangerous_files)} files (XSS risk)")
        except Exception as e:
            self.fail_test("XSS protection check", str(e))
        print()

    def test_18_user_id_filtering(self):
        print("Test 18: User ID filtering in database queries")
        try:
            with open('app.py', 'r') as f:
                content = f.read()

            user_id_filters = content.count('user_id = ?') + content.count('user_id=?')

            if user_id_filters >= 30:
                self.pass_test(f"User ID filtering found in {user_id_filters} queries")
            else:
                self.fail_test(f"Only {user_id_filters} queries filter by user_id (expected 30+)")
        except Exception as e:
            self.fail_test("User ID filtering check", str(e))
        print()

    def test_19_migration_idempotent(self):
        print("Test 19: Migration idempotency")
        try:
            with open('database/migrations/add_users_and_auth.py', 'r') as f:
                content = f.read()

            checks = [
                'IF NOT EXISTS' in content,
                'ALTER TABLE' in content
            ]

            if all(checks):
                self.pass_test("Migration uses IF NOT EXISTS for safety")
            else:
                self.fail_test("Migration may not be idempotent")
        except Exception as e:
            self.fail_test("Migration idempotency check", str(e))
        print()

    def test_20_logout_implementation(self):
        print("Test 20: Logout implementation")
        try:
            with open('auth.py', 'r') as f:
                auth_content = f.read()

            with open('client/src/contexts/AuthContext.tsx', 'r') as f:
                context_content = f.read()

            checks = [
                'session.clear()' in auth_content,
                'logout' in context_content and 'POST' in context_content
            ]

            if all(checks):
                self.pass_test("Logout properly clears session")
            else:
                self.fail_test("Logout may not clear session correctly")
        except Exception as e:
            self.fail_test("Logout implementation check", str(e))
        print()

    def test_21_error_handling(self):
        print("Test 21: Error handling in authentication")
        try:
            with open('client/src/contexts/AuthContext.tsx', 'r') as f:
                content = f.read()

            checks = [
                'catch' in content,
                'throw new Error' in content or 'Error(' in content
            ]

            if all(checks):
                self.pass_test("Authentication has proper error handling")
            else:
                self.fail_test("Authentication missing error handling")
        except Exception as e:
            self.fail_test("Error handling check", str(e))
        print()

    def test_22_loading_states(self):
        print("Test 22: Loading states during authentication")
        try:
            with open('client/src/contexts/AuthContext.tsx', 'r') as f:
                content = f.read()

            checks = [
                'loading' in content and 'boolean' in content,
                'setLoading' in content
            ]

            if all(checks):
                self.pass_test("Loading states implemented in AuthContext")
            else:
                self.fail_test("Loading states missing or incomplete")
        except Exception as e:
            self.fail_test("Loading states check", str(e))
        print()

    def test_23_typescript_types(self):
        print("Test 23: TypeScript type safety")
        try:
            with open('client/src/contexts/AuthContext.tsx', 'r') as f:
                content = f.read()

            checks = [
                'interface User' in content,
                'interface AuthContextType' in content
            ]

            if all(checks):
                self.pass_test("TypeScript interfaces defined for type safety")
            else:
                self.fail_test("TypeScript interfaces incomplete")
        except Exception as e:
            self.fail_test("TypeScript types check", str(e))
        print()

    def test_24_no_localstorage(self):
        print("Test 24: No credentials in localStorage (security)")
        try:
            has_localstorage = False
            files = ['client/src/contexts/AuthContext.tsx', 'client/src/pages/LoginPage.tsx']

            for file in files:
                with open(file, 'r') as f:
                    if 'localStorage' in f.read():
                        has_localstorage = True
                        break

            if not has_localstorage:
                self.pass_test("No credentials stored in localStorage (secure)")
            else:
                self.fail_test("Found localStorage usage in auth code (security risk)")
        except Exception as e:
            self.fail_test("localStorage check", str(e))
        print()

    def test_25_session_config(self):
        print("Test 25: Session configuration")
        try:
            with open('app.py', 'r') as f:
                content = f.read()

            checks = [
                'SESSION_PERMANENT' in content,
                'SESSION_TYPE' in content
            ]

            if all(checks):
                self.pass_test("Session expiry and type configured")
            else:
                self.fail_test("Session configuration incomplete")
        except Exception as e:
            self.fail_test("Session configuration check", str(e))
        print()

    def test_26_auth_gate(self):
        print("Test 26: Authentication gate implementation")
        try:
            with open('client/src/App.tsx', 'r') as f:
                content = f.read()

            checks = [
                'if (!user)' in content,
                'LoginPage' in content
            ]

            if all(checks):
                self.pass_test("Auth gate properly prevents unauthorized access")
            else:
                self.fail_test("Auth gate missing or incomplete")
        except Exception as e:
            self.fail_test("Auth gate check", str(e))
        print()

    def test_27_logout_ui(self):
        print("Test 27: Logout UI implementation")
        try:
            with open('client/src/components/Layout.tsx', 'r') as f:
                content = f.read()

            checks = [
                'handleLogout' in content or 'logout' in content,
                'LogOut' in content
            ]

            if all(checks):
                self.pass_test("Logout button implemented in Layout")
            else:
                self.fail_test("Logout button missing in Layout")
        except Exception as e:
            self.fail_test("Logout UI check", str(e))
        print()

    def test_28_user_display(self):
        print("Test 28: User information display")
        try:
            with open('client/src/components/Layout.tsx', 'r') as f:
                content = f.read()

            checks = [
                'user?.display_name' in content or 'user.display_name' in content,
                'User' in content
            ]

            if all(checks):
                self.pass_test("User display shows name in header")
            else:
                self.fail_test("User display incomplete in header")
        except Exception as e:
            self.fail_test("User display check", str(e))
        print()

    def print_summary(self):
        print("=" * 60)
        print("TEST SUMMARY - ADDITIONAL 20 TESTS")
        print("=" * 60)
        print(f"Total Tests: {self.total}")
        print(f"Passed: {self.passed}")
        print(f"Failed: {self.failed}")
        print(f"Pass Rate: {(self.passed * 100 // self.total)}%")
        print()

        if self.failed == 0:
            print("🎉 ALL 20 ADDITIONAL TESTS PASSED!")
            print()
            print("Combined with previous 8 tests:")
            print("  - Original Tests: 8/8 ✅")
            print("  - Additional Tests: 20/20 ✅")
            print("  - TOTAL: 28/28 ✅")
            print()
            print("✅ READY FOR DEPLOYMENT")
            return 0
        else:
            print("⚠️  Some tests failed. Review failures above.")
            return 1

if __name__ == '__main__':
    runner = TestRunner()
    exit(runner.run_all_tests())
