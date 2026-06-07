from fastapi import APIRouter, Depends, Query, Request
from sqlmodel import Session

from app.database import get_session
from app.dependencies.auth import require_admin_user
from app.models import User
from app.services.interactions import (
    admin_hard_delete_comment,
    admin_soft_delete_comment,
    get_comment_detail,
    list_admin_comments,
    list_comment_tree,
)
from app.services.activity_logs import log_activity

router = APIRouter(
    prefix="/api/admin/interactions",
    tags=["admin-interactions"],
)

@router.get("/comments")
def admin_list_comments(
    keyword: str | None = Query(default=None),
    target_type: str | None = Query(default=None),
    target_id: str | None = Query(default=None),
    user_id: str | None = Query(default=None),
    include_deleted: bool = Query(default=True),
    only_deleted: bool = Query(default=False),
    has_replies: bool | None = Query(default=None),
    sort: str = Query(default="newest"),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_admin_user),
):
    _ = current_user

    return list_admin_comments(
        session,
        keyword=keyword,
        target_type=target_type,
        target_id=target_id,
        user_id=user_id,
        include_deleted=include_deleted,
        only_deleted=only_deleted,
        has_replies=has_replies,
        sort=sort,
        limit=limit,
        offset=offset,
    )

@router.get("/comments/tree")
def admin_read_comment_tree(
    comment_id: str | None = Query(default=None),
    target_type: str | None = Query(default=None),
    target_id: str | None = Query(default=None),
    user_id: str | None = Query(default=None),
    include_deleted: bool = Query(default=True),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_admin_user),
):
    _ = current_user

    return list_comment_tree(
        session,
        comment_id=comment_id,
        target_type=target_type,
        target_id=target_id,
        user_id=user_id,
        include_deleted=include_deleted,
        reveal_deleted_content=True,
        limit=limit,
        offset=offset,
    )

@router.get("/comments/{comment_id}")
def admin_read_comment_detail(
    comment_id: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_admin_user),
):
    _ = current_user

    return get_comment_detail(
        session,
        comment_id=comment_id,
        reveal_deleted_content=True,
    )

@router.delete("/comments/{comment_id}")
def admin_soft_delete_comment_route(
    request: Request,
    comment_id: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_admin_user),
):
    result = admin_soft_delete_comment(
        session,
        comment_id=comment_id,
    )

    log_activity(
        session,
        actor=current_user,
        action="comment.delete.admin_soft",
        category="comment",
        target_type="comment",
        target_id=result.get("id"),
        target_label=(result.get("content") or "")[:80],
        status="success",
        message="管理员软删除评论",
        metadata={
            "comment_id": result.get("id"),
            "comment_target_type": result.get("target_type"),
            "comment_target_id": result.get("target_id"),
            "comment_user_id": result.get("user_id"),
            "parent_id": result.get("parent_id"),
        },
        request=request,
    )

    return result

@router.delete("/comments/{comment_id}/hard")
def admin_hard_delete_comment_route(
    request: Request,
    comment_id: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_admin_user),
):
    before_delete = get_comment_detail(
        session,
        comment_id=comment_id,
        reveal_deleted_content=True,
    )

    admin_hard_delete_comment(
        session,
        comment_id=comment_id,
    )

    log_activity(
        session,
        actor=current_user,
        action="comment.delete.admin_hard",
        category="comment",
        target_type="comment",
        target_id=comment_id,
        target_label=(before_delete.get("content") or "")[:80],
        status="success",
        message="管理员硬删除评论",
        metadata={
            "comment_id": comment_id,
            "comment_target_type": before_delete.get("target_type"),
            "comment_target_id": before_delete.get("target_id"),
            "comment_user_id": before_delete.get("user_id"),
            "parent_id": before_delete.get("parent_id"),
        },
        request=request,
    )

    return {
        "deleted": True,
        "comment_id": comment_id,
    }