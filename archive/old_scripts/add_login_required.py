#!/usr/bin/env python3
"""
Script to add @login_required decorators to unprotected API endpoints
"""

# List of endpoints to protect (line numbers and route paths)
# Excluding health/system endpoints that should remain public
ENDPOINTS_TO_PROTECT = [
    # Meal-related
    756,   # /api/meals/weekly-plan
    # Shopping List
    767,   # /api/shopping-list
    782,   # /api/shopping (GET)
    801,   # /api/shopping (POST)
    833,   # /api/shopping/<int:item_id> (PUT)
    866,   # /api/shopping/<int:item_id> (DELETE)
    881,   # /api/shopping/<int:item_id>/toggle
    905,   # /api/shopping/purchased
    920,   # /api/shopping/generate
    # Meal Plan
    1091,  # /api/plan/week
    1144,  # /api/plan (POST)
    1232,  # /api/plan/<int:plan_id> (PUT)
    1308,  # /api/plan/<int:plan_id> (DELETE)
    1324,  # /api/plan/suggest
    1395,  # /api/plan/generate-week
    1548,  # /api/plan/apply-generated
    # Favorites & History
    1667,  # /api/favorites
    1682,  # /api/recently-cooked
    1699,  # /api/havent-made
    1718,  # /api/history
    # Leftovers
    1740,  # /api/leftovers (GET)
    1777,  # /api/leftovers (POST)
    1844,  # /api/leftovers/<int:leftover_id>/consume
    1859,  # /api/leftovers/<int:leftover_id>/servings
    1883,  # /api/leftovers/suggestions
    1921,  # /api/meals/<int:meal_id>/leftover-settings
    # School Menu
    1945,  # /api/school-menu (GET)
    1972,  # /api/school-menu/date/<date>
    1988,  # /api/school-menu (POST)
    2043,  # /api/school-menu/<int:menu_id> (DELETE)
    2057,  # /api/school-menu/feedback
    2084,  # /api/school-menu/lunch-alternatives/<date>
    2098,  # /api/school-menu/cleanup
    2115,  # /api/school-menu/parse-photo
    2169,  # /api/school-menu/calendar
    # Bento Items
    2243,  # /api/bento-items (GET)
    2276,  # /api/bento-items (POST)
    2322,  # /api/bento-items/<int:item_id> (PUT)
    2354,  # /api/bento-items/<int:item_id> (DELETE)
    # Bento Plans
    2372,  # /api/bento-plans (GET)
    2424,  # /api/bento-plans (POST)
    2457,  # /api/bento-plans/<int:plan_id> (PUT)
    2490,  # /api/bento-plans/<int:plan_id> (DELETE)
    2508,  # /api/bento-plans/generate-week
]

def add_login_required_decorators():
    """Add @login_required decorator to specified endpoints"""

    with open('app.py', 'r') as f:
        lines = f.readlines()

    # Track how many we actually added
    added_count = 0

    # Process in reverse order so line numbers don't shift
    for line_num in sorted(ENDPOINTS_TO_PROTECT, reverse=True):
        # Convert to 0-indexed
        idx = line_num - 1

        if idx < 0 or idx >= len(lines):
            print(f"⚠️  Line {line_num} out of range, skipping")
            continue

        current_line = lines[idx]

        # Check if this is actually a @app.route line
        if not current_line.strip().startswith('@app.route('):
            print(f"⚠️  Line {line_num} is not @app.route, skipping: {current_line.strip()[:50]}")
            continue

        # Check if @login_required is already there (on line before or after)
        has_decorator = False
        if idx > 0 and '@login_required' in lines[idx - 1]:
            has_decorator = True
        if idx + 1 < len(lines) and '@login_required' in lines[idx + 1]:
            has_decorator = True

        if has_decorator:
            print(f"✓ Line {line_num} already has @login_required")
            continue

        # Get indentation from @app.route line
        indent = len(current_line) - len(current_line.lstrip())

        # Insert @login_required on the next line (after @app.route)
        decorator_line = ' ' * indent + '@login_required\n'
        lines.insert(idx + 1, decorator_line)
        added_count += 1
        print(f"✓ Added @login_required at line {line_num}")

    # Write back
    with open('app.py', 'w') as f:
        f.writelines(lines)

    print(f"\n✅ Added {added_count} @login_required decorators")
    print(f"📝 Total endpoints to protect: {len(ENDPOINTS_TO_PROTECT)}")
    print(f"⏭️  Already had decorator: {len(ENDPOINTS_TO_PROTECT) - added_count}")

if __name__ == '__main__':
    print("Adding @login_required decorators to unprotected endpoints...\n")
    add_login_required_decorators()
    print("\n✅ Done! Review the changes and add user_id filtering to queries where needed.")
