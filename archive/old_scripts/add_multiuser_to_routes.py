#!/usr/bin/env python3
"""
Script to automatically add multi-user authentication to all API routes in app.py
This adds @login_required decorators and user_id filtering to database queries
"""

import re
import sys

def add_auth_to_routes(app_py_content):
    """Add authentication to all API routes"""

    # Routes that need user_id filtering (data belongs to users)
    user_data_routes = [
        '/api/meals',
        '/api/shopping',
        '/api/school-menu',
        '/api/bento',
        '/api/plan',
        '/api/meal-plans',
        '/api/leftovers',
        '/api/lunch-alternatives'
    ]

    # Routes that don't need auth (public endpoints)
    public_routes = [
        '/api/health',
        '/api/auth/',  # Auth endpoints themselves
        '/api/migrate'  # Migration endpoint
    ]

    lines = app_py_content.split('\n')
    output_lines = []
    i = 0

    while i < len(lines):
        line = lines[i]

        # Check if this is a route definition
        if line.strip().startswith('@app.route('):
            # Extract the route path
            route_match = re.search(r"@app\.route\('([^']+)'", line)
            if route_match:
                route_path = route_match.group(1)

                # Check if this route needs authentication
                needs_auth = any(route_path.startswith(data_route) for data_route in user_data_routes)
                is_public = any(pub in route_path for pub in public_routes)

                if needs_auth and not is_public:
                    # Add the route line
                    output_lines.append(line)
                    i += 1

                    # Check if @login_required is already present on the next line
                    if i < len(lines) and '@login_required' not in lines[i]:
                        # Add @login_required decorator before the function
                        indent = len(line) - len(line.lstrip())
                        output_lines.append(' ' * indent + '@login_required')

                    continue

        output_lines.append(line)
        i += 1

    return '\n'.join(output_lines)


def add_user_id_to_queries(content):
    """
    Add user_id filtering to SELECT queries and user_id insertion to INSERT queries
    This is a simplified version - you may need to review and adjust manually
    """

    # This is complex and error-prone to do automatically
    # Instead, we'll print guidance for manual updates
    print("\n" + "="*70)
    print("IMPORTANT: Manual Query Updates Needed")
    print("="*70)
    print("""
After this script runs, you need to manually update database queries to:

1. GET queries - Add user_id filter:
   BEFORE: SELECT * FROM meals
   AFTER:  SELECT * FROM meals WHERE user_id = ?

2. INSERT queries - Add user_id:
   BEFORE: INSERT INTO meals (name, ...) VALUES (?, ...)
   AFTER:  INSERT INTO meals (name, ..., user_id) VALUES (?, ..., ?)

3. UPDATE/DELETE queries - Add user_id filter for security:
   BEFORE: UPDATE meals SET ... WHERE id = ?
   AFTER:  UPDATE meals SET ... WHERE id = ? AND user_id = ?

4. Add at the start of each authenticated route function:
   user_id = get_current_user_id()

Search for these patterns in app.py after running this script.
""")

    return content


if __name__ == '__main__':
    print("Adding multi-user authentication to app.py routes...")

    try:
        with open('app.py', 'r') as f:
            content = f.read()

        # Add @login_required decorators
        content = add_auth_to_routes(content)

        # Write back
        with open('app.py', 'w') as f:
            f.write(content)

        print("✅ Added @login_required decorators to routes")

        # Print guidance for query updates
        add_user_id_to_queries(content)

        print("\n✅ Script complete!")
        print("\nNext steps:")
        print("1. Review the changes in app.py")
        print("2. Manually update database queries as described above")
        print("3. Test with: python3 app.py")

    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)
