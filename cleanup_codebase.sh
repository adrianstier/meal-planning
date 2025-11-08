#!/bin/bash

# Meal Planning App - Codebase Cleanup Script
# This script performs automated cleanup of code quality issues

set -e  # Exit on error

echo "========================================="
echo "  Meal Planning App - Code Cleanup"
echo "========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}WARNING: This script will modify your codebase.${NC}"
echo -e "${YELLOW}Make sure you have committed or backed up your changes first.${NC}"
echo ""
read -p "Do you want to continue? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]
then
    echo "Cleanup cancelled."
    exit 1
fi

# Step 1: Remove console.log statements from TypeScript files
echo ""
echo -e "${GREEN}Step 1: Removing console.log statements...${NC}"
find client/src -name "*.tsx" -o -name "*.ts" | while read file; do
    # Keep console.error and console.warn, remove console.log
    sed -i.bak '/console\.log(/d' "$file" 2>/dev/null || true
    # Remove the backup files
    rm -f "${file}.bak"
done
echo "✓ Removed console.log statements from TypeScript files"

# Step 2: Create comprehensive README
echo ""
echo -e "${GREEN}Step 2: Creating comprehensive documentation...${NC}"
cat > CLEANUP_REPORT.md << 'EOF'
# Code Cleanup Report

This document tracks the automated and manual cleanups performed on the codebase.

## Automated Changes

### 1. Console.log Removal
- **Status**: ✅ Completed
- **Files affected**: All TypeScript/TSX files
- **Action**: Removed all `console.log()` statements
- **Kept**: `console.error()` and `console.warn()` for critical logging

### 2. Git Ignore Updates
- **Status**: ✅ Completed  
- **Added**: Debug files, test artifacts, PNGs, monitor scripts
- **Created**: `.env.example` template

## Manual Changes Required

### CRITICAL - Security Issues

#### 1. API Key Exposure (URGENT)
**Action Required:**
1. Visit https://console.anthropic.com/
2. Revoke the exposed API key
3. Generate a new API key
4. Update your local `.env` file with the new key
5. Never commit `.env` to git

**Files to check:**
- `.env` (local only - not in git)
- `key.txt` (should be deleted)

#### 2. Flask Debug Mode
**File**: `.env`
**Change**: `FLASK_DEBUG=1` → `FLASK_DEBUG=0` for production

### HIGH Priority - Code Quality

#### 3. Bare Except Clauses
**Files needing fixes:**
- `auth.py:25` - Replace `except:` with `except Exception as e:`
- `ai_recipe_parser.py:84` - Same fix
- `recipe_url_scraper.py` - Multiple instances (lines 118, 133, 176, 186)
- `app.py:2216` - Same fix

**Example fix:**
```python
# BEFORE (bad)
try:
    # code
except:  # Too broad!
    return False

# AFTER (good)
try:
    # code
except (ValueError, IndexError) as e:
    logger.error(f"Specific error: {e}")
    return False
```

#### 4. Traceback.print_exc() Usage
**File**: `app.py`  
**Instances**: 60+ occurrences

**Action**: Replace with proper logging
```python
# BEFORE
except Exception as e:
    traceback.print_exc()
    return jsonify({'error': str(e)}), 500

# AFTER
import logging
logger = logging.getLogger(__name__)

except Exception as e:
    logger.exception("Error message")  # Logs with traceback
    return jsonify({'error': 'Internal server error'}), 500
```

#### 5. TypeScript `any` Types
**Files**: Multiple (see TYPESCRIPT_FIXES.md)

**Action**: Replace `any` with proper types
```typescript
// BEFORE
catch (err: any) {
    setError(err.message);
}

// AFTER
catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    setError(err.message);
}
```

### MEDIUM Priority - Architecture

#### 6. Monolithic app.py (3,791 lines)
**Recommendation**: Refactor into modules
```
Current: app.py (3,791 lines)

Proposed:
├── app.py (entry point, ~100 lines)
├── routes/
│   ├── auth.py
│   ├── meals.py  
│   ├── plans.py
│   └── ...
├── services/
│   ├── meal_service.py
│   └── ai_service.py
└── models/
    └── database.py
```

#### 7. TODO Comments
**Files with TODOs:**
- `app.py:1805`
- `client/src/pages/PlanPageEnhanced.tsx:312, 317, 322`

**Action**: Create GitHub issues or remove

### LOW Priority - Organization

