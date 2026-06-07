from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import Session

from app.database import get_session
from app.dependencies.auth import require_admin_user
from app.models import User
from app.services.activity_logs import (
    get_activity_log_detail,
    list_activity_logs,
)


router = APIRouter(
    prefix="/api/admin/activity-logs",
    tags=["admin-activity-logs"],
)


@router.get("")
def admin_list_activity_logs(
    keyword: str | None = Query(default=None),
    category: str | None = Query(default=None),
    action: str | None = Query(default=None),
    actor_user_id: str | None = Query(default=None),
    actor_username: str | None = Query(default=None),
    actor_role: str | None = Query(default=None),
    target_type: str | None = Query(default=None),
    target_id: str | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    created_from: datetime | None = Query(default=None),
    created_to: datetime | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_admin_user),
):
    _ = current_user

    return list_activity_logs(
        session,
        keyword=keyword,
        category=category,
        action=action,
        actor_user_id=actor_user_id,
        actor_username=actor_username,
        actor_role=actor_role,
        target_type=target_type,
        target_id=target_id,
        status=status_filter,
        created_from=created_from,
        created_to=created_to,
        limit=limit,
        offset=offset,
    )


@router.get("/{log_id}")
def admin_read_activity_log(
    log_id: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_admin_user),
):
    _ = current_user

    item = get_activity_log_detail(
        session,
        log_id=log_id,
    )

    if item is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="日志不存在",
        )

    return item
