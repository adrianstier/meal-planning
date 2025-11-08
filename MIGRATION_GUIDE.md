# Database Migration Safety Guide

## Overview
This guide ensures database migrations preserve user data during deployments.

## Safe Migration Pattern

### Step 1: Add Column (Nullable or with Default)
```python
# SAFE - Allows existing rows to keep their data
cursor.execute("""
    ALTER TABLE my_table
    ADD COLUMN new_field INTEGER DEFAULT 1
""")
```

### Step 2: Populate Existing Data
```python
# Backfill data for existing rows
cursor.execute("""
    UPDATE my_table
    SET new_field = (SELECT appropriate_value FROM related_table WHERE ...)
""")
```

### Step 3: Add Constraints (Optional)
```python
# Only after data is populated
cursor.execute("""
    CREATE TABLE my_table_new (
        -- Include NOT NULL constraints here
    )
""")
cursor.execute("INSERT INTO my_table_new SELECT * FROM my_table")
cursor.execute("DROP TABLE my_table")
cursor.execute("ALTER TABLE my_table_new RENAME TO my_table")
```

## Migration Checklist

Before deploying any database migration:

- [ ] Migration is idempotent (checks if already applied)
- [ ] New columns use DEFAULT or allow NULL initially
- [ ] Existing data is backfilled before adding NOT NULL
- [ ] Migration has error handling with rollback
- [ ] Migration tested locally with production-like data
- [ ] No DROP TABLE commands without data preservation
- [ ] All foreign keys and indexes recreated correctly

## Testing Migrations Locally

### 1. Copy Production Database Schema
```bash
# Create test database with similar data
python3 setup.py
# Add some test users and data
python3 test_multiuser_edge_cases.py
```

### 2. Run Migration
```bash
# Test the migration
python3 database/migrations/your_migration.py meal_planner.db
```

### 3. Verify Data Integrity
```bash
sqlite3 meal_planner.db
> SELECT COUNT(*) FROM my_table;  -- Should match pre-migration count
> SELECT * FROM my_table LIMIT 5;  -- Verify data looks correct
```

## Common Unsafe Patterns to Avoid

### ❌ DANGEROUS: Dropping columns without backup
```python
# This permanently deletes data!
ALTER TABLE my_table DROP COLUMN old_field
```

### ❌ DANGEROUS: Adding NOT NULL without defaults
```python
# This will fail if table has existing rows!
ALTER TABLE my_table ADD COLUMN new_field INTEGER NOT NULL
```

### ❌ DANGEROUS: Non-idempotent migrations
```python
# Running twice will fail or create duplicates
ALTER TABLE my_table ADD COLUMN new_field INTEGER
```

## Deployment Process

### Railway Deployment
Migrations run in `railway-build.sh`:
```bash
python3 database/migrations/add_multi_user_support.py "$DB_PATH"
```

### Render Deployment
Migrations run in `setup.py`:
```python
from database.migrations.add_multi_user_support import run_migration
run_migration(db.db_path)
```

## Backup Strategy (Recommended for Production)

### Before Major Migrations
```bash
# On server, backup database before deployment
cp meal_planner.db meal_planner.db.backup.$(date +%Y%m%d_%H%M%S)
```

### Automated Backups
Consider implementing:
1. Daily automated backups to separate storage
2. Point-in-time recovery capability
3. Backup retention policy (keep last 30 days)

## Emergency Rollback

If migration fails in production:

1. Check server logs for error messages
2. Restore from most recent backup
3. Fix migration script locally
4. Test thoroughly before redeploying

## Examples from This Project

All migrations in `database/migrations/` follow these patterns:

- `add_multi_user_support.py` - Adds user_id safely with DEFAULT
- `add_user_id_to_leftovers_inventory.py` - Backfills from related table
- `add_bento_tables.py` - Creates new tables (safe, no data loss)
- `add_recipe_metadata.py` - Adds columns with defaults

Review these for reference when creating new migrations.