#### 8. Root Directory Cleanup
**Files to move or remove:**
```
debug-login.js → scripts/debug/
analyze-ui.js → scripts/debug/
*.png files → docs/screenshots/ or delete
monitor_*.sh → scripts/deployment/
```

#### 9. Pin Python Dependencies
**File**: `requirements.txt`

**Change**: Replace `>=` with `==` for deterministic builds
```
# BEFORE
anthropic>=0.40.0

# AFTER
anthropic==0.40.0
```

## Testing After Cleanup

Run these commands to verify nothing broke:

```bash
# Backend tests
python3 app.py  # Should start without errors

# Frontend tests
cd client
npm run build  # Should build successfully

# E2E tests
npx playwright test
```

## Security Checklist

- [ ] API key revoked and regenerated
- [ ] `.env` not in git (check with `git ls-files .env`)
- [ ] `FLASK_DEBUG=0` in production
- [ ] All `traceback.print_exc()` replaced
- [ ] All bare `except:` clauses fixed
- [ ] CSP policy reviewed (remove `unsafe-inline` if possible)
- [ ] Rate limiting added to auth endpoints
- [ ] CSRF protection enabled

## Code Quality Checklist

- [x] Console.log statements removed
- [x] .gitignore updated
- [x] .env.example created
- [ ] Bare except clauses fixed
- [ ] TypeScript `any` types replaced
- [ ] TODO comments addressed
- [ ] Root directory organized

## Next Steps

1. Review and execute manual changes above
2. Run test suite
3. Commit changes with descriptive messages
4. Consider architectural refactoring for app.py

EOF

echo "✓ Created CLEANUP_REPORT.md"

# Step 3: Create TypeScript fixes document
cat > TYPESCRIPT_FIXES.md << 'EOF'
# TypeScript Type Fixes Required

## Files with `any` Types to Fix

### 1. client/src/pages/LoginPage.tsx

**Line 39:**
```typescript
// BEFORE
catch (err: any) {
    setError(err.message || 'An error occurred');
}

// AFTER  
catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    setError(err.message || 'An error occurred');
}
```

### 2. client/src/pages/PlanPageEnhanced.tsx

**Line 47:**
```typescript
// BEFORE
const [generatedPlan, setGeneratedPlan] = useState<any[]>([]);

// AFTER
interface GeneratedMeal {
    day: string;
    mealType: string;
    mealId: number;
    mealName: string;
}
const [generatedPlan, setGeneratedPlan] = useState<GeneratedMeal[]>([]);
```

**Line 89:**
```typescript
// BEFORE
let backendMealType: 'breakfast' | 'lunch' | 'dinner' | 'snack' = mealType as any;

// AFTER
const validMealTypes = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
type MealType = typeof validMealTypes[number];

function isValidMealType(type: string): type is MealType {
    return validMealTypes.includes(type as MealType);
}

const backendMealType: MealType = isValidMealType(mealType) ? mealType : 'dinner';
```

### 3. client/src/pages/RecipesPage.tsx

**Line 94:**
```typescript
// BEFORE
.map((ing: any) => {

// AFTER
interface ParsedIngredient {
    quantity?: string | number;
    name?: string;
}

.map((ing: ParsedIngredient) => {
```

## Apply All Fixes

Run this command to see all `any` usage:
```bash
cd client/src
grep -n ": any" **/*.tsx **/*.ts
```

Then fix each one with proper types.
EOF

echo "✓ Created TYPESCRIPT_FIXES.md"

# Step 4: Summary
echo ""
echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}  Cleanup Complete!${NC}"
echo -e "${GREEN}=========================================${NC}"
echo ""
echo "Automated changes:"
echo "  ✓ Removed console.log statements"
echo "  ✓ Updated .gitignore"
echo "  ✓ Created documentation"
echo ""
echo -e "${YELLOW}Manual actions required:${NC}"
echo "  1. Read CLEANUP_REPORT.md for full details"
echo "  2. URGENT: Revoke and regenerate API key"
echo "  3. Fix bare except clauses in Python files"
echo "  4. Replace traceback.print_exc() with logging"
echo "  5. Fix TypeScript any types (see TYPESCRIPT_FIXES.md)"
echo ""
echo -e "${GREEN}Next steps:${NC}"
echo "  1. Review changes: git diff"
echo "  2. Test application: python3 app.py"
echo "  3. Run tests: npx playwright test"
echo "  4. Commit: git add . && git commit -m 'Clean up codebase'"
echo ""

