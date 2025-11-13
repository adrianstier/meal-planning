#!/usr/bin/env python3
"""
One-time endpoint to cleanup duplicate meals
Add this to app.py temporarily to run the cleanup
"""

# Add this route to app.py:
"""
@app.route('/api/admin/cleanup-duplicates', methods=['POST'])
@login_required
def cleanup_duplicates():
    '''Remove duplicate meals - one-time cleanup endpoint'''
    try:
        user_id = get_current_user_id()

        with db_connection(db) as conn:
            cursor = conn.cursor()

            # Find duplicates
            cursor.execute('''
                SELECT user_id, name, COUNT(*) as count
                FROM meals
                WHERE user_id = ?
                GROUP BY user_id, name
                HAVING count > 1
                ORDER BY count DESC
            ''', (user_id,))

            duplicates = cursor.fetchall()

            if not duplicates:
                return jsonify({
                    'success': True,
                    'message': 'No duplicates found',
                    'deleted': 0
                })

            total_deleted = 0
            deleted_meals = []

            # For each set of duplicates, keep only the newest
            for row in duplicates:
                name = row['name']
                count = row['count']

                # Get all IDs for this meal, ordered by creation date (newest first)
                cursor.execute('''
                    SELECT id, created_at
                    FROM meals
                    WHERE user_id = ? AND name = ?
                    ORDER BY created_at DESC
                ''', (user_id, name))

                meal_ids = cursor.fetchall()

                # Keep the first (newest) and delete the rest
                ids_to_delete = [m['id'] for m in meal_ids[1:]]

                if ids_to_delete:
                    placeholders = ','.join('?' * len(ids_to_delete))
                    cursor.execute(f'''
                        DELETE FROM meals
                        WHERE id IN ({placeholders})
                    ''', ids_to_delete)

                    deleted_count = cursor.rowcount
                    total_deleted += deleted_count
                    deleted_meals.append({
                        'name': name,
                        'deleted': deleted_count,
                        'kept_id': meal_ids[0]['id']
                    })

            conn.commit()

            return jsonify({
                'success': True,
                'message': f'Deleted {total_deleted} duplicate meals',
                'deleted': total_deleted,
                'details': deleted_meals
            })

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
"""
print("Add the above route to app.py to enable manual duplicate cleanup")
