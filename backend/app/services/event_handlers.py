from sqlmodel import Session

from app.models import OutboxEvent


def handle_comment_created(
    session: Session,
    event: OutboxEvent,
) -> None:
    """
    comment.created 第一版只确认事件可被 processor 消费。

    Notification 分支再在这里派生用户通知。
    """

    return None


EVENT_HANDLERS = {
    "comment.created": handle_comment_created,
}


def handle_event(
    session: Session,
    event: OutboxEvent,
) -> None:
    handler = EVENT_HANDLERS.get(event.event_type)

    if handler is None:
        raise ValueError(f"未注册的事件类型：{event.event_type}")

    handler(session, event)
