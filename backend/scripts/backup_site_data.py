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


def parse_remote_dest(remote_dest: str) -> tuple[str, str]:
    if ":" not in remote_dest:
        raise ValueError(
            "remote_dest must look like user@host:/absolute/path "
            "or user@host:/O:/path for Windows OpenSSH"
        )

    remote_host, remote_dir = remote_dest.split(":", 1)
    if not remote_host:
        raise ValueError("remote host is empty")
    if not remote_dir:
        raise ValueError("remote path is empty")

    return remote_host, remote_dir.rstrip("/\\")


def windows_path_from_scp_path(path: str) -> str:
    r"""
    Convert scp-style Windows OpenSSH paths to a Windows path.

    Supported examples:
      /O:/personal-site -> O:\personal-site
      O:/personal-site  -> O:\personal-site
      C:/Users/name     -> C:\Users\name
    """
    normalized = path.strip()

    if len(normalized) >= 4 and normalized[0] == "/" and normalized[2] == ":":
        normalized = normalized[1:]

    if len(normalized) >= 3 and normalized[1] == ":":
        return normalized.replace("/", "\\")

    return normalized.replace("/", "\\")


def powershell_single_quote(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def build_ssh_scp_commands(
    remote_port: int | None,
    remote_identity_file: str,
) -> tuple[list[str], list[str]]:
    ssh_cmd = ["ssh"]
    scp_cmd = ["scp"]

    if remote_port is not None:
        ssh_cmd += ["-p", str(remote_port)]
        scp_cmd += ["-P", str(remote_port)]

    if remote_identity_file:
        expanded_key = str(Path(remote_identity_file).expanduser())
        ssh_cmd += ["-i", expanded_key]
        scp_cmd += ["-i", expanded_key]

    return ssh_cmd, scp_cmd


def copy_to_remote(
    archive_path: Path,
    remote_dest: str,
    remote_port: int | None,
    remote_latest_name: str,
    remote_identity_file: str = "",
    remote_platform: str = "posix",
    remote_skip_mkdir: bool = False,
) -> None:
    """
    Copy the backup archive to a remote host.

    remote_dest examples:
      POSIX:
        user@example.com:/home/user/backups
      Windows OpenSSH:
        23747@127.0.0.1:/O:/personal-site

    The script uploads to a temporary file first, then renames it to
    remote_latest_name. This keeps only one stable remote backup file.
    """
    remote_host, remote_dir = parse_remote_dest(remote_dest)

    if remote_platform == "posix" and not remote_dir.startswith("/"):
        raise ValueError("POSIX remote path must be absolute, e.g. user@host:/home/user/backups")

    remote_tmp_for_scp = f"{remote_dir.rstrip('/')}/.{archive_path.name}.tmp"
    remote_latest_for_scp = f"{remote_dir.rstrip('/')}/{remote_latest_name}"

    ssh_cmd, scp_cmd = build_ssh_scp_commands(remote_port, remote_identity_file)

    if remote_platform == "windows":
        remote_dir_for_command = windows_path_from_scp_path(remote_dir)
        remote_tmp_for_command = windows_path_from_scp_path(remote_tmp_for_scp)
        remote_latest_for_command = windows_path_from_scp_path(remote_latest_for_scp)

        if not remote_skip_mkdir:
            mkdir_script = (
                "New-Item -ItemType Directory -Force -LiteralPath "
                f"{powershell_single_quote(remote_dir_for_command)} | Out-Null"
            )
            run_command(
                ssh_cmd
                + [
                    remote_host,
                    "powershell",
                    "-NoProfile",
                    "-Command",
                    mkdir_script,
                ]
            )

        run_command(scp_cmd + [str(archive_path), f"{remote_host}:{remote_tmp_for_scp}"])

        move_script = (
            "Move-Item -Force -LiteralPath "
            f"{powershell_single_quote(remote_tmp_for_command)} "
            "-Destination "
            f"{powershell_single_quote(remote_latest_for_command)}"
        )
        run_command(
            ssh_cmd
            + [
                remote_host,
                "powershell",
                "-NoProfile",
                "-Command",
                move_script,
            ]
        )
        return

    if not remote_skip_mkdir:
        run_command(ssh_cmd + [remote_host, f"mkdir -p {remote_dir!r}"])

    run_command(scp_cmd + [str(archive_path), f"{remote_host}:{remote_tmp_for_scp}"])
    run_command(ssh_cmd + [remote_host, f"mv {remote_tmp_for_scp!r} {remote_latest_for_scp!r}"])


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
        "--remote-identity-file",
        default=os.getenv("BACKUP_REMOTE_IDENTITY_FILE", ""),
        help="Optional SSH private key file for remote copy, e.g. ~/.ssh/personal_site_backup.",
    )
    parser.add_argument(
        "--remote-platform",
        default=os.getenv("BACKUP_REMOTE_PLATFORM", "posix"),
        choices=["posix", "windows"],
        help="Remote SSH platform. Use windows for Windows OpenSSH targets.",
    )
    parser.add_argument(
        "--remote-skip-mkdir",
        action="store_true",
        help="Do not create the remote directory before uploading.",
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
                remote_identity_file=args.remote_identity_file,
                remote_platform=args.remote_platform,
                remote_skip_mkdir=args.remote_skip_mkdir,
            )
            print("Remote copy complete.")

    except Exception:
        if backup_dir.exists():
            print(f"Backup failed. Partial directory kept for inspection: {backup_dir}", file=sys.stderr)
        raise


if __name__ == "__main__":
    main()
