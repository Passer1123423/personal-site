import os
from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException, UploadFile, status
from sqlmodel import Session, col, select

from app.models import (
    Asset,
    Comment,
    CommentImage,
    ComicChapter,
    ComicPart,
    Novel,
    NovelChapter,
    User,
    now_utc,
)

from app.services.user_profile import get_avatar_url
from app.services.outbox_service import create_outbox_event
from app.services.assets import build_asset

ACTIVE_COMMENT_TARGET_TYPES = {
    "user_page",
    "novel",
    "novel_chapter",
    "comic_part",
    "comic_chapter",
}

MAX_COMMENT_LENGTH = 1000
MAX_COMMENT_QUERY_LIMIT = 200

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
IMAGE_MIME_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
}

MAX_COMMENT_IMAGE_COUNT = 9
MAX_COMMENT_IMAGE_SIZE_BYTES = 10 * 1024 * 1024
MAX_COMMENT_IMAGE_TOTAL_SIZE_BYTES = 30 * 1024 * 1024

BACKEND_DIR = Path(__file__).resolve().parents[2]
UPLOADS_DIR = Path(os.getenv("UPLOADS_DIR", BACKEND_DIR / "uploads")).resolve()
COMMENT_IMAGE_ROOT = UPLOADS_DIR / "interactions" / "comments"

def build_comment_content_preview(content: str, limit: int = 80) -> str:
    preview = " ".join(content.split())

    if len(preview) <= limit:
        return preview

    return f"{preview[:limit]}..."

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

def clean_original_filename(filename: str | None) -> str:
    if not filename:
        return "unnamed"

    normalized = filename.replace("\\", "/")
    name = Path(normalized).name.strip()

    if not name:
        return "unnamed"

    return name


def guess_mime_type_by_suffix(filename: str) -> str:
    suffix = Path(filename).suffix.lower()

    if suffix in {".jpg", ".jpeg"}:
        return "image/jpeg"

    if suffix == ".png":
        return "image/png"

    if suffix == ".webp":
        return "image/webp"

    if suffix == ".gif":
        return "image/gif"

    return "application/octet-stream"


def validate_comment_image_filename(filename: str | None) -> str:
    original_name = clean_original_filename(filename)

    if ":Zone.Identifier" in original_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"非法文件名：{original_name}",
        )

    suffix = Path(original_name).suffix.lower()

    if suffix not in IMAGE_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"评论图片只支持 jpg、jpeg、png、webp、gif：{original_name}",
        )

    return original_name


def normalize_optional_id(value: str | None) -> str | None:
    if value is None:
        return None

    clean_value = value.strip()
    return clean_value or None


def build_comment_image_dir(comment: Comment) -> Path:
    return COMMENT_IMAGE_ROOT / comment.target_type / comment.target_id / comment.id


def build_comment_image_url(comment: Comment, filename: str) -> str:
    return (
        f"/uploads/interactions/comments/"
        f"{comment.target_type}/"
        f"{comment.target_id}/"
        f"{comment.id}/"
        f"{filename}"
    )


def get_asset_file_path(asset: Asset) -> Path | None:
    prefix = "/uploads/"

    if not asset.url.startswith(prefix):
        return None

    relative_path = Path(asset.url.removeprefix(prefix))

    if relative_path.is_absolute() or ".." in relative_path.parts:
        raise ValueError("asset 文件路径非法")

    return UPLOADS_DIR / relative_path


def serialize_comment_image(image: CommentImage, asset: Asset | None) -> dict | None:
    if not asset:
        return None

    return {
        "id": image.id,
        "asset_id": asset.id,
        "url": asset.url,
        "original_name": asset.original_name,
        "mime_type": asset.mime_type,
        "size": asset.size,
        "display_order": image.display_order,
        "created_at": image.created_at,
    }


def list_comment_images(
    session: Session,
    comment_id: str,
) -> list[dict]:
    images = session.exec(
        select(CommentImage)
        .where(CommentImage.comment_id == comment_id)
        .order_by(CommentImage.display_order, CommentImage.created_at)
    ).all()

    result: list[dict] = []

    for image in images:
        asset = session.get(Asset, image.asset_id)
        item = serialize_comment_image(image, asset)
        if item:
            result.append(item)

    return result


