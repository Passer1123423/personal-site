from uuid import uuid4

from sqlmodel import Session

from app.services.event_handlers import handle_event
from app.services.outbox_service import (
    claim_pending_events,
    mark_failed_or_dead,
    mark_processed,
    recover_stale_processing_events,
)


def process_outbox_events_once(
    session: Session,
    *,
    limit: int = 50,
    locked_by: str | None = None,
) -> dict:
    worker_id = locked_by or f"worker-{uuid4()}"

    recovered_count = recover_stale_processing_events(session)

    events = claim_pending_events(
        session,
        limit=limit,
        locked_by=worker_id,
    )

    processed_count = 0
    failed_count = 0

    for event in events:
        try:
            handle_event(session, event)
            mark_processed(session, event=event)
            processed_count += 1
        except Exception as exc:
            mark_failed_or_dead(session, event=event, error=exc)
            failed_count += 1

    return {
        "worker_id": worker_id,
        "recovered_count": recovered_count,
        "claimed_count": len(events),
        "processed_count": processed_count,
        "failed_count": failed_count,
    }
