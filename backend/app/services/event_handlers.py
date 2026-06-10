from sqlmodel import Session

from app.models import (
    ComicChapter,
    ComicPart,
    ComicSeries,
    Comment,
    Novel,
    NovelChapter,
    OutboxEvent,
    User,
)
from app.services.notification_service import create_notification
from app.services.outbox_service import safe_json_loads


def get_actor(
    session: Session,
    actor_user_id: str | None,
) -> User | None:
    if not actor_user_id:
        return None

    return session.get(User, actor_user_id)


def get_user_display_name(user: User | None) -> str:
    if user is None:
        return "有人"

    return user.display_name or user.username


def build_target_url(
    session: Session,
    *,
    target_type: str,
    target_id: str,
) -> str | None:
    if target_type == "user_page":
        user = session.get(User, target_id)
        if user:
            return f"/users/{user.username}"
        return None

    if target_type == "novel":
        novel = session.get(Novel, target_id)
        if novel:
            return f"/works/novels/{novel.slug}"
        return None

    if target_type == "novel_chapter":
        chapter = session.get(NovelChapter, target_id)
        if not chapter:
            return None

        novel = session.get(Novel, chapter.novel_id)
        if not novel:
            return None

        return f"/works/novels/{novel.slug}/{chapter.slug}"

    if target_type == "comic_part":
        part = session.get(ComicPart, target_id)
        if not part:
            return None

        series = session.get(ComicSeries, part.series_id)
        if not series:
            return None

        return f"/works/comics/{series.slug}/{part.slug}"

    if target_type == "comic_chapter":
        chapter = session.get(ComicChapter, target_id)
        if not chapter:
            return None

        part = session.get(ComicPart, chapter.part_id)
        if not part:
            return None

        series = session.get(ComicSeries, part.series_id)
        if not series:
            return None

        return f"/works/comics/{series.slug}/{part.slug}/{chapter.slug}"

    return None


def create_comment_reply_notification(
    session: Session,
    *,
    event: OutboxEvent,
    payload: dict,
    actor: User | None,
) -> bool:
    comment_id = payload.get("comment_id")
    actor_user_id = payload.get("actor_user_id")
    reply_to_id = payload.get("reply_to_id")

    if not comment_id or not actor_user_id or not reply_to_id:
        return False

    reply_to = session.get(Comment, reply_to_id)
    if reply_to is None:
        return False

    recipient_user_id = reply_to.user_id

    if recipient_user_id == actor_user_id:
        return True

    target_type = payload.get("target_type")
    target_id = payload.get("target_id")

    target_url = None
    if target_type and target_id:
        target_url = build_target_url(
            session,
            target_type=target_type,
            target_id=target_id,
        )

    actor_name = get_user_display_name(actor)
    content_preview = payload.get("content_preview") or ""

    create_notification(
        session,
        recipient_user_id=recipient_user_id,
        actor=actor,
        type="comment.reply",
        title=f"{actor_name} 回复了你的评论",
        body=content_preview,
        target_type="comment",
        target_id=comment_id,
        target_url=target_url,
        metadata={
            "event_id": event.id,
            "comment_id": comment_id,
            "reply_to_id": reply_to_id,
            "comment_target_type": target_type,
            "comment_target_id": target_id,
            "image_count": payload.get("image_count", 0),
        },
        dedupe_key=f"comment.reply:{comment_id}:{recipient_user_id}",
    )

    return True


def create_user_page_comment_notification(
    session: Session,
    *,
    event: OutboxEvent,
    payload: dict,
    actor: User | None,
) -> bool:
    comment_id = payload.get("comment_id")
    actor_user_id = payload.get("actor_user_id")
    target_type = payload.get("target_type")
    target_id = payload.get("target_id")
    parent_id = payload.get("parent_id")

    if target_type != "user_page":
        return False

    if parent_id:
        return False

    if not comment_id or not actor_user_id or not target_id:
        return False

    recipient_user_id = target_id

    if recipient_user_id == actor_user_id:
        return True

    target_user = session.get(User, recipient_user_id)
    if target_user is None:
        return False

    actor_name = get_user_display_name(actor)
    content_preview = payload.get("content_preview") or ""

    create_notification(
        session,
        recipient_user_id=recipient_user_id,
        actor=actor,
        type="comment.user_page",
        title=f"{actor_name} 在你的主页留言",
        body=content_preview,
        target_type="user_page",
        target_id=recipient_user_id,
        target_url=f"/users/{target_user.username}",
        metadata={
            "event_id": event.id,
            "comment_id": comment_id,
            "comment_target_type": target_type,
            "comment_target_id": target_id,
            "image_count": payload.get("image_count", 0),
        },
        dedupe_key=f"comment.user_page:{comment_id}:{recipient_user_id}",
    )

    return True


def handle_comment_created(
    session: Session,
    event: OutboxEvent,
) -> None:
    payload = safe_json_loads(event.payload_json)
    actor = get_actor(session, payload.get("actor_user_id"))

    # 回复优先。若一个动作同时满足 user_page 和 reply，只生成 reply。
    handled_reply = create_comment_reply_notification(
        session,
        event=event,
        payload=payload,
        actor=actor,
    )

    if handled_reply:
        return

    create_user_page_comment_notification(
        session,
        event=event,
        payload=payload,
        actor=actor,
    )


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