import json
from typing import Any

from fastapi import Request
from sqlmodel import Session, func, or_, select

from app.models import ActivityLog, User


def infer_activity_category(action: str) -> str:
    """
    从 action 自动推断 category。

    例如：
    comment.reply -> comment
    comic.chapter.delete -> comic
    auth.login.success -> auth
    """

    clean_action = action.strip()

    if not clean_action:
        return "system"

    return clean_action.split(".", 1)[0] or "system"


def build_actor_snapshot(actor: User | None) -> dict[str, str | None]:
    if actor is None:
        return {
            "actor_user_id": None,
            "actor_username": None,
            "actor_display_name": None,
            "actor_role": None,
        }

    return {
        "actor_user_id": actor.id,
        "actor_username": actor.username,
        "actor_display_name": actor.display_name,
        "actor_role": actor.role,
    }


def get_request_ip(request: Request | None) -> str | None:
    if request is None:
        return None

    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        return forwarded_for.split(",", 1)[0].strip() or None

    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.strip() or None

    if request.client:
        return request.client.host

    return None


def get_request_user_agent(request: Request | None) -> str | None:
    if request is None:
        return None

    user_agent = request.headers.get("user-agent")
    if not user_agent:
        return None

    return user_agent[:500]


def safe_json_dumps(value: dict[str, Any] | None) -> str | None:
    if not value:
        return None

    return json.dumps(
        value,
        ensure_ascii=False,
        default=str,
        separators=(",", ":"),
    )


def shorten_label(value: str | None, max_length: int = 120) -> str | None:
    if value is None:
        return None

    clean_value = value.strip()
    if len(clean_value) <= max_length:
        return clean_value

    return clean_value[: max_length - 1] + "…"

def build_error_metadata(
    exc: Exception,
    extra: dict[str, Any] | None = None,
) -> dict[str, Any]:
    metadata: dict[str, Any] = {
        "error_type": type(exc).__name__,
        "error_message": str(exc)[:500],
    }

    if extra:
        metadata.update(extra)

    return metadata

def log_activity(
    session: Session,
    *,
    actor: User | None = None,
    action: str,
    category: str | None = None,
    target_type: str | None = None,
    target_id: str | None = None,
    target_label: str | None = None,
    status: str = "success",
    message: str | None = None,
    metadata: dict[str, Any] | None = None,
    request: Request | None = None,
    error_code: str | None = None,
) -> None:
    """
    统一写操作日志。

    约定：
    1. 日志只记录重要业务写操作，不记录普通 GET 访问。
    2. 日志失败不能影响主业务。
    3. 不要在 metadata 里放密码、token、完整敏感内容。
    4. 最好在主业务 commit 成功后调用。
    """

    try:
        clean_action = action.strip()
        if not clean_action:
            clean_action = "system.unknown"

        clean_category = (category or infer_activity_category(clean_action)).strip() or "system"

        actor_snapshot = build_actor_snapshot(actor)

        activity_log = ActivityLog(
            **actor_snapshot,
            action=clean_action,
            category=clean_category,
            target_type=target_type,
            target_id=target_id,
            target_label=shorten_label(target_label),
            status=status,
            message=message,
            error_code=error_code,
            metadata_json=safe_json_dumps(metadata),
            ip_address=get_request_ip(request),
            user_agent=get_request_user_agent(request),
        )

        session.add(activity_log)
        session.commit()

    except Exception:
        # 日志不能拖垮主业务。
        try:
            session.rollback()
        except Exception:
            pass


def serialize_activity_log(log: ActivityLog) -> dict:
    metadata = None

    if log.metadata_json:
        try:
            metadata = json.loads(log.metadata_json)
        except json.JSONDecodeError:
            metadata = log.metadata_json

    return {
        "id": log.id,
        "actorUserId": log.actor_user_id,
        "actorUsername": log.actor_username,
        "actorDisplayName": log.actor_display_name,
        "actorRole": log.actor_role,
        "action": log.action,
        "category": log.category,
        "targetType": log.target_type,
        "targetId": log.target_id,
        "targetLabel": log.target_label,
        "status": log.status,
        "message": log.message,
        "errorCode": log.error_code,
        "metadata": metadata,
        "ipAddress": log.ip_address,
        "userAgent": log.user_agent,
        "createdAt": log.created_at,
    }


