import json
from typing import Any

from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from app.models import Notification, User, now_utc


def safe_json_dumps(data: dict[str, Any] | None) -> str | None:
    if data is None:
        return None

    return json.dumps(data, ensure_ascii=False, default=str)


def safe_json_loads(raw: str | None) -> dict[str, Any]:
    if not raw:
        return {}

    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return {}

    return data if isinstance(data, dict) else {}


def get_notification_by_dedupe_key(
    session: Session,
    dedupe_key: str,
) -> Notification | None:
    return session.exec(
        select(Notification).where(Notification.dedupe_key == dedupe_key)
    ).first()


def create_notification(
    session: Session,
    *,
    recipient_user_id: str,
    actor: User | None,
    type: str,
    title: str,
    body: str,
    target_type: str | None,
    target_id: str | None,
    target_url: str | None,
    metadata: dict[str, Any] | None,
    dedupe_key: str,
) -> Notification | None:
    existing = get_notification_by_dedupe_key(session, dedupe_key)
    if existing:
        return existing

    notification = Notification(
        recipient_user_id=recipient_user_id,
        actor_user_id=actor.id if actor else None,
        actor_username=actor.username if actor else None,
        actor_display_name=actor.display_name if actor else None,
        type=type,
        title=title,
        body=body,
        target_type=target_type,
        target_id=target_id,
        target_url=target_url,
        is_read=False,
        created_at=now_utc(),
        read_at=None,
        metadata_json=safe_json_dumps(metadata),
        dedupe_key=dedupe_key,
    )

    session.add(notification)

    try:
        session.flush()
    except IntegrityError:
        session.rollback()
        return get_notification_by_dedupe_key(session, dedupe_key)

    return notification


def serialize_notification(notification: Notification) -> dict:
    return {
        "id": notification.id,
        "type": notification.type,
        "title": notification.title,
        "body": notification.body,
        "actorUserId": notification.actor_user_id,
        "actorUsername": notification.actor_username,
        "actorDisplayName": notification.actor_display_name,
        "targetType": notification.target_type,
        "targetId": notification.target_id,
        "targetUrl": notification.target_url,
        "isRead": notification.is_read,
        "createdAt": notification.created_at,
        "readAt": notification.read_at,
        "metadata": safe_json_loads(notification.metadata_json),
    }


def list_notifications_for_user(
    session: Session,
    *,
    user_id: str,
    limit: int = 20,
    offset: int = 0,
    unread_only: bool = False,
) -> dict:
    page_limit = max(1, min(limit, 100))
    page_offset = max(0, offset)

    query = select(Notification).where(Notification.recipient_user_id == user_id)
    count_query = select(func.count(Notification.id)).where(
        Notification.recipient_user_id == user_id
    )

    if unread_only:
        query = query.where(Notification.is_read == False)  # noqa: E712
        count_query = count_query.where(Notification.is_read == False)  # noqa: E712

    total = session.exec(count_query).one()

    notifications = session.exec(
        query
        .order_by(Notification.created_at.desc())
        .offset(page_offset)
        .limit(page_limit)
    ).all()

    return {
        "items": [
            serialize_notification(notification)
            for notification in notifications
        ],
        "total": total,
        "limit": page_limit,
        "offset": page_offset,
    }


def count_unread_notifications_for_user(
    session: Session,
    *,
    user_id: str,
) -> int:
    return session.exec(
        select(func.count(Notification.id))
        .where(Notification.recipient_user_id == user_id)
        .where(Notification.is_read == False)  # noqa: E712
    ).one()


def mark_notification_read(
    session: Session,
    *,
    notification_id: str,
    user_id: str,
) -> Notification | None:
    notification = session.exec(
        select(Notification)
        .where(Notification.id == notification_id)
        .where(Notification.recipient_user_id == user_id)
    ).first()

    if notification is None:
        return None

    if not notification.is_read:
        notification.is_read = True
        notification.read_at = now_utc()
        session.add(notification)
        session.commit()
        session.refresh(notification)

    return notification


def mark_all_notifications_read(
    session: Session,
    *,
    user_id: str,
) -> int:
    notifications = session.exec(
        select(Notification)
        .where(Notification.recipient_user_id == user_id)
        .where(Notification.is_read == False)  # noqa: E712
    ).all()

    now = now_utc()

    for notification in notifications:
        notification.is_read = True
        notification.read_at = now
        session.add(notification)

    if notifications:
        session.commit()

    return len(notifications)
