# Multi-User Authentication Implementation Plan

## Overview
This document outlines the complete implementation plan for adding multi-user support to the meal planning app. This will allow you to share the app with beta testers while keeping everyone's data separate.

## What's Already Done

### 1. Database Migration (COMPLETED)
- Created `database/migrations/add_users_and_auth.py`
- Creates `users` table with username, email, password_hash
- Adds `user_id` foreign keys to all existing tables:
  - meals
  - meal_plans
  - shopping_items
  - meal_history
  - leftovers
  - school_menu
  - bento_items
  - bento_plans
- Migrates all existing data to a default "admin" user
- Added migration to `setup.py`

### 2. Authentication Module (COMPLETED)
- Created `auth.py` with:
  - `hash_password()` - Secure password hashing with SHA-256 + salt
  - `verify_password()` - Password verification
  - `get_current_user_id()` - Get logged-in user from session
  - `get_current_user()` - Get full user data
  - `login_required` decorator - Protect routes requiring authentication
  - `create_user()` - User registration
  - `authenticate_user()` - User login

## What Needs to Be Done

### 3. Add Authentication Endpoints to app.py

Add these routes after the health check endpoint (around line 140):

```python
from auth import (
    authenticate_user, create_user, get_current_user,
    get_current_user_id, login_required
)

# Configure Flask session
app.secret_key = os.getenv('SECRET_KEY', secrets.token_hex(32))

# Authentication endpoints
@app.route('/api/auth/register', methods=['POST'])
def register():
    """Register a new user"""
    data = request.json
    username = data.get('username')
    email = data.get('email')
    password = data.get('password')
    display_name = data.get('display_name')

    if not username or not email or not password:
        return jsonify({
            'success': False,
            'error': 'Username, email, and password are required'
        }), 400

    user_id, error = create_user(username, email, password, display_name, db.db_path)

    if error:
        return jsonify({
            'success': False,
            'error': error
        }), 400

    # Auto-login after registration
    session['user_id'] = user_id

    return jsonify({
        'success': True,
        'message': 'Registration successful'
    })


@app.route('/api/auth/login', methods=['POST'])
def login():
    """Login user"""
    data = request.json
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({
            'success': False,
            'error': 'Username and password are required'
        }), 400

    user, error = authenticate_user(username, password, db.db_path)

    if error:
        return jsonify({
            'success': False,
            'error': error
        }), 401

    # Set session
    session['user_id'] = user['id']

    return jsonify({
        'success': True,
        'user': {
            'id': user['id'],
            'username': user['username'],
            'email': user['email'],
            'display_name': user['display_name']
        }
    })


@app.route('/api/auth/logout', methods=['POST'])
def logout():
    """Logout user"""
    session.pop('user_id', None)
    return jsonify({
        'success': True,
        'message': 'Logged out successfully'
    })


@app.route('/api/auth/me', methods=['GET'])
@login_required
def get_me():
    """Get current user info"""
    user = get_current_user(db.db_path)
    return jsonify({
        'success': True,
        'user': user
    })
```

### 4. Protect Existing API Routes

Add `@login_required` decorator and user filtering to all existing routes. Example for meals:

```python
@app.route('/api/meals', methods=['GET'])
@login_required  # Add this
def get_meals():
    user_id = get_current_user_id()  # Add this

    # Modify query to filter by user_id
    cursor.execute("""
        SELECT * FROM meals
        WHERE user_id = ?  # Add this condition
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
    """, (user_id, limit, offset))  # Add user_id parameter
```

Do this for ALL routes that access user data.

### 5. Update Create/Insert Operations

When creating new records, add `user_id`:

```python
@app.route('/api/meals', methods=['POST'])
@login_required
def create_meal():
    user_id = get_current_user_id()

    cursor.execute("""
        INSERT INTO meals (name, meal_type, ingredients, user_id)
        VALUES (?, ?, ?, ?)
    """, (name, meal_type, ingredients, user_id))  # Add user_id
```

### 6. React Frontend Changes

#### 6.1 Create Authentication Context

Create `client/src/contexts/AuthContext.tsx`:

```typescript
import React, { createContext, useContext, useState, useEffect } from 'react';

interface User {
  id: number;
  username: string;
  email: string;
  display_name?: string;
}

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string, displayName?: string) => Promise<void>;
  logout: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if user is logged in
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setUser(data.user);
        }
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = async (username: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    setUser(data.user);
  };

  const register = async (username: string, email: string, password: string, displayName?: string) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password, display_name: displayName })
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    // Auto-login after registration
    await login(username, password);
  };

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
```

#### 6.2 Create Login Page

Create `client/src/pages/LoginPage.tsx`:

```typescript
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';

export function LoginPage() {
  const { login, register } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      if (isRegister) {
        await register(username, email, password, displayName);
      } else {
        await login(username, password);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{isRegister ? 'Create Account' : 'Sign In'}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>

            {isRegister && (
              <>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="displayName">Display Name (optional)</Label>
                  <Input
                    id="displayName"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                  />
                </div>
              </>
            )}

            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {error && (
              <div className="text-red-500 text-sm">{error}</div>
            )}

            <Button type="submit" className="w-full">
              {isRegister ? 'Register' : 'Sign In'}
            </Button>

            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => setIsRegister(!isRegister)}
            >
              {isRegister ? 'Already have an account? Sign in' : "Don't have an account? Register"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
```

#### 6.3 Update App.tsx

Wrap your app with the AuthProvider and add route protection:

```typescript
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LoginPage } from './pages/LoginPage';

function AppContent() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return <LoginPage />;
  }

  // Your existing app routes
  return (
    <Router>
      {/* Your existing routes */}
    </Router>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
```

## Testing Locally

1. Run the migration:
   ```bash
   python3 database/migrations/add_users_and_auth.py
   ```

2. Save the admin password that's displayed

3. Start the app:
   ```bash
   python3 app.py
   ```

4. Test login with admin credentials

5. Test creating a new user account

6. Verify data isolation - each user should only see their own meals/plans

## Railway Deployment

The migration will run automatically when you deploy to Railway. The admin password will be displayed in the Railway logs during the first deployment.

To retrieve it:
1. Go to Railway dashboard
2. Click on your deployment
3. View the logs
4. Search for "Default admin credentials"
5. Save the password immediately

## Beta Testing Workflow

1. Deploy to Railway with multi-user support
2. Create test accounts for your beta testers:
   - Share the Railway URL
   - Have them register with their own credentials
   - Each tester gets their own isolated data

2. OR create accounts for them:
   - Use the registration API endpoint
   - Send them their credentials

## Security Considerations

1. **HTTPS Only**: Railway provides HTTPS by default - use it
2. **Strong Passwords**: Enforce password requirements in the UI
3. **Session Security**: Sessions are HTTP-only cookies (secure by default)
4. **SQL Injection**: All queries use parameterized statements
5. **Password Storage**: SHA-256 with random salt (consider bcrypt for production)

## Future Enhancements

- Email verification
- Password reset functionality
- Profile management
- User roles (admin, beta tester, etc.)
- Social login (Google, GitHub)
- Two-factor authentication

## Need Help?

If you want me to implement any specific part of this plan, just ask! I can:
- Add the authentication endpoints to app.py
- Update specific routes to filter by user_id
- Create the React login components
- Test the implementation
- Debug any issues

The foundation is already built - we just need to connect the pieces!
