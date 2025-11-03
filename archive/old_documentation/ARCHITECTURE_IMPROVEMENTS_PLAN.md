# ARCHITECTURE & INFRASTRUCTURE IMPROVEMENTS PLAN
**Meal Planning Application - Post-Security Review Enhancements**
**Date**: November 2, 2025

---

## OVERVIEW

This document outlines architectural improvements to implement after security fixes are complete. These changes will improve reliability, scalability, developer experience, and maintainability.

---

## PRIORITY 1: CRITICAL INFRASTRUCTURE (Week 1-2)

### 1. Authentication & Authorization ⭐⭐⭐
**Status**: Not implemented
**Effort**: 3-4 days
**Dependencies**: None

#### Implementation Plan:
```python
# Install dependencies
pip install flask-jwt-extended pyjwt

# Create auth/models.py
class User:
    id: int
    email: str
    name: str
    created_at: datetime

# Create auth/service.py
def register_user(email, password) -> User
def login(email, password) -> str  # Returns JWT
def verify_token(token) -> User

# Add to app.py
from flask_jwt_extended import JWTManager, jwt_required, get_jwt_identity

app.config['JWT_SECRET_KEY'] = os.getenv('JWT_SECRET_KEY')
jwt = JWTManager(app)

@app.route('/api/meals', methods=['POST'])
@jwt_required()
def create_meal():
    user_id = get_jwt_identity()
    # Filter by user_id
```

#### Database Changes:
```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE meals ADD COLUMN user_id INTEGER REFERENCES users(id);
ALTER TABLE meal_plans ADD COLUMN user_id INTEGER REFERENCES users(id);
-- Add indexes
CREATE INDEX idx_meals_user_id ON meals(user_id);
CREATE INDEX idx_meal_plans_user_id ON meal_plans(user_id);
```

**Testing**: Create `tests/test_auth.py` with registration, login, token expiry tests

---

### 2. Rate Limiting ⭐⭐⭐
**Status**: Not implemented
**Effort**: 1 day
**Dependencies**: None

#### Implementation:
```python
# Install
pip install Flask-Limiter

# Add to app.py
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

limiter = Limiter(
    app=app,
    key_func=get_remote_address,
    default_limits=["200 per day", "50 per hour"],
    storage_uri="memory://"  # Use Redis in production
)

# Apply to expensive endpoints
@app.route('/api/meals/parse', methods=['POST'])
@limiter.limit("10 per hour")
def parse_recipe():
    pass

@app.route('/api/school-menu/parse-photo', methods=['POST'])
@limiter.limit("5 per hour")
def parse_menu():
    pass
```

**Configuration**:
```python
# config.py
RATE_LIMIT_STORAGE_URL = os.getenv(
    'REDIS_URL',
    'memory://'  # Fallback for dev
)
```

---

### 3. Health Check Endpoint ⭐⭐
**Status**: Exists but needs improvement
**Effort**: 2 hours
**Dependencies**: None

#### Enhanced Health Check:
```python
@app.route('/api/health', methods=['GET'])
def health():
    """Comprehensive health check for load balancers"""
    checks = {
        'status': 'ok',
        'timestamp': datetime.now().isoformat(),
        'version': os.getenv('APP_VERSION', 'dev')
    }

    # Check database
    try:
        with db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM meals")
            checks['database'] = {
                'status': 'ok',
                'meal_count': cursor.fetchone()[0]
            }
    except Exception as e:
        checks['database'] = {'status': 'error', 'message': str(e)}
        checks['status'] = 'degraded'

    # Check AI service
    checks['ai'] = {
        'enabled': recipe_parser is not None,
        'model': 'claude-3-5-sonnet-20241022' if recipe_parser else None
    }

    # Check vision service
    checks['vision'] = {
        'enabled': vision_parser is not None
    }

    # Determine HTTP status
    status_code = 200 if checks['status'] == 'ok' else 503
    return jsonify(checks), status_code

# Add liveness check (always returns 200)
@app.route('/api/health/live', methods=['GET'])
def liveness():
    return jsonify({'status': 'alive'}), 200
```

---

