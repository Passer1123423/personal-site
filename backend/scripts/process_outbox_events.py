from pathlib import Path
import sys

from sqlmodel import Session

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

from app.database import engine  # noqa: E402
from app.services.event_processor import process_outbox_events_once  # noqa: E402


def main() -> None:
    with Session(engine) as session:
        result = process_outbox_events_once(
            session,
            limit=50,
            locked_by="manual-script",
        )

    print(result)


if __name__ == "__main__":
    main()
