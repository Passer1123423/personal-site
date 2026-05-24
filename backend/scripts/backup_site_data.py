from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import sqlite3
import subprocess
import sys
import tarfile
from datetime import datetime
from pathlib import Path
from typing import Any


BACKEND_DIR = Path(__file__).resolve().parents[1]

DEFAULT_DB_PATH = BACKEND_DIR / "data" / "site.db"
DEFAULT_UPLOADS_DIR = BACKEND_DIR / "uploads"
DEFAULT_BACKUPS_DIR = BACKEND_DIR / "backups"


def now_stamp() -> str:
    return datetime.now().strftime("%Y%m%d-%H%M%S")


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def count_files_and_bytes(path: Path) -> tuple[int, int]:
    if not path.exists():
        return 0, 0
    if path.is_file():
        return 1, path.stat().st_size

    count = 0
    total = 0
    for item in path.rglob("*"):
        if item.is_file():
            count += 1
            total += item.stat().st_size
    return count, total


def backup_sqlite_db(source_db: Path, target_db: Path) -> None:
    if not source_db.exists():
        raise FileNotFoundError(f"Database not found: {source_db}")
    if not source_db.is_file():
        raise RuntimeError(f"Database path is not a file: {source_db}")

    target_db.parent.mkdir(parents=True, exist_ok=True)

    source = sqlite3.connect(f"file:{source_db}?mode=ro", uri=True)
    target = sqlite3.connect(target_db)

    try:
        source.backup(target)
    finally:
        target.close()
        source.close()


def backup_uploads(source_uploads: Path, target_uploads: Path) -> bool:
    if not source_uploads.exists():
        print(f"Uploads directory not found, skipped: {source_uploads}")
        return False
    if not source_uploads.is_dir():
        raise RuntimeError(f"Uploads path is not a directory: {source_uploads}")

    shutil.copytree(source_uploads, target_uploads, symlinks=False)
    return True