### 4. CI/CD Pipeline ⭐⭐⭐
**Status**: Not implemented
**Effort**: 1 day
**Dependencies**: None

#### GitHub Actions Workflow:
```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  backend:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        python-version: ['3.10', '3.11']

    steps:
      - uses: actions/checkout@v3

      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: ${{ matrix.python-version }}

      - name: Install dependencies
        run: |
          python -m pip install --upgrade pip
          pip install -r requirements.txt
          pip install pytest pytest-cov ruff mypy

      - name: Lint with ruff
        run: ruff check .

      - name: Type check with mypy
        run: mypy app.py meal_planner.py --ignore-missing-imports

      - name: Run tests
        run: |
          pytest tests/ --cov=. --cov-report=xml --maxfail=1

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          file: ./coverage.xml

  frontend:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [18, 20]

    steps:
      - uses: actions/checkout@v3

      - name: Set up Node.js
        uses: actions/setup-node@v3
        with:
          node-version: ${{ matrix.node-version }}

      - name: Install dependencies
        working-directory: ./client
        run: npm ci

      - name: Lint
        working-directory: ./client
        run: npm run lint

      - name: Type check
        working-directory: ./client
        run: npx tsc --noEmit

      - name: Build
        working-directory: ./client
        run: npm run build

      - name: Run tests
        working-directory: ./client
        run: npm test -- --coverage --watchAll=false
```

---

## PRIORITY 2: OBSERVABILITY & LOGGING (Week 2-3)

### 5. Structured Logging ⭐⭐
**Status**: Basic print statements
**Effort**: 2 days
**Dependencies**: None

#### Implementation:
```python
# Install
pip install python-json-logger

# Create logging_config.py
import logging
import sys
from pythonjsonlogger import jsonlogger

def setup_logging():
    logger = logging.getLogger()
    handler = logging.StreamHandler(sys.stdout)

    formatter = jsonlogger.JsonFormatter(
        '%(timestamp)s %(level)s %(name)s %(message)s',
        rename_fields={'levelname': 'level', 'asctime': 'timestamp'}
    )
    handler.setFormatter(formatter)
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)

    return logger

# In app.py
logger = setup_logging()

@app.before_request
def log_request():
    g.request_id = str(uuid.uuid4())
    logger.info('request_started', extra={
        'request_id': g.request_id,
        'method': request.method,
        'path': request.path,
        'ip': request.remote_addr
    })

@app.after_request
def log_response(response):
    logger.info('request_completed', extra={
        'request_id': g.request_id,
        'status_code': response.status_code,
        'duration_ms': (time.time() - g.start_time) * 1000
    })
    response.headers['X-Request-ID'] = g.request_id
    return response
```

---

### 6. Error Tracking (Sentry) ⭐⭐
**Status**: Not implemented
**Effort**: 2 hours
**Dependencies**: None

```python
# Install
pip install sentry-sdk[flask]

# In app.py
import sentry_sdk
from sentry_sdk.integrations.flask import FlaskIntegration

sentry_sdk.init(
    dsn=os.getenv("SENTRY_DSN"),
    integrations=[FlaskIntegration()],
    environment=os.getenv("ENVIRONMENT", "development"),
    traces_sample_rate=0.1,  # 10% of transactions
    profiles_sample_rate=0.1
)

# Frontend: client/src/index.tsx
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: process.env.REACT_APP_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  integrations: [new Sentry.BrowserTracing()],
  tracesSampleRate: 0.1,
});
```

---

## PRIORITY 3: DATABASE IMPROVEMENTS (Week 3-4)

### 7. Migrate to SQLAlchemy + Alembic ⭐⭐⭐
**Status**: Currently raw SQL
**Effort**: 4-5 days
**Dependencies**: Major refactor

#### Benefits:
- Formalized migrations with rollback
- Type-safe queries
- Relationship management
- Better query optimization

