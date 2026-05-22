from __future__ import annotations

import shutil
import sqlite3
from datetime import datetime
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parents[1]

DB_PATH = BACKEND_DIR / "data" / "site.db"
UPLOADS_DIR = BACKEND_DIR / "uploads"
BACKUPS_DIR = BACKEND_DIR / "backups"


def backup_sqlite_db(target_db: Path) -> None:
    if not DB_PATH.exists():
        raise FileNotFoundError(f"Database not found: {DB_PATH}")

    target_db.parent.mkdir(parents=True, exist_ok=True)

    source = sqlite3.connect(DB_PATH)
    target = sqlite3.connect(target_db)

    try:
        source.backup(target)
    finally:
        target.close()
        source.close()


def backup_uploads(target_uploads_dir: Path) -> None:
    if not UPLOADS_DIR.exists():
        print(f"Uploads directory not found, skipped: {UPLOADS_DIR}")
        return

    shutil.copytree(UPLOADS_DIR, target_uploads_dir)


def main() -> None:
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    backup_dir = BACKUPS_DIR / f"backup-{timestamp}"

    backup_dir.mkdir(parents=True, exist_ok=False)

    backup_sqlite_db(backup_dir / "site.db")
    backup_uploads(backup_dir / "uploads")

    print(f"Backup created: {backup_dir}")


if __name__ == "__main__":
    main()
