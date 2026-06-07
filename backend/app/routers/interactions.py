from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, File, Form, Query, Request, UploadFile
from sqlmodel import Session

from app.database import get_session
from app.dependencies.auth import require_current_user
from app.models import User
from app.services.interactions import (
    create_comment,
    list_comment_tree,
    soft_delete_own_comment,
)
from app.services.activity_logs import log_activity


router = APIRouter(
    prefix="/api/interactions",
    tags=["interactions"],
)

@router.get("/comments/tree")
def read_comment_tree(
    target_type: str = Query(..., min_length=1, max_length=50),
    target_id: str = Query(..., min_length=1),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    session: Session = Depends(get_session),
):
    return list_comment_tree(
        session,
        target_type=target_type,
        target_id=target_id,
        include_deleted=True,
        reveal_deleted_content=False,
        limit=limit,
        offset=offset,
    )

@router.post("/comments")
async def post_comment(
    request: Request,
    target_type: str = Form(..., min_length=1, max_length=50),
    target_id: str = Form(..., min_length=1),
    content: str = Form(..., min_length=1, max_length=1000),
    parent_id: str | None = Form(default=None),
    reply_to_id: str | None = Form(default=None),
    images: list[UploadFile] = File(default=[]),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_current_user),
):
    result = await create_comment(
        session,
        user=current_user,
        target_type=target_type,
        target_id=target_id,
        content=content,
        parent_id=parent_id,
        reply_to_id=reply_to_id,
        image_files=images,
    )

    is_reply = bool(result.get("parent_id"))
    image_count = len(result.get("images") or [])

    log_activity(
        session,
        actor=current_user,
        action="comment.reply" if is_reply else "comment.create",
        category="comment",
        target_type="comment",
        target_id=result.get("id"),
        target_label=(result.get("content") or "")[:80],
        status="success",
        message="回复评论成功" if is_reply else "发表评论成功",
        metadata={
            "comment_id": result.get("id"),
            "comment_target_type": result.get("target_type"),
            "comment_target_id": result.get("target_id"),
            "parent_id": result.get("parent_id"),
            "reply_to_id": result.get("reply_to_id"),
            "image_count": image_count,
        },
        request=request,
    )

    if image_count > 0:
        log_activity(
            session,
            actor=current_user,
            action="comment_image.upload",
            category="comment_image",
            target_type="comment",
            target_id=result.get("id"),
            target_label=(result.get("content") or "")[:80],
            status="success",
            message=f"上传评论图片 {image_count} 张",
            metadata={
                "comment_id": result.get("id"),
                "image_count": image_count,
                "comment_target_type": result.get("target_type"),
                "comment_target_id": result.get("target_id"),
            },
            request=request,
        )

    return result


@router.delete("/comments/{comment_id}")
def delete_own_comment(
    request: Request,
    comment_id: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_current_user),
):
    result = soft_delete_own_comment(
        session,
        comment_id=comment_id,
        user=current_user,
    )

    log_activity(
        session,
        actor=current_user,
        action="comment.delete.self",
        category="comment",
        target_type="comment",
        target_id=result.get("id"),
        target_label=(result.get("content") or "")[:80],
        status="success",
        message="用户删除自己的评论",
        metadata={
            "comment_id": result.get("id"),
            "comment_target_type": result.get("target_type"),
            "comment_target_id": result.get("target_id"),
            "parent_id": result.get("parent_id"),
        },
        request=request,
    )

    return result