#### Implementation Sketch:
```python
# Install
pip install sqlalchemy alembic

# Create models.py
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship, declarative_base
from datetime import datetime

Base = declarative_base()

class User(Base):
    __tablename__ = 'users'
    id = Column(Integer, primary_key=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    name = Column(String(255))
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    meals = relationship('Meal', back_populates='user')
    meal_plans = relationship('MealPlan', back_populates='user')

class Meal(Base):
    __tablename__ = 'meals'
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False, index=True)
    name = Column(String(255), nullable=False, index=True)
    meal_type = Column(String(50), nullable=False, index=True)
    cook_time_minutes = Column(Integer)
    difficulty = Column(String(50))
    cuisine = Column(String(100), index=True)
    tags = Column(Text)
    ingredients = Column(Text)
    instructions = Column(Text)
    image_url = Column(Text)
    is_favorite = Column(Integer, default=0)
    kid_friendly_level = Column(Integer)
    last_cooked = Column(DateTime, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    user = relationship('User', back_populates='meals')
    scheduled_meals = relationship('ScheduledMeal', back_populates='meal')

# Initialize Alembic
alembic init alembic

# Create migration
alembic revision --autogenerate -m "Initial schema"
alembic upgrade head
```

**Migration Strategy**:
1. Create parallel SQLAlchemy models
2. Write migration to match current schema
3. Gradually refactor endpoints to use SQLAlchemy
4. Remove old meal_planner.py once complete

---

### 8. Add Full-Text Search ⭐
**Status**: Not implemented
**Effort**: 1 day
**Dependencies**: None

```sql
-- Create FTS5 virtual table
CREATE VIRTUAL TABLE meals_fts USING fts5(
    name,
    tags,
    ingredients,
    content=meals,
    content_rowid=id
);

-- Populate
INSERT INTO meals_fts(rowid, name, tags, ingredients)
SELECT id, name, tags, ingredients FROM meals;

-- Create triggers to keep in sync
CREATE TRIGGER meals_ai AFTER INSERT ON meals BEGIN
    INSERT INTO meals_fts(rowid, name, tags, ingredients)
    VALUES (new.id, new.name, new.tags, new.ingredients);
END;

CREATE TRIGGER meals_au AFTER UPDATE ON meals BEGIN
    UPDATE meals_fts
    SET name = new.name, tags = new.tags, ingredients = new.ingredients
    WHERE rowid = new.id;
END;

CREATE TRIGGER meals_ad AFTER DELETE ON meals BEGIN
    DELETE FROM meals_fts WHERE rowid = old.id;
END;
```

```python
# Add search endpoint
@app.route('/api/meals/search', methods=['GET'])
def search_meals():
    query = request.args.get('q', '')
    if not query:
        return error_response('Query parameter required', 400)

    with db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT m.* FROM meals m
            JOIN meals_fts fts ON m.id = fts.rowid
            WHERE meals_fts MATCH ?
            ORDER BY rank
            LIMIT 50
        """, (query,))
        results = [dict(row) for row in cursor.fetchall()]

    return jsonify({'success': True, 'data': results})
```

---

## PRIORITY 4: API & DOCUMENTATION (Week 4)

### 9. OpenAPI/Swagger Documentation ⭐⭐
**Status**: Not implemented
**Effort**: 2 days
**Dependencies**: None

```python
# Install
pip install flasgger

# In app.py
from flasgger import Swagger

app.config['SWAGGER'] = {
    'title': 'Meal Planning API',
    'version': '1.0.0',
    'description': 'Family meal planning with AI-powered recipe parsing',
    'termsOfService': '',
    'contact': {
        'name': 'API Support',
        'email': 'support@example.com'
    }
}
swagger = Swagger(app)

# Add to each endpoint
@app.route('/api/meals', methods=['POST'])
@jwt_required()
def create_meal():
    """
    Create a new meal
    ---
    tags:
      - meals
    security:
      - Bearer: []
    parameters:
      - in: body
        name: meal
        required: true
        schema:
          type: object
          required:
            - name
            - meal_type
          properties:
            name:
              type: string
              example: "Spaghetti Carbonara"
            meal_type:
              type: string
              enum: [breakfast, lunch, dinner, snack]
            cook_time_minutes:
              type: integer
              minimum: 0
              maximum: 600
            difficulty:
              type: string
              enum: [easy, medium, hard]
            cuisine:
              type: string
              example: "Italian"
            tags:
              type: string
              example: "pasta,quick,kid-friendly"
            ingredients:
              type: string
            instructions:
              type: string
            image_url:
              type: string
    responses:
      201:
        description: Meal created successfully
        schema:
          type: object
          properties:
            success:
              type: boolean
            data:
              type: object
              properties:
                id:
                  type: integer
                name:
                  type: string
      400:
        description: Validation error
      401:
        description: Unauthorized
    """
    # existing code...
```

