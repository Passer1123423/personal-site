from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import Session

from app.database import get_session
from app.dependencies.auth import require_current_user
from app.models import User
from app.services.notification_service import (
    count_unread_notifications_for_user,
    delete_notification_for_user,
    list_notifications_for_user,
    mark_all_notifications_read,
    mark_notification_read,
    serialize_notification,
)


router = APIRouter(
    prefix="/api/notifications",
    tags=["notifications"],
)


@router.get("")
def read_notifications(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    unread_only: bool = Query(default=False),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_current_user),
):
    return list_notifications_for_user(
        session,
        user_id=current_user.id,
        limit=limit,
        offset=offset,
        unread_only=unread_only,
    )


@router.get("/unread-count")
def read_unread_notification_count(
    session: Session = Depends(get_session),
    current_user: User = Depends(require_current_user),
):
    count = count_unread_notifications_for_user(
        session,
        user_id=current_user.id,
    )

    return {
        "count": count,
    }


@router.post("/{notification_id}/read")
def read_notification(
    notification_id: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_current_user),
):
    notification = mark_notification_read(
        session,
        notification_id=notification_id,
        user_id=current_user.id,
    )

    if notification is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="通知不存在",
        )

    return serialize_notification(notification)


@router.delete("/{notification_id}")
def delete_notification(
    notification_id: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_current_user),
):
    deleted = delete_notification_for_user(
        session,
        notification_id=notification_id,
        user_id=current_user.id,
    )

    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="通知不存在",
        )

    return {
        "deleted": True,
        "notificationId": notification_id,
    }

@router.post("/read-all")
def read_all_notifications(
    session: Session = Depends(get_session),
    current_user: User = Depends(require_current_user),
):
    count = mark_all_notifications_read(
        session,
        user_id=current_user.id,
    )

    return {
        "updatedCount": count,
    }
