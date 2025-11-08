#!/usr/bin/env python3
"""
Database Backup Utility
Creates timestamped backups of the meal planner database
"""

import os
import shutil
from datetime import datetime
import sys

def backup_database(db_path='meal_planner.db', backup_dir='backups'):
    """Create a timestamped backup of the database"""

    # Check if database exists
    if not os.path.exists(db_path):
        print(f"❌ Database not found: {db_path}")
        return False

    # Create backup directory if it doesn't exist
    if not os.path.exists(backup_dir):
        os.makedirs(backup_dir)
        print(f"📁 Created backup directory: {backup_dir}")

    # Generate backup filename with timestamp
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_filename = f"meal_planner_{timestamp}.db"
    backup_path = os.path.join(backup_dir, backup_filename)

    # Copy database file
    try:
        shutil.copy2(db_path, backup_path)
        file_size = os.path.getsize(backup_path) / 1024  # KB
        print(f"✅ Backup created: {backup_path} ({file_size:.1f} KB)")

        # List all backups
        backups = sorted([f for f in os.listdir(backup_dir) if f.endswith('.db')])
        print(f"\n📋 Total backups: {len(backups)}")
        if len(backups) > 5:
            print(f"   ⚠️  Consider cleaning old backups (keeping last 5-10)")

        return True

    except Exception as e:
        print(f"❌ Backup failed: {e}")
        return False


def list_backups(backup_dir='backups'):
    """List all available backups"""
    if not os.path.exists(backup_dir):
        print(f"📁 No backup directory found: {backup_dir}")
        return

    backups = sorted([f for f in os.listdir(backup_dir) if f.endswith('.db')])

    if not backups:
        print("📋 No backups found")
        return

    print(f"\n📋 Available backups ({len(backups)}):")
    print("="*60)

    for backup in backups:
        backup_path = os.path.join(backup_dir, backup)
        size = os.path.getsize(backup_path) / 1024  # KB
        mtime = datetime.fromtimestamp(os.path.getmtime(backup_path))
        print(f"  {backup}")
        print(f"    Size: {size:.1f} KB | Created: {mtime.strftime('%Y-%m-%d %H:%M:%S')}")


def restore_backup(backup_filename, db_path='meal_planner.db', backup_dir='backups'):
    """Restore database from a backup"""
    backup_path = os.path.join(backup_dir, backup_filename)

    if not os.path.exists(backup_path):
        print(f"❌ Backup not found: {backup_path}")
        return False

    # Create safety backup of current database before restoring
    if os.path.exists(db_path):
        safety_backup = f"{db_path}.pre_restore_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        shutil.copy2(db_path, safety_backup)
        print(f"🔒 Safety backup created: {safety_backup}")

    # Restore
    try:
        shutil.copy2(backup_path, db_path)
        print(f"✅ Database restored from: {backup_filename}")
        return True
    except Exception as e:
        print(f"❌ Restore failed: {e}")
        return False


if __name__ == '__main__':
    import argparse

    parser = argparse.ArgumentParser(description='Database backup utility')
    parser.add_argument('action', choices=['backup', 'list', 'restore'],
                      help='Action to perform')
    parser.add_argument('--file', help='Backup filename (for restore)')
    parser.add_argument('--db', default='meal_planner.db',
                      help='Database path (default: meal_planner.db)')
    parser.add_argument('--dir', default='backups',
                      help='Backup directory (default: backups)')

    args = parser.parse_args()

    if args.action == 'backup':
        success = backup_database(args.db, args.dir)
        sys.exit(0 if success else 1)

    elif args.action == 'list':
        list_backups(args.dir)

    elif args.action == 'restore':
        if not args.file:
            print("❌ Please specify --file for restore")
            sys.exit(1)
        success = restore_backup(args.file, args.db, args.dir)
        sys.exit(0 if success else 1)