**Access**: Swagger UI available at `/apidocs`

---

### 10. Frontend Type Generation ⭐
**Status**: Manual type maintenance
**Effort**: 1 day
**Dependencies**: OpenAPI spec

```bash
# Install
npm install --save-dev openapi-typescript

# Add to package.json scripts
{
  "scripts": {
    "generate-types": "openapi-typescript http://localhost:5000/apispec_1.json -o src/types/api-generated.ts"
  }
}

# Run after backend changes
npm run generate-types
```

---

## PRIORITY 5: DEVELOPER EXPERIENCE (Week 5)

### 11. Pre-commit Hooks ⭐⭐
**Status**: Not implemented
**Effort**: 2 hours
**Dependencies**: None

```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v4.5.0
    hooks:
      - id: trailing-whitespace
      - id: end-of-file-fixer
      - id: check-yaml
      - id: check-added-large-files
      - id: check-json

  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.1.6
    hooks:
      - id: ruff
        args: [--fix, --exit-non-zero-on-fix]

  - repo: https://github.com/psf/black
    rev: 23.11.0
    hooks:
      - id: black

  - repo: https://github.com/pre-commit/mirrors-mypy
    rev: v1.7.0
    hooks:
      - id: mypy
        additional_dependencies: [types-all]
```

```bash
# Install
pip install pre-commit
pre-commit install

# Run manually
pre-commit run --all-files
```

---

### 12. One-Command Dev Setup ⭐
**Status**: Manual multi-step
**Effort**: 1 day
**Dependencies**: None

```makefile
# Makefile
.PHONY: install dev test lint clean

install:
	@echo "📦 Installing backend dependencies..."
	pip install -r requirements.txt
	@echo "📦 Installing frontend dependencies..."
	cd client && npm install
	@echo "🗄️  Setting up database..."
	python setup.py
	@echo "✅ Installation complete!"

dev:
	@echo "🚀 Starting development servers..."
	@trap 'kill 0' EXIT; \
	python app.py & \
	cd client && npm start

test:
	@echo "🧪 Running backend tests..."
	pytest tests/ --cov=. --cov-report=html
	@echo "🧪 Running frontend tests..."
	cd client && npm test -- --coverage --watchAll=false

lint:
	@echo "🔍 Linting backend..."
	ruff check .
	black --check .
	mypy app.py meal_planner.py
	@echo "🔍 Linting frontend..."
	cd client && npm run lint && npx tsc --noEmit

clean:
	@echo "🧹 Cleaning..."
	find . -type d -name __pycache__ -exec rm -rf {} +
	find . -type f -name "*.pyc" -delete
	rm -rf .pytest_cache .coverage htmlcov
	rm -rf client/node_modules client/build

.DEFAULT_GOAL := dev
```

Usage:
```bash
make install  # First time setup
make dev      # Start dev servers
make test     # Run all tests
make lint     # Run all linters
```

---

## PRIORITY 6: REACT IMPROVEMENTS (Week 5-6)

### 13. Error Boundaries ⭐⭐
**Status**: Not implemented
**Effort**: 2 hours
**Dependencies**: None

```tsx
// client/src/components/ErrorBoundary.tsx
import React, { Component, ErrorInfo, ReactNode } from 'react';
import * as Sentry from '@sentry/react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
    Sentry.captureException(error, { contexts: { react: { componentStack: errorInfo.componentStack } } });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: undefined });
  };

  public render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
          <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Something went wrong
            </h2>
            <p className="text-gray-600 mb-4">
              We're sorry, but something unexpected happened.
            </p>
            {this.state.error && (
              <pre className="bg-gray-100 p-4 rounded text-sm text-gray-700 mb-4 overflow-auto">
                {this.state.error.message}
              </pre>
            )}
            <button
              onClick={this.handleReset}
              className="w-full bg-primary text-white py-2 px-4 rounded hover:bg-primary-dark transition"
            >
              Try again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Wrap App in client/src/index.tsx
import { ErrorBoundary } from './components/ErrorBoundary';

root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
```