def count_comment_images(
    session: Session,
    comment_ids: list[str],
) -> dict[str, int]:
    counts = {comment_id: 0 for comment_id in comment_ids}

    if not comment_ids:
        return counts

    images = session.exec(
        select(CommentImage).where(col(CommentImage.comment_id).in_(comment_ids))
    ).all()

    for image in images:
        if image.comment_id in counts:
            counts[image.comment_id] += 1

    return counts

async def save_comment_images(
    session: Session,
    *,
    comment: Comment,
    image_files: list[UploadFile],
) -> None:
    if not image_files:
        return

    if comment.parent_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="只有父级评论可以带图片",
        )

    if len(image_files) > MAX_COMMENT_IMAGE_COUNT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"一条评论最多上传 {MAX_COMMENT_IMAGE_COUNT} 张图片",
        )

    image_dir = build_comment_image_dir(comment)
    image_dir.mkdir(parents=True, exist_ok=True)

    saved_paths: list[Path] = []
    total_size = 0

    try:
        for index, upload_file in enumerate(image_files, start=1):
            original_name = validate_comment_image_filename(upload_file.filename)
            suffix = Path(original_name).suffix.lower()
            guessed_mime_type = guess_mime_type_by_suffix(original_name)
            normalized_content_type = (
                upload_file.content_type or guessed_mime_type
            ).split(";")[0].strip().lower()

            if normalized_content_type not in IMAGE_MIME_TYPES:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"评论图片文件类型不合法：{original_name}",
                )

            filename = f"{index:02d}-{uuid4()}{suffix}"
            target_path = image_dir / filename
            written_size = 0

            await upload_file.seek(0)

            with target_path.open("wb") as f:
                while True:
                    chunk = await upload_file.read(1024 * 1024)

                    if not chunk:
                        break

                    written_size += len(chunk)
                    total_size += len(chunk)

                    if written_size > MAX_COMMENT_IMAGE_SIZE_BYTES:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail=f"单张评论图片不能超过 10MB：{original_name}",
                        )

                    if total_size > MAX_COMMENT_IMAGE_TOTAL_SIZE_BYTES:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail="单条评论图片总大小不能超过 30MB",
                        )

                    f.write(chunk)

            if written_size <= 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"评论图片不能为空：{original_name}",
                )

            saved_paths.append(target_path)

            asset = build_asset(
                filename=filename,
                original_name=original_name,
                mime_type=normalized_content_type,
                size=written_size,
                url=build_comment_image_url(comment, filename),
                usage="comment_image",
            )

            session.add(asset)
            session.flush()

            comment_image = CommentImage(
                comment_id=comment.id,
                asset_id=asset.id,
                display_order=index,
            )

            session.add(comment_image)

        session.flush()

    except Exception:
        for path in saved_paths:
            if path.exists():
                path.unlink()

        if image_dir.exists() and not any(image_dir.iterdir()):
            image_dir.rmdir()

        raise


def delete_comment_images(
    session: Session,
    *,
    comment_id: str,
) -> None:
    images = session.exec(
        select(CommentImage).where(CommentImage.comment_id == comment_id)
    ).all()

    touched_dirs: set[Path] = set()

    for image in images:
        asset = session.get(Asset, image.asset_id)

        if asset:
            file_path = get_asset_file_path(asset)

            if file_path:
                touched_dirs.add(file_path.parent)

                if file_path.exists():
                    file_path.unlink()

            session.delete(asset)

        session.delete(image)

    for image_dir in sorted(touched_dirs, key=lambda path: len(path.parts), reverse=True):
        current_dir = image_dir

        # 最多向上清理到：
        # uploads/interactions/comments/{target_type}/{target_id}
        for _ in range(2):
            if current_dir.exists() and current_dir.is_dir() and not any(current_dir.iterdir()):
                current_dir.rmdir()
                current_dir = current_dir.parent
            else:
                break

