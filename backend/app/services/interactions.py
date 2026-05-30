from fastapi import HTTPException, status
from sqlmodel import Session, col, select

from app.models import (
    Comment,
    ComicChapter,
    ComicPart,
    Novel,
    NovelChapter,
    User,
    now_utc,
)


ACTIVE_COMMENT_TARGET_TYPES = {
    "user_page",
    "novel",
    "novel_chapter",
    # 先预留。即使前端暂时不用，后端目标校验已经能支持。
    "comic_part",
    "comic_chapter",
}

MAX_COMMENT_LENGTH = 1000
MAX_COMMENT_QUERY_LIMIT = 200


def clamp_comment_limit(limit: int) -> int:
    return max(1, min(limit, MAX_COMMENT_QUERY_LIMIT))


def get_comment_or_404(session: Session, comment_id: str) -> Comment:
    comment = session.get(Comment, comment_id)
    if comment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="评论不存在",
        )
    return comment


def validate_comment_target(
    session: Session,
    *,
    target_type: str,
    target_id: str,
) -> None:
    if target_type not in ACTIVE_COMMENT_TARGET_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="不支持的评论目标类型",
        )

    target = None

    if target_type == "user_page":
        target = session.get(User, target_id)

    elif target_type == "novel":
        target = session.get(Novel, target_id)

    elif target_type == "novel_chapter":
        target = session.get(NovelChapter, target_id)

    elif target_type == "comic_part":
        target = session.get(ComicPart, target_id)

    elif target_type == "comic_chapter":
        target = session.get(ComicChapter, target_id)

    if target is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="评论目标不存在",
        )


def serialize_comment(
    comment: Comment,
    *,
    users_by_id: dict[str, User],
    reveal_deleted_content: bool,
) -> dict:
    user = users_by_id.get(comment.user_id)

    content = comment.content
    if comment.is_deleted and not reveal_deleted_content:
        content = ""

    return {
        "id": comment.id,
        "target_type": comment.target_type,
        "target_id": comment.target_id,
        "user_id": comment.user_id,
        "user": {
            "id": user.id,
            "username": user.username,
            "display_name": user.display_name,
            "role": user.role,
        } if user else None,
        "content": content,
        "parent_id": comment.parent_id,
        "is_deleted": comment.is_deleted,
        "created_at": comment.created_at,
        "updated_at": comment.updated_at,
        "children": [],
    }


def build_comment_tree(
    comments: list[Comment],
    *,
    users_by_id: dict[str, User],
    reveal_deleted_content: bool,
    root_limit: int,
    root_offset: int,
) -> list[dict]:
    items = [
        serialize_comment(
            comment,
            users_by_id=users_by_id,
            reveal_deleted_content=reveal_deleted_content,
        )
        for comment in comments
    ]

    items_by_id = {item["id"]: item for item in items}
    roots: list[dict] = []

    for item in items:
        parent_id = item["parent_id"]

        if parent_id and parent_id in items_by_id:
            items_by_id[parent_id]["children"].append(item)
        else:
            roots.append(item)

    return roots[root_offset: root_offset + root_limit]


def load_users_for_comments(
    session: Session,
    comments: list[Comment],
) -> dict[str, User]:
    user_ids = {comment.user_id for comment in comments if comment.user_id}

    if not user_ids:
        return {}

    users = session.exec(
        select(User).where(col(User.id).in_(user_ids))
    ).all()

    return {user.id: user for user in users}


