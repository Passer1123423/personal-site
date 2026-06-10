import json
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, col, select

from app.models import OutboxEvent, now_utc


EVENT_STATUS_PENDING = "pending"
EVENT_STATUS_PROCESSING = "processing"
EVENT_STATUS_PROCESSED = "processed"
EVENT_STATUS_FAILED = "failed"
EVENT_STATUS_DEAD = "dead"


def safe_json_dumps(data: dict[str, Any]) -> str:
    return json.dumps(data, ensure_ascii=False, default=str)


def safe_json_loads(raw: str | None) -> dict[str, Any]:
    if not raw:
        return {}

    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return {}

    return data if isinstance(data, dict) else {}


def truncate_error(error: BaseException, limit: int = 3000) -> str:
    text = f"{type(error).__name__}: {error}"
    return text[:limit]

def get_outbox_event_by_dedupe_key(
    session: Session,
    dedupe_key: str,
) -> OutboxEvent | None:
    return session.exec(
        select(OutboxEvent).where(OutboxEvent.dedupe_key == dedupe_key)
    ).first()


def create_outbox_event(
    session: Session,
    *,
    event_type: str,
    aggregate_type: str,
    aggregate_id: str,
    actor_user_id: str | None,
    payload: dict[str, Any],
    dedupe_key: str,
    event_version: int = 1,
    max_retries: int = 3,
    available_at: datetime | None = None,
) -> OutboxEvent | None:
    existing_event = get_outbox_event_by_dedupe_key(session, dedupe_key)
    if existing_event:
        return existing_event

    event = OutboxEvent(
        event_type=event_type,
        aggregate_type=aggregate_type,
        aggregate_id=aggregate_id,
        actor_user_id=actor_user_id,
        payload_json=safe_json_dumps(payload),
        event_version=event_version,
        status=EVENT_STATUS_PENDING,
        retry_count=0,
        max_retries=max_retries,
        available_at=available_at or now_utc(),
        dedupe_key=dedupe_key,
    )

    try:
        with session.begin_nested():
            session.add(event)
            session.flush()
    except IntegrityError:
        return get_outbox_event_by_dedupe_key(session, dedupe_key)

    return event


def recover_stale_processing_events(
    session: Session,
    *,
    stale_after_minutes: int = 10,
) -> int:
    threshold = now_utc() - timedelta(minutes=stale_after_minutes)

    events = session.exec(
        select(OutboxEvent)
        .where(OutboxEvent.status == EVENT_STATUS_PROCESSING)
        .where(OutboxEvent.locked_at < threshold)
    ).all()

    for event in events:
        event.status = EVENT_STATUS_FAILED
        event.locked_at = None
        event.locked_by = None
        event.available_at = now_utc()
        event.last_error = "processing event recovered after worker timeout"
        event.last_error_at = now_utc()
        session.add(event)

    if events:
        session.commit()

    return len(events)


def claim_pending_events(
    session: Session,
    *,
    limit: int = 50,
    locked_by: str,
) -> list[OutboxEvent]:
    now = now_utc()

    events = session.exec(
        select(OutboxEvent)
        .where(col(OutboxEvent.status).in_([EVENT_STATUS_PENDING, EVENT_STATUS_FAILED]))
        .where(OutboxEvent.available_at <= now)
        .order_by(OutboxEvent.created_at)
        .limit(limit)
    ).all()

    for event in events:
        event.status = EVENT_STATUS_PROCESSING
        event.locked_at = now
        event.locked_by = locked_by
        session.add(event)

    if events:
        session.commit()

        for event in events:
            session.refresh(event)

    return events


def mark_processed(
    session: Session,
    *,
    event: OutboxEvent,
) -> None:
    event.status = EVENT_STATUS_PROCESSED
    event.processed_at = now_utc()
    event.locked_at = None
    event.locked_by = None
    event.last_error = None
    event.last_error_at = None

    session.add(event)
    session.commit()


def get_retry_delay_minutes(retry_count: int) -> int:
    if retry_count <= 1:
        return 1

    if retry_count == 2:
        return 5

    return 30


def mark_failed_or_dead(
    session: Session,
    *,
    event: OutboxEvent,
    error: BaseException,
) -> None:
    event.retry_count += 1
    event.last_error = truncate_error(error)
    event.last_error_at = now_utc()
    event.locked_at = None
    event.locked_by = None

    if event.retry_count >= event.max_retries:
        event.status = EVENT_STATUS_DEAD
    else:
        event.status = EVENT_STATUS_FAILED
        event.available_at = now_utc() + timedelta(
            minutes=get_retry_delay_minutes(event.retry_count)
        )

    session.add(event)
    session.commit()
