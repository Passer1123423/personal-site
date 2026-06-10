from pathlib import Path
import argparse
import json
import os
import sys

from sqlmodel import Session


BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))


from app.database import engine  # noqa: E402
from app.services.event_processor import process_outbox_events_once  # noqa: E402


def env_flag(name: str, default: bool = False) -> bool:
    value = os.getenv(name)

    if value is None:
        return default

    return value.strip().lower() in {"1", "true", "yes", "on"}


def env_int(name: str, default: int) -> int:
    value = os.getenv(name)

    if value is None or not value.strip():
        return default

    try:
        return int(value)
    except ValueError:
        raise SystemExit(f"{name} must be an integer")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Process pending outbox events once.",
    )

    parser.add_argument(
        "--limit",
        type=int,
        default=env_int("OUTBOX_PROCESS_LIMIT", 50),
        help="Maximum number of events to claim in this run. Default: OUTBOX_PROCESS_LIMIT or 50.",
    )

    parser.add_argument(
        "--locked-by",
        default=os.getenv("OUTBOX_LOCKED_BY", "manual-script"),
        help="Worker identity written to locked_by. Default: OUTBOX_LOCKED_BY or manual-script.",
    )

    parser.add_argument(
        "--json",
        action="store_true",
        default=env_flag("OUTBOX_PROCESS_JSON", False),
        help="Print result as JSON. Can also be enabled with OUTBOX_PROCESS_JSON=1.",
    )

    return parser.parse_args()


def main() -> None:
    args = parse_args()

    if args.limit < 1:
        raise SystemExit("--limit must be >= 1")

    with Session(engine) as session:
        result = process_outbox_events_once(
            session,
            limit=args.limit,
            locked_by=args.locked_by,
        )

    result_with_context = {
        "backend_dir": str(BACKEND_DIR),
        **result,
    }

    if args.json:
        print(json.dumps(result_with_context, ensure_ascii=False, default=str))
    else:
        print(f"Backend: {BACKEND_DIR}")
        print(result)


if __name__ == "__main__":
    main()