def list_comment_tree(
    session: Session,
    *,
    comment_id: str | None = None,
    target_type: str | None = None,
    target_id: str | None = None,
    user_id: str | None = None,
    include_deleted: bool = True,
    reveal_deleted_content: bool = False,
    limit: int = 50,
    offset: int = 0,
) -> list[dict]:
    root_limit = clamp_comment_limit(limit)
    root_offset = max(0, offset)

    # 按单条评论定位时：返回这条评论在所属 target 下的子树。
    if comment_id:
        anchor = get_comment_or_404(session, comment_id)

        query = select(Comment).where(
            Comment.target_type == anchor.target_type,
            Comment.target_id == anchor.target_id,
        )

        if not include_deleted:
            query = query.where(Comment.is_deleted == False)  # noqa: E712

        comments = session.exec(
            query.order_by(Comment.created_at)
        ).all()

        users_by_id = load_users_for_comments(session, comments)

        all_roots = build_comment_tree(
            comments,
            users_by_id=users_by_id,
            reveal_deleted_content=reveal_deleted_content,
            root_limit=MAX_COMMENT_QUERY_LIMIT,
            root_offset=0,
        )

        def find_node(nodes: list[dict], target_comment_id: str) -> dict | None:
            for node in nodes:
                if node["id"] == target_comment_id:
                    return node
                found = find_node(node["children"], target_comment_id)
                if found:
                    return found
            return None

        node = find_node(all_roots, comment_id)
        return [node] if node else []

    query = select(Comment)

    if target_type:
        query = query.where(Comment.target_type == target_type)

    if target_id:
        query = query.where(Comment.target_id == target_id)

    if user_id:
        query = query.where(Comment.user_id == user_id)

    if not include_deleted:
        query = query.where(Comment.is_deleted == False)  # noqa: E712

    comments = session.exec(
        query.order_by(Comment.created_at)
    ).all()

    users_by_id = load_users_for_comments(session, comments)

    return build_comment_tree(
        comments,
        users_by_id=users_by_id,
        reveal_deleted_content=reveal_deleted_content,
        root_limit=root_limit,
        root_offset=root_offset,
    )


def get_comment_detail(
    session: Session,
    *,
    comment_id: str,
    reveal_deleted_content: bool,
) -> dict:
    comment = get_comment_or_404(session, comment_id)
    users_by_id = load_users_for_comments(session, [comment])

    return serialize_comment(
        comment,
        users_by_id=users_by_id,
        reveal_deleted_content=reveal_deleted_content,
    )


def create_comment(
    session: Session,
    *,
    user: User,
    target_type: str,
    target_id: str,
    content: str,
    parent_id: str | None = None,
) -> dict:
    validate_comment_target(
        session,
        target_type=target_type,
        target_id=target_id,
    )

    clean_content = content.strip()

    if not clean_content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="评论内容不能为空",
        )

    if len(clean_content) > MAX_COMMENT_LENGTH:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"评论内容不能超过 {MAX_COMMENT_LENGTH} 字",
        )

    if parent_id:
        parent = get_comment_or_404(session, parent_id)

        if parent.target_type != target_type or parent.target_id != target_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="回复目标必须属于同一个评论区",
            )

        if parent.is_deleted:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="不能回复已删除的评论",
            )

    comment = Comment(
        target_type=target_type,
        target_id=target_id,
        user_id=user.id,
        content=clean_content,
        parent_id=parent_id,
        is_deleted=False,
        created_at=now_utc(),
        updated_at=now_utc(),
    )

    session.add(comment)
    session.commit()
    session.refresh(comment)

    return get_comment_detail(
        session,
        comment_id=comment.id,
        reveal_deleted_content=False,
    )


def soft_delete_own_comment(
    session: Session,
    *,
    comment_id: str,
    user: User,
) -> dict:
    comment = get_comment_or_404(session, comment_id)

    if comment.user_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="只能删除自己的评论",
        )

    comment.is_deleted = True
    comment.updated_at = now_utc()

    session.add(comment)
    session.commit()
    session.refresh(comment)

    return get_comment_detail(
        session,
        comment_id=comment.id,
        reveal_deleted_content=False,
    )


def admin_soft_delete_comment(
    session: Session,
    *,
    comment_id: str,
) -> dict:
    comment = get_comment_or_404(session, comment_id)

    comment.is_deleted = True
    comment.updated_at = now_utc()

    session.add(comment)
    session.commit()
    session.refresh(comment)

    return get_comment_detail(
        session,
        comment_id=comment.id,
        reveal_deleted_content=True,
    )


def admin_hard_delete_comment(
    session: Session,
    *,
    comment_id: str,
) -> None:
    comment = get_comment_or_404(session, comment_id)

    child = session.exec(
        select(Comment).where(Comment.parent_id == comment.id)
    ).first()

    if child:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="该评论下还有回复，请先处理子评论",
        )

    session.delete(comment)
    session.commit()