def hard_delete_comments_for_target(
    session: Session,
    *,
    target_type: str,
    target_id: str,
    commit: bool = False,
) -> int:
    comments = session.exec(
        select(Comment)
        .where(Comment.target_type == target_type)
        .where(Comment.target_id == target_id)
    ).all()

    if not comments:
        if commit:
            session.commit()
        return 0

    comments_by_id = {comment.id: comment for comment in comments}

    child_count_by_id = {comment.id: 0 for comment in comments}

    for comment in comments:
        if comment.parent_id and comment.parent_id in child_count_by_id:
            child_count_by_id[comment.parent_id] += 1

    ordered_comments: list[Comment] = []
    remaining = set(comments_by_id.keys())

    while remaining:
        leaf_ids = [
            comment_id
            for comment_id in remaining
            if child_count_by_id.get(comment_id, 0) == 0
        ]

        if not leaf_ids:
            # 理论上正常评论树不应该走到这里。
            # 如果数据异常形成环，就按创建时间倒序兜底，避免死循环。
            fallback_comments = [
                comments_by_id[comment_id]
                for comment_id in remaining
            ]
            fallback_comments.sort(key=lambda comment: comment.created_at, reverse=True)
            ordered_comments.extend(fallback_comments)
            break

        for comment_id in leaf_ids:
            comment = comments_by_id[comment_id]
            ordered_comments.append(comment)
            remaining.remove(comment_id)

            if comment.parent_id and comment.parent_id in child_count_by_id:
                child_count_by_id[comment.parent_id] -= 1

    deleted_count = 0

    for comment in ordered_comments:
        delete_comment_images(
            session=session,
            comment_id=comment.id,
        )

        session.delete(comment)
        deleted_count += 1

    if commit:
        session.commit()

    return deleted_count

def serialize_comment(
    comment: Comment,
    *,
    session: Session,
    users_by_id: dict[str, User],
    reveal_deleted_content: bool,
) -> dict:
    user = users_by_id.get(comment.user_id)

    content = comment.content
    if comment.is_deleted and not reveal_deleted_content:
        content = ""

    images = [] if comment.is_deleted and not reveal_deleted_content else list_comment_images(
        session,
        comment.id,
    )

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
            "avatar_url": get_avatar_url(session, user),
        } if user else None,
        "content": content,
        "images": images,
        "parent_id": comment.parent_id,
        "reply_to_id": comment.reply_to_id,
        "is_deleted": comment.is_deleted,
        "created_at": comment.created_at,
        "updated_at": comment.updated_at,
        "children": [],
    }


def build_comment_tree(
    comments: list[Comment],
    *,
    session: Session,
    users_by_id: dict[str, User],
    reveal_deleted_content: bool,
    root_limit: int,
    root_offset: int,
) -> list[dict]:
    items = [
        serialize_comment(
            comment,
            session=session,
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
            session=session,
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

        def find_root_containing_node(
                roots: list[dict],
                target_comment_id: str,
        ) -> dict | None:
            for root in roots:
                if find_node([root], target_comment_id):
                    return root

            return None

        root = find_root_containing_node(all_roots, comment_id)
        return [root] if root else []

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
        session=session,
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
        session=session,
        users_by_id=users_by_id,
        reveal_deleted_content=reveal_deleted_content,
    )


async def create_comment(
    session: Session,
    *,
    user: User,
    target_type: str,
    target_id: str,
    content: str,
    parent_id: str | None = None,
    reply_to_id: str | None = None,
    image_files: list[UploadFile] | None = None,
) -> dict:
    parent_id = normalize_optional_id(parent_id)
    reply_to_id = normalize_optional_id(reply_to_id)
    image_files = image_files or []

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

    final_parent_id = parent_id
    final_reply_to_id = reply_to_id

    if parent_id:
        parent = get_comment_or_404(session, parent_id)

        if image_files:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="只有父级评论可以带图片",
            )

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

        # 所有回复统一归到一级评论下面。
        final_parent_id = parent.parent_id or parent.id

        # 如果前端没传 reply_to_id，兼容旧逻辑：认为实际回复目标就是 parent_id。
        if not final_reply_to_id:
            final_reply_to_id = parent.id

        reply_to = get_comment_or_404(session, final_reply_to_id)

        if reply_to.target_type != target_type or reply_to.target_id != target_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="回复目标必须属于同一个评论区",
            )

        if reply_to.is_deleted:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="不能回复已删除的评论",
            )

        reply_to_root_id = reply_to.parent_id or reply_to.id

        if reply_to_root_id != final_parent_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="回复目标不属于同一个一级评论",
            )
    elif reply_to_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="reply_to_id 不能单独使用",
        )

    comment = Comment(
        target_type=target_type,
        target_id=target_id,
        user_id=user.id,
        content=clean_content,
        parent_id=final_parent_id,
        reply_to_id=final_reply_to_id,
        is_deleted=False,
        created_at=now_utc(),
        updated_at=now_utc(),
    )

    try:
        session.add(comment)
        session.flush()

        await save_comment_images(
            session=session,
            comment=comment,
            image_files=image_files,
        )

        image_count = len(image_files)

        create_outbox_event(
            session,
            event_type="comment.created",
            aggregate_type="comment",
            aggregate_id=comment.id,
            actor_user_id=user.id,
            payload={
                "comment_id": comment.id,
                "actor_user_id": user.id,
                "target_type": comment.target_type,
                "target_id": comment.target_id,
                "parent_id": comment.parent_id,
                "reply_to_id": comment.reply_to_id,
                "root_comment_id": comment.parent_id or comment.id,
                "content_preview": build_comment_content_preview(comment.content),
                "image_count": image_count,
                "created_at": comment.created_at,
            },
            dedupe_key=f"comment.created:{comment.id}",
        )

        session.commit()
        session.refresh(comment)

    except Exception:
        session.rollback()
        raise

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

    delete_comment_images(
        session=session,
        comment_id=comment.id,
    )

    session.delete(comment)
    session.commit()