def write_manifest(
    backup_dir: Path,
    db_path: Path,
    uploads_dir: Path,
    db_backup_path: Path,
    uploads_copied: bool,
) -> None:
    uploads_count, uploads_bytes = count_files_and_bytes(backup_dir / "uploads")
    manifest: dict[str, Any] = {
        "created_at": datetime.now().isoformat(timespec="seconds"),
        "backend_dir": str(BACKEND_DIR),
        "source_db": str(db_path),
        "source_uploads": str(uploads_dir),
        "backup_dir": str(backup_dir),
        "db_backup": "site.db",
        "db_size_bytes": db_backup_path.stat().st_size,
        "db_sha256": sha256_file(db_backup_path),
        "uploads_copied": uploads_copied,
        "uploads_file_count": uploads_count,
        "uploads_size_bytes": uploads_bytes,
    }

    (backup_dir / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def make_tar_gz(backup_dir: Path) -> Path:
    archive_path = backup_dir.with_suffix(".tar.gz")
    with tarfile.open(archive_path, "w:gz") as tar:
        tar.add(backup_dir, arcname=backup_dir.name)
    return archive_path


def verify_archive(archive_path: Path) -> None:
    if not archive_path.exists():
        raise FileNotFoundError(f"Archive not found after creation: {archive_path}")

    with tarfile.open(archive_path, "r:gz") as tar:
        names = set(tar.getnames())
        root = archive_path.name.replace(".tar.gz", "")
        required = {
            f"{root}/site.db",
            f"{root}/manifest.json",
        }
        missing = sorted(required - names)
        if missing:
            raise RuntimeError(f"Archive verification failed, missing: {missing}")


def prune_local_archives(backups_dir: Path, keep: int) -> None:
    if keep <= 0:
        return

    archives = sorted(
        backups_dir.glob("backup-*.tar.gz"),
        key=lambda p: p.stat().st_mtime,
        reverse=True,
    )

    for old_archive in archives[keep:]:
        old_archive.unlink()
        print(f"Removed old local archive: {old_archive}")


def run_command(args: list[str]) -> None:
    print("+", " ".join(args))
    subprocess.run(args, check=True)


def copy_to_remote(
    archive_path: Path,
    remote_dest: str,
    remote_port: int | None,
    remote_latest_name: str,
) -> None:
    """
    remote_dest examples:
      user@example.com:/home/user/backups
      user@127.0.0.1:/home/user/backups

    The script uploads to a temporary timestamped file first, then renames it
    to remote_latest_name. This keeps only one stable remote backup file.
    """
    if ":" not in remote_dest:
        raise ValueError("remote_dest must look like user@host:/absolute/path")

    remote_host, remote_dir = remote_dest.split(":", 1)
    if not remote_dir.startswith("/"):
        raise ValueError("remote path must be absolute, e.g. user@host:/home/user/backups")

    remote_tmp = f"{remote_dir.rstrip('/')}/.{archive_path.name}.tmp"
    remote_latest = f"{remote_dir.rstrip('/')}/{remote_latest_name}"

    ssh_cmd = ["ssh"]
    scp_cmd = ["scp"]

    if remote_port is not None:
        ssh_cmd += ["-p", str(remote_port)]
        scp_cmd += ["-P", str(remote_port)]

    run_command(ssh_cmd + [remote_host, f"mkdir -p {remote_dir!r}"])
    run_command(scp_cmd + [str(archive_path), f"{remote_host}:{remote_tmp}"])
    run_command(ssh_cmd + [remote_host, f"mv {remote_tmp!r} {remote_latest!r}"])


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Backup personal-site SQLite database and uploads directory."
    )
    parser.add_argument(
        "--db-path",
        default=os.getenv("DB_PATH", str(DEFAULT_DB_PATH)),
        help="SQLite database path. Default: backend/data/site.db or DB_PATH.",
    )
    parser.add_argument(
        "--uploads-dir",
        default=os.getenv("UPLOADS_DIR", str(DEFAULT_UPLOADS_DIR)),
        help="Uploads directory. Default: UPLOADS_DIR or backend/uploads.",
    )
    parser.add_argument(
        "--backups-dir",
        default=os.getenv("BACKUPS_DIR", str(DEFAULT_BACKUPS_DIR)),
        help="Local backups directory. Default: BACKUPS_DIR or backend/backups.",
    )
    parser.add_argument(
        "--keep-local",
        type=int,
        default=int(os.getenv("BACKUP_KEEP_LOCAL", "7")),
        help="How many local .tar.gz backups to keep. Default: 7.",
    )
    parser.add_argument(
        "--remove-expanded",
        action="store_true",
        help="Remove expanded backup directory after .tar.gz is verified.",
    )
    parser.add_argument(
        "--remote-dest",
        default=os.getenv("BACKUP_REMOTE_DEST", ""),
        help="Optional remote destination, e.g. user@127.0.0.1:/home/user/site-backup.",
    )
    parser.add_argument(
        "--remote-port",
        type=int,
        default=int(os.getenv("BACKUP_REMOTE_PORT", "0")),
        help="Optional SSH port for remote copy. Use 0 to omit.",
    )
    parser.add_argument(
        "--remote-latest-name",
        default=os.getenv("BACKUP_REMOTE_LATEST_NAME", "personal-site-latest.tar.gz"),
        help="Remote filename. Default keeps only one stable remote file.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    db_path = Path(args.db_path).expanduser().resolve()
    uploads_dir = Path(args.uploads_dir).expanduser().resolve()
    backups_dir = Path(args.backups_dir).expanduser().resolve()

    timestamp = now_stamp()
    backup_dir = backups_dir / f"backup-{timestamp}"

    print(f"Database: {db_path}")
    print(f"Uploads:  {uploads_dir}")
    print(f"Backups:  {backups_dir}")

    backup_dir.mkdir(parents=True, exist_ok=False)

    try:
        db_backup_path = backup_dir / "site.db"
        backup_sqlite_db(db_path, db_backup_path)
        uploads_copied = backup_uploads(uploads_dir, backup_dir / "uploads")

        write_manifest(
            backup_dir=backup_dir,
            db_path=db_path,
            uploads_dir=uploads_dir,
            db_backup_path=db_backup_path,
            uploads_copied=uploads_copied,
        )

        archive_path = make_tar_gz(backup_dir)
        verify_archive(archive_path)

        archive_sha256 = sha256_file(archive_path)
        print(f"Backup archive created: {archive_path}")
        print(f"Archive size bytes: {archive_path.stat().st_size}")
        print(f"Archive sha256: {archive_sha256}")

        if args.remove_expanded:
            shutil.rmtree(backup_dir)
            print(f"Removed expanded backup dir: {backup_dir}")

        prune_local_archives(backups_dir, args.keep_local)

        if args.remote_dest:
            remote_port = args.remote_port if args.remote_port > 0 else None
            copy_to_remote(
                archive_path=archive_path,
                remote_dest=args.remote_dest,
                remote_port=remote_port,
                remote_latest_name=args.remote_latest_name,
            )
            print("Remote copy complete.")

    except Exception:
        if backup_dir.exists():
            print(f"Backup failed. Partial directory kept for inspection: {backup_dir}", file=sys.stderr)
        raise


if __name__ == "__main__":
    main()