---

### 14. Code Splitting & Performance ⭐
**Status**: Single bundle
**Effort**: 1 day
**Dependencies**: None

```tsx
// client/src/App.tsx
import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';

// Code split by route
const PlanPage = lazy(() => import('./pages/PlanPage'));
const RecipesPage = lazy(() => import('./pages/RecipesPage'));
const BentoPage = lazy(() => import('./pages/BentoPage'));
const LeftoversPage = lazy(() => import('./pages/LeftoversPage'));
const SchoolMenuPage = lazy(() => import('./pages/SchoolMenuPage'));
const ListsPage = lazy(() => import('./pages/ListsPage'));

// Loading component
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
  </div>
);

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <Layout>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Navigate to="/plan" replace />} />
              <Route path="/plan" element={<PlanPage />} />
              <Route path="/recipes" element={<RecipesPage />} />
              <Route path="/bento" element={<BentoPage />} />
              <Route path="/leftovers" element={<LeftoversPage />} />
              <Route path="/school-menu" element={<SchoolMenuPage />} />
              <Route path="/lists" element={<ListsPage />} />
            </Routes>
          </Suspense>
        </Layout>
      </Router>
    </QueryClientProvider>
  );
}
```

---

## TIMELINE SUMMARY

| Priority | Task | Effort | Status |
|----------|------|--------|--------|
| P1 | Authentication | 3-4 days | ⏳ Planned |
| P1 | Rate Limiting | 1 day | ⏳ Planned |
| P1 | Health Check | 2 hours | ⏳ Planned |
| P1 | CI/CD Pipeline | 1 day | ⏳ Planned |
| P2 | Structured Logging | 2 days | ⏳ Planned |
| P2 | Error Tracking | 2 hours | ⏳ Planned |
| P3 | SQLAlchemy Migration | 4-5 days | ⏳ Planned |
| P3 | Full-Text Search | 1 day | ⏳ Planned |
| P4 | OpenAPI Docs | 2 days | ⏳ Planned |
| P4 | Type Generation | 1 day | ⏳ Planned |
| P5 | Pre-commit Hooks | 2 hours | ⏳ Planned |
| P5 | Dev Setup | 1 day | ⏳ Planned |
| P6 | Error Boundaries | 2 hours | ⏳ Planned |
| P6 | Code Splitting | 1 day | ⏳ Planned |

**Total Estimated Effort**: 4-5 weeks

---

## IMPLEMENTATION STRATEGY

### Phase 1 (Weeks 1-2): Foundation
- Implement authentication
- Add rate limiting
- Set up CI/CD
- Improve health checks

### Phase 2 (Weeks 2-3): Observability
- Add structured logging
- Integrate Sentry
- Improve error handling

### Phase 3 (Weeks 3-4): Database
- Plan SQLAlchemy migration
- Add full-text search
- Optimize queries

### Phase 4 (Weeks 4-5): Developer Experience
- Add OpenAPI documentation
- Set up pre-commit hooks
- One-command dev setup
- Type generation

### Phase 5 (Week 6): Polish
- React error boundaries
- Code splitting
- Performance optimization
- End-to-end testing

---

## SUCCESS METRICS

- **Security**: 100% of endpoints authenticated and rate-limited
- **Reliability**: 99.9% uptime, < 500ms p95 response time
- **Developer Experience**: < 5 minutes from clone to running locally
- **Documentation**: 100% of endpoints documented in OpenAPI
- **Test Coverage**: > 80% backend, > 70% frontend
- **Performance**: < 2s initial load, < 200ms route transitions

---

## NOTES

- All security fixes from SECURITY_CODE_REVIEW_REPORT.md should be completed before starting this plan
- Consider whether SQLite is sufficient for production or if Postgres is needed
- Monitor Anthropic API usage and costs closely after adding rate limiting
- Keep the family-focused, simple UX while adding these enterprise features

---

**Status**: Ready to implement after security fixes complete
**Last Updated**: November 2, 2025