def serialize_admin_comment_list_item(
    comment: Comment,
    *,
    users_by_id: dict[str, User],
    reply_count: int,
    image_count: int = 0,
    reveal_deleted_content: bool = True,
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
        "reply_count": reply_count,
        "image_count": image_count,
        "created_at": comment.created_at,
        "updated_at": comment.updated_at,
    }


def list_admin_comments(
    session: Session,
    *,
    keyword: str | None = None,
    target_type: str | None = None,
    target_id: str | None = None,
    user_id: str | None = None,
    include_deleted: bool = True,
    only_deleted: bool = False,
    has_replies: bool | None = None,
    sort: str = "newest",
    limit: int = 50,
    offset: int = 0,
) -> dict:
    page_limit = clamp_comment_limit(limit)
    page_offset = max(0, offset)

    query = select(Comment)

    clean_keyword = keyword.strip() if keyword else ""
    if clean_keyword:
        query = query.where(Comment.content.contains(clean_keyword))

    if target_type:
        query = query.where(Comment.target_type == target_type)

    if target_id:
        query = query.where(Comment.target_id == target_id)

    if user_id:
        query = query.where(Comment.user_id == user_id)

    if only_deleted:
        query = query.where(Comment.is_deleted == True)  # noqa: E712
    elif not include_deleted:
        query = query.where(Comment.is_deleted == False)  # noqa: E712

    comments = session.exec(query).all()

    comment_ids = [comment.id for comment in comments]
    reply_counts_by_id = {comment_id: 0 for comment_id in comment_ids}
    image_counts_by_id = count_comment_images(session, comment_ids)

    if comment_ids:
        children = session.exec(
            select(Comment).where(col(Comment.parent_id).in_(comment_ids))
        ).all()

        for child in children:
            if child.parent_id in reply_counts_by_id:
                reply_counts_by_id[child.parent_id] += 1

    if has_replies is True:
        comments = [
            comment
            for comment in comments
            if reply_counts_by_id.get(comment.id, 0) > 0
        ]
    elif has_replies is False:
        comments = [
            comment
            for comment in comments
            if reply_counts_by_id.get(comment.id, 0) == 0
        ]

    if sort == "oldest":
        comments.sort(key=lambda comment: comment.created_at)
    elif sort == "reply_count_desc":
        comments.sort(
            key=lambda comment: (
                reply_counts_by_id.get(comment.id, 0),
                comment.created_at,
            ),
            reverse=True,
        )
    else:
        comments.sort(key=lambda comment: comment.created_at, reverse=True)

    total = len(comments)
    page_comments = comments[page_offset: page_offset + page_limit]

    users_by_id = load_users_for_comments(session, page_comments)

    return {
        "items": [
            serialize_admin_comment_list_item(
                comment,
                users_by_id=users_by_id,
                reply_count=reply_counts_by_id.get(comment.id, 0),
                image_count=image_counts_by_id.get(comment.id, 0),
                reveal_deleted_content=True,
            )
            for comment in page_comments
        ],
        "total": total,
        "limit": page_limit,
        "offset": page_offset,
    }
