from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, Query
from sqlmodel import Session

from app.database import get_session
from app.dependencies.auth import require_current_user
from app.models import User
from app.services.interactions import (
    create_comment,
    list_comment_tree,
    soft_delete_own_comment,
)


router = APIRouter(
    prefix="/api/interactions",
    tags=["interactions"],
)


class CommentCreateRequest(BaseModel):
    target_type: str = Field(min_length=1, max_length=50)
    target_id: str = Field(min_length=1)
    content: str = Field(min_length=1, max_length=1000)
    parent_id: str | None = None


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
def post_comment(
    payload: CommentCreateRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_current_user),
):
    return create_comment(
        session,
        user=current_user,
        target_type=payload.target_type,
        target_id=payload.target_id,
        content=payload.content,
        parent_id=payload.parent_id,
    )


@router.delete("/comments/{comment_id}")
def delete_own_comment(
    comment_id: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_current_user),
):
    return soft_delete_own_comment(
        session,
        comment_id=comment_id,
        user=current_user,
    )
