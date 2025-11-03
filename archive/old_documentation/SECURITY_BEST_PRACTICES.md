# Security Best Practices for Developers

This guide provides quick reference for maintaining security in this application.

## Database Operations

### ✅ DO: Use the context manager for database connections
```python
from validation import db_connection

with db_connection(db) as conn:
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM meals WHERE id = ?", (meal_id,))
    result = cursor.fetchone()
# Connection automatically closed, committed on success, rolled back on error
```

### ❌ DON'T: Manually manage connections
```python
# BAD - connection leak risk
conn = db.connect()
cursor = conn.cursor()
cursor.execute("...")
conn.close()  # Won't run if exception occurs
```

## SQL Queries

### ✅ DO: Use parameterized queries
```python
cursor.execute("SELECT * FROM meals WHERE id = ?", (meal_id,))
cursor.execute("INSERT INTO meals (name) VALUES (?)", (meal_name,))
```

### ❌ DON'T: Use string formatting
```python
# BAD - SQL injection vulnerability
cursor.execute(f"SELECT * FROM meals WHERE id = {meal_id}")
cursor.execute("SELECT * FROM meals WHERE name = '%s'" % name)
```

### ✅ DO: Whitelist allowed fields in dynamic queries
```python
ALLOWED_FIELDS = {'name', 'meal_type', 'cook_time_minutes'}

for field in data.keys():
    if field in ALLOWED_FIELDS:
        update_fields.append(f"{field} = ?")
        update_values.append(data[field])
```

## AI/LLM Operations

### ✅ DO: Sanitize user input before sending to AI
```python
from validation import sanitize_ai_input

try:
    clean_input = sanitize_ai_input(user_text, max_length=10000)
    # Now safe to send to AI
    ai_result = ai_service.process(clean_input)
except ValidationError as e:
    return error_response('Invalid input', 400)
```

### ❌ DON'T: Send raw user input to AI
```python
# BAD - prompt injection vulnerability
ai_result = ai_service.process(request.json['user_text'])
```

## File Operations

### ✅ DO: Validate file paths
```python
from pathlib import Path

allowed_base = Path(__file__).parent / "data"
file_path = Path(user_provided_path).resolve()

try:
    file_path.relative_to(allowed_base)
    # Path is safe
    with open(file_path, 'r') as f:
        content = f.read()
except ValueError:
    raise ValueError("Invalid file path")
```

### ❌ DON'T: Use user input directly in file paths
```python
# BAD - path traversal vulnerability
with open(f"data/{user_filename}", 'r') as f:
    content = f.read()
```

## HTTP Requests

### ✅ DO: Verify SSL certificates
```python
import certifi
import requests

response = requests.get(url, verify=certifi.where())
```

### ❌ DON'T: Disable SSL verification
```python
# BAD - man-in-the-middle vulnerability
response = requests.get(url, verify=False)
```

## Error Handling

### ✅ DO: Use standardized error responses
```python
from validation import error_response

try:
    # Your code
    result = process_data()
    return jsonify({'success': True, 'data': result})
except ValueError as e:
    return error_response('Invalid input', 400, {'error': str(e)})
except Exception as e:
    return error_response('Internal error', 500, {'exception': str(e)})
```

### ❌ DON'T: Expose internal details in production
```python
# BAD - exposes stack traces and internal details
except Exception as e:
    return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500
```

## API Endpoints

### ✅ DO: Add pagination to list endpoints
```python
page = request.args.get('page', 1, type=int)
per_page = min(request.args.get('per_page', 50, type=int), 100)
offset = (page - 1) * per_page

cursor.execute("SELECT * FROM meals LIMIT ? OFFSET ?", (per_page, offset))
```

### ✅ DO: Validate and limit input sizes
```python
if len(request.json.get('text', '')) > 10000:
    return error_response('Input too long', 400)
```

## Input Validation

### ✅ DO: Validate user input
```python
from validation import validate_meal_data, ValidationError

try:
    data = validate_meal_data(request.json)
    # data is now validated and sanitized
except ValidationError as e:
    return error_response('Validation failed', 400, {'errors': e.message})
```

## Performance

### ✅ DO: Use indexes for frequently queried columns
```python
# In migration:
cursor.execute("""
    CREATE INDEX IF NOT EXISTS idx_meals_meal_type
    ON meals(meal_type)
""")
```

### ✅ DO: Avoid N+1 queries
```python
# Good - fetch all at once
meal_ids = [meal['id'] for meal in meals]
placeholders = ','.join(['?'] * len(meal_ids))
cursor.execute(f"""
    SELECT meal_id, ingredient_name
    FROM meal_ingredients
    WHERE meal_id IN ({placeholders})
""", meal_ids)
```

### ❌ DON'T: Query in loops
```python
# BAD - N+1 query problem
for meal in meals:
    cursor.execute("SELECT * FROM ingredients WHERE meal_id = ?", (meal['id'],))
```

## Quick Checklist for New Endpoints

Before committing new API endpoints, verify:

- [ ] Uses `db_connection()` context manager
- [ ] All SQL queries are parameterized
- [ ] User input is validated
- [ ] Field whitelisting for dynamic queries
- [ ] File paths are validated
- [ ] AI inputs are sanitized
- [ ] Pagination added for list endpoints
- [ ] Error handling uses `error_response()`
- [ ] No sensitive data in error messages
- [ ] Length limits on text inputs
- [ ] SSL verification enabled for external requests

## Security Headers

Security headers are automatically added to all responses via `@app.after_request`. No action needed for new endpoints.

## Common Security Pitfalls

### 1. SQL Injection
**Problem**: User input in SQL queries
**Solution**: Always use parameterized queries with `?`

### 2. Path Traversal
**Problem**: User-controlled file paths
**Solution**: Use `Path.relative_to()` to validate

### 3. XSS
**Problem**: Unescaped user content in HTML
**Solution**: React auto-escapes, but be careful with `dangerouslySetInnerHTML`

### 4. CSRF
**Problem**: State-changing operations without protection
**Solution**: Already handled by CORS configuration for same-origin

### 5. Information Disclosure
**Problem**: Detailed errors in production
**Solution**: Use `error_response()` which hides details in production

### 6. Resource Exhaustion
**Problem**: Unlimited queries or large inputs
**Solution**: Add pagination and input limits

### 7. Injection Attacks (AI)
**Problem**: User input directly to LLM
**Solution**: Use `sanitize_ai_input()` before AI calls

## Testing Security Fixes

Run the security test suite:
```bash
python3 test_security_fixes.py
```

All tests should pass before deploying.

## Getting Help

If you're unsure about a security decision:
1. Check this guide first
2. Review the security fixes report (`SECURITY_FIXES_REPORT.md`)
3. Consult OWASP Top 10: https://owasp.org/www-project-top-ten/
4. Ask for a security review before merging

## Additional Resources

- OWASP Top 10: https://owasp.org/www-project-top-ten/
- Flask Security: https://flask.palletsprojects.com/en/latest/security/
- SQL Injection Prevention: https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html
- Prompt Injection: https://simonwillison.net/2023/Apr/14/worst-that-can-happen/