def list_activity_logs(
    session: Session,
    *,
    keyword: str | None = None,
    category: str | None = None,
    action: str | None = None,
    actor_user_id: str | None = None,
    actor_username: str | None = None,
    actor_role: str | None = None,
    target_type: str | None = None,
    target_id: str | None = None,
    status: str | None = None,
    created_from=None,
    created_to=None,
    limit: int = 50,
    offset: int = 0,
) -> dict:
    page_limit = max(1, min(limit, 200))
    page_offset = max(0, offset)

    query = select(ActivityLog)

    clean_keyword = keyword.strip() if keyword else ""
    if clean_keyword:
        query = query.where(
            or_(
                ActivityLog.action.contains(clean_keyword),
                ActivityLog.category.contains(clean_keyword),
                ActivityLog.actor_username.contains(clean_keyword),
                ActivityLog.target_type.contains(clean_keyword),
                ActivityLog.target_id.contains(clean_keyword),
                ActivityLog.target_label.contains(clean_keyword),
                ActivityLog.message.contains(clean_keyword),
            )
        )

    if category:
        query = query.where(ActivityLog.category == category)

    if action:
        query = query.where(ActivityLog.action == action)

    if actor_user_id:
        query = query.where(ActivityLog.actor_user_id == actor_user_id)

    if actor_username:
        query = query.where(ActivityLog.actor_username == actor_username)

    if actor_role:
        query = query.where(ActivityLog.actor_role == actor_role)

    if target_type:
        query = query.where(ActivityLog.target_type == target_type)

    if target_id:
        query = query.where(ActivityLog.target_id == target_id)

    if status:
        query = query.where(ActivityLog.status == status)

    if created_from:
        query = query.where(ActivityLog.created_at >= created_from)

    if created_to:
        query = query.where(ActivityLog.created_at <= created_to)

    count_query = select(func.count()).select_from(query.subquery())
    total = session.exec(count_query).one()

    logs = session.exec(
        query
        .order_by(ActivityLog.created_at.desc())
        .offset(page_offset)
        .limit(page_limit)
    ).all()

    return {
        "items": [serialize_activity_log(log) for log in logs],
        "total": total,
        "limit": page_limit,
        "offset": page_offset,
    }


def get_activity_log_detail(
    session: Session,
    *,
    log_id: str,
) -> dict | None:
    log = session.get(ActivityLog, log_id)

    if not log:
        return None

    return serialize_activity_log(log)

def list_activity_log_filter_options(session: Session) -> dict:
    category_rows = session.exec(
        select(ActivityLog.category, func.count())
        .group_by(ActivityLog.category)
        .order_by(ActivityLog.category)
    ).all()

    action_rows = session.exec(
        select(ActivityLog.action, func.count())
        .group_by(ActivityLog.action)
        .order_by(ActivityLog.action)
    ).all()

    target_type_rows = session.exec(
        select(ActivityLog.target_type, func.count())
        .where(ActivityLog.target_type.is_not(None))
        .group_by(ActivityLog.target_type)
        .order_by(ActivityLog.target_type)
    ).all()

    status_rows = session.exec(
        select(ActivityLog.status, func.count())
        .group_by(ActivityLog.status)
        .order_by(ActivityLog.status)
    ).all()

    return {
        "categories": [
            {
                "value": value,
                "count": count,
            }
            for value, count in category_rows
            if value
        ],
        "actions": [
            {
                "value": value,
                "count": count,
            }
            for value, count in action_rows
            if value
        ],
        "targetTypes": [
            {
                "value": value,
                "count": count,
            }
            for value, count in target_type_rows
            if value
        ],
        "statuses": [
            {
                "value": value,
                "count": count,
            }
            for value, count in status_rows
            if value
        ],
    }