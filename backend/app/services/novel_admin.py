import os
import logging
import re
from pathlib import Path
from shutil import copy2
from uuid import uuid4

from sqlalchemy import func
from sqlmodel import Session, select

from app.models import (
    Asset,
    Novel,
    NovelChapter,
    NovelChapterImage,
    NovelUserLink,
    User,
    now_utc,
)
from app.services.interactions import hard_delete_comments_for_target
from fastapi import UploadFile


logger = logging.getLogger(__name__)

# ===== 文件识别 =====
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
BACKEND_DIR = Path(__file__).resolve().parents[2]
UPLOADS_DIR = Path(os.getenv("UPLOADS_DIR", BACKEND_DIR / "uploads")).resolve()
UPLOADS_ROOT = UPLOADS_DIR / "novels"

IMAGE_MIME_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
}

MAX_NOVEL_CHAPTER_IMAGE_COUNT = 20
MAX_NOVEL_CHAPTER_IMAGE_SIZE_BYTES = 10 * 1024 * 1024


def guess_mime_type(path: Path) -> str:
    suffix = path.suffix.lower()

    if suffix in {".jpg", ".jpeg"}:
        return "image/jpeg"

    if suffix == ".png":
        return "image/png"

    if suffix == ".webp":
        return "image/webp"

    if suffix == ".gif":
        return "image/gif"

    return "application/octet-stream"

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


def validate_novel_chapter_image_filename(filename: str | None) -> str:
    original_name = clean_original_filename(filename)

    if ":Zone.Identifier" in original_name:
        raise ValueError(f"非法文件名：{original_name}")

    suffix = Path(original_name).suffix.lower()

    if suffix not in IMAGE_EXTENSIONS:
        raise ValueError(f"章节正文图片只支持 jpg、jpeg、png、webp、gif：{original_name}")

    return original_name


def get_novel_chapter_image_dir(
    novel_slug: str,
    chapter_slug: str,
) -> Path:
    return UPLOADS_ROOT / novel_slug / chapter_slug / "images"


def build_novel_chapter_image_url(
    novel_slug: str,
    chapter_slug: str,
    filename: str,
) -> str:
    return f"/uploads/novels/{novel_slug}/{chapter_slug}/images/{filename}"


def build_novel_chapter_image_markdown(asset: Asset) -> str:
    alt = Path(asset.original_name).stem or "图片"
    return f"![{alt}]({asset.url})"


def get_novel_chapter_asset_path(asset: Asset) -> Path | None:
    prefix = "/uploads/novels/"

    if not asset.url.startswith(prefix):
        return None

    relative_path = Path(asset.url.removeprefix(prefix))

    if relative_path.is_absolute() or ".." in relative_path.parts:
        raise ValueError("章节图片文件路径非法")

    return UPLOADS_ROOT / relative_path

# ===== 标题 =====
def get_chapter_custom_title(title: str | None) -> str:
    if not title:
        return ""

    return re.sub(
        r"^第\s*\d+\s*章\s*",
        "",
        title,
        count=1,
    ).strip()


def build_chapter_title(
    display_order: int,
    custom_title: str | None,
) -> str:
    custom_title = (custom_title or "").strip()

    if custom_title:
        return f"第{display_order}章 {custom_title}"

    return f"第{display_order}章"


def update_chapter_order_title(
    title: str,
    new_order: int,
) -> str:
    custom_title = get_chapter_custom_title(title)

    return build_chapter_title(
        display_order=new_order,
        custom_title=custom_title,
    )


# ===== 仅获取 / 没有时返回 =====
def get_novel(
    session: Session,
    novel: Novel | None = None,
    novel_id: str | None = None,
    novel_slug: str | None = None,
) -> Novel:
    if novel:
        return novel

    if novel_id:
        statement = select(Novel).where(Novel.id == novel_id)
        novel = session.exec(statement).first()
    elif novel_slug:
        statement = select(Novel).where(Novel.slug == novel_slug)
        novel = session.exec(statement).first()
    else:
        raise ValueError("未输入有效 novel_id / novel_slug")

    if not novel:
        raise ValueError("未找到目标 novel")

    return novel


def get_novel_by_id(
    session: Session,
    novel_id: str,
) -> Novel:
    return get_novel(
        session=session,
        novel_id=novel_id,
    )


def get_novel_by_slug(
    session: Session,
    novel_slug: str,
) -> Novel:
    return get_novel(
        session=session,
        novel_slug=novel_slug,
    )


def get_chapter(
    session: Session,
    chapter: NovelChapter | None = None,
    chapter_id: str | None = None,
    novel: Novel | None = None,
    novel_id: str | None = None,
    novel_slug: str | None = None,
    chapter_slug: str | None = None,
) -> NovelChapter:
    if chapter_id:
        statement = select(NovelChapter).where(NovelChapter.id == chapter_id)
        chapter = session.exec(statement).first()

    if chapter:
        return chapter

    if not chapter_slug:
        raise ValueError("未输入有效 chapter_id / chapter_slug")

    novel = get_novel(
        session=session,
        novel=novel,
        novel_id=novel_id,
        novel_slug=novel_slug,
    )

    statement = (
        select(NovelChapter)
        .where(NovelChapter.novel_id == novel.id)
        .where(NovelChapter.slug == chapter_slug)
    )
    chapter = session.exec(statement).first()

    if not chapter:
        raise ValueError("未找到目标 chapter")

    return chapter


def get_chapter_by_id(
    session: Session,
    chapter_id: str,
) -> NovelChapter:
    return get_chapter(
        session=session,
        chapter_id=chapter_id,
    )


def get_chapter_by_slug(
    session: Session,
    novel_slug: str,
    chapter_slug: str,
) -> NovelChapter:
    return get_chapter(
        session=session,
        novel_slug=novel_slug,
        chapter_slug=chapter_slug,
    )


# ===== 时间 / 排序 =====
def sort_novels_by_updated_at(session: Session) -> list[Novel]:
    """
    按 updated_at 自动重排 novel.display_order。

    当前规则：
    1. 最近更新的小说排在前面
    2. display_order 从 0 开始
    3. 前台如果按 display_order 升序展示，就是最近更新优先
    """

    statement = (
        select(Novel)
        .order_by(Novel.updated_at.desc(), Novel.created_at.desc())
    )
    novels = session.exec(statement).all()

    for index, novel in enumerate(novels):
        novel.display_order = index
        session.add(novel)

    session.commit()

    for novel in novels:
        session.refresh(novel)

    return novels


def touch_novel(
    session: Session,
    novel: Novel,
) -> Novel:
    """
    更新 novel.updated_at，并自动按更新时间重排小说。
    """

    novel.updated_at = now_utc()

    session.add(novel)
    session.commit()
    session.refresh(novel)

    sort_novels_by_updated_at(session)

    session.refresh(novel)

    return novel


def touch_chapter_and_novel(
    session: Session,
    chapter: NovelChapter,
    novel: Novel | None = None,
) -> tuple[NovelChapter, Novel]:
    """
    更新 chapter.updated_at 和所属 novel.updated_at。

    用于：
    1. 新建 chapter
    2. 修改 chapter title
    3. 修改 chapter content
    """

    if novel is None:
        novel = get_novel(
            session=session,
            novel_id=chapter.novel_id,
        )

    now = now_utc()

    chapter.updated_at = now
    novel.updated_at = now

    session.add(chapter)
    session.add(novel)
    session.commit()
    session.refresh(chapter)
    session.refresh(novel)

    sort_novels_by_updated_at(session)

    session.refresh(chapter)
    session.refresh(novel)

    return chapter, novel


def compact_chapter_orders(
    session: Session,
    novel: Novel | None = None,
    novel_id: str | None = None,
    novel_slug: str | None = None,
) -> list[NovelChapter]:
    """
    补全某部小说下 chapter 的 display_order 缺位。

    例如：
        1, 2, 4, 5, 7

    会变成：
        1, 2, 3, 4, 5

    同时自动更新标题中的“第x章”。
    """

    novel = get_novel(
        session=session,
        novel=novel,
        novel_id=novel_id,
        novel_slug=novel_slug,
    )

    statement = (
        select(NovelChapter)
        .where(NovelChapter.novel_id == novel.id)
        .order_by(NovelChapter.display_order)
    )

    chapters = session.exec(statement).all()

    changed = False

    for index, chapter in enumerate(chapters, start=1):
        if chapter.display_order != index:
            changed = True

        chapter.display_order = index
        chapter.title = update_chapter_order_title(
            title=chapter.title,
            new_order=index,
        )
        session.add(chapter)

    if changed:
        session.commit()

        for chapter in chapters:
            session.refresh(chapter)

    return chapters


# ===== 创建 =====
def create_novel(
    session: Session,
    novel_slug: str,
    title: str | None = None,
    summary: str | None = None,
    cover_asset_id: str | None = None,
    display_order: int | None = None,
) -> Novel:
    novel_slug = novel_slug.strip()

    if not novel_slug:
        raise ValueError("novel slug 不能为空")

    existing_novel = session.exec(
        select(Novel).where(Novel.slug == novel_slug)
    ).first()

    if existing_novel:
        raise ValueError("这个 novel slug 已存在，slug 是不可更改的唯一识别码，请换一个")

    if display_order is None:
        statement = select(func.max(Novel.display_order))
        max_order = session.exec(statement).one()

        if max_order is None:
            display_order = 0
        else:
            display_order = max_order + 1

    title = (title or "").strip()
    summary = (summary or "").strip()

    if not title:
        title = "未命名小说"

    if not summary:
        summary = "请输入文本"

    novel = Novel(
        id=str(uuid4()),
        slug=novel_slug,
        title=title,
        summary=summary,
        cover_asset_id=cover_asset_id,
        display_order=display_order,
    )

    session.add(novel)
    session.commit()
    session.refresh(novel)

    sort_novels_by_updated_at(session)

    session.refresh(novel)

    return novel


def create_chapter(
    session: Session,
    novel_slug: str,
    chapter_slug: str,
    custom_title: str | None = None,
    content: str | None = None,
    display_order: int | None = None,
) -> NovelChapter:
    novel = get_novel(
        session=session,
        novel_slug=novel_slug,
    )

    chapter_slug = chapter_slug.strip()

    if not chapter_slug:
        raise ValueError("chapter slug 不能为空")

    existing_chapter = session.exec(
        select(NovelChapter)
        .where(NovelChapter.novel_id == novel.id)
        .where(NovelChapter.slug == chapter_slug)
    ).first()

    if existing_chapter:
        raise ValueError("这个 chapter slug 已存在，slug 是不可更改的唯一识别码，请换一个")

    if display_order is None:
        statement = (
            select(func.max(NovelChapter.display_order))
            .where(NovelChapter.novel_id == novel.id)
        )
        max_order = session.exec(statement).one()

        if max_order is None:
            display_order = 1
        else:
            display_order = max_order + 1

    chapter = NovelChapter(
        id=str(uuid4()),
        novel_id=novel.id,
        slug=chapter_slug,
        title=build_chapter_title(
            display_order=display_order,
            custom_title=custom_title,
        ),
        content=content or "",
        display_order=display_order,
    )

    session.add(chapter)
    session.commit()
    session.refresh(chapter)

    touch_chapter_and_novel(
        session=session,
        chapter=chapter,
        novel=novel,
    )

    session.refresh(chapter)

    return chapter


# ===== 修改 novel =====
def rename_novel(
    session: Session,
    novel_slug: str,
    title: str,
) -> Novel:
    title = title.strip()

    if not title:
        raise ValueError("novel 标题不能为空")

    novel = get_novel(
        session=session,
        novel_slug=novel_slug,
    )

    novel.title = title

    session.add(novel)
    session.commit()
    session.refresh(novel)

    touch_novel(session=session, novel=novel)

    session.refresh(novel)

    return novel


def reset_novel_summary(
    session: Session,
    novel_slug: str,
    summary: str | None = None,
) -> Novel:
    novel = get_novel(
        session=session,
        novel_slug=novel_slug,
    )

    novel.summary = (summary or "").strip()

    session.add(novel)
    session.commit()
    session.refresh(novel)

    touch_novel(session=session, novel=novel)

    session.refresh(novel)

    return novel


def reset_novel_cover(
    session: Session,
    novel_slug: str,
    cover_asset_id: str | None,
) -> Novel:
    novel = get_novel(
        session=session,
        novel_slug=novel_slug,
    )

    if cover_asset_id:
        asset = session.get(Asset, cover_asset_id)

        if not asset:
            raise ValueError("封面 asset 不存在")

    novel.cover_asset_id = cover_asset_id

    session.add(novel)
    session.commit()
    session.refresh(novel)

    touch_novel(session=session, novel=novel)

    session.refresh(novel)

    return novel


# ===== 修改 chapter =====
def rename_chapter(
    session: Session,
    novel_slug: str,
    chapter_slug: str,
    custom_title: str | None,
) -> NovelChapter:
    novel = get_novel(
        session=session,
        novel_slug=novel_slug,
    )

    chapter = get_chapter(
        session=session,
        novel=novel,
        chapter_slug=chapter_slug,
    )

    chapter.title = build_chapter_title(
        display_order=chapter.display_order,
        custom_title=custom_title,
    )

    session.add(chapter)
    session.commit()
    session.refresh(chapter)

    touch_chapter_and_novel(
        session=session,
        chapter=chapter,
        novel=novel,
    )

    session.refresh(chapter)

    return chapter


def reset_chapter_content(
    session: Session,
    novel_slug: str,
    chapter_slug: str,
    content: str | None = None,
) -> NovelChapter:
    novel = get_novel(
        session=session,
        novel_slug=novel_slug,
    )

    chapter = get_chapter(
        session=session,
        novel=novel,
        chapter_slug=chapter_slug,
    )

    chapter.content = content or ""

    session.add(chapter)
    session.commit()
    session.refresh(chapter)

    touch_chapter_and_novel(
        session=session,
        chapter=chapter,
        novel=novel,
    )

    session.refresh(chapter)

    return chapter


# ===== 顺序 =====
def shift_chapter(
    session: Session,
    novel_slug: str,
    chapter_slug: str,
    direction: str,
):
    novel = get_novel(
        session=session,
        novel_slug=novel_slug,
    )

    chapter = get_chapter(
        session=session,
        novel=novel,
        chapter_slug=chapter_slug,
    )

    if direction == "up":
        target_order = chapter.display_order - 1
    elif direction == "down":
        target_order = chapter.display_order + 1
    else:
        raise ValueError("direction 必须是 up 或 down")

    statement = (
        select(NovelChapter)
        .where(NovelChapter.novel_id == novel.id)
        .where(NovelChapter.display_order == target_order)
    )

    target_chapter = session.exec(statement).first()

    if not target_chapter:
        return {
            "moved": False,
            "reason": "已经到边界，无法继续移动。",
            "chapterSlug": chapter.slug,
            "displayOrder": chapter.display_order,
        }

    old_order = chapter.display_order
    target_old_order = target_chapter.display_order

    chapter.display_order = target_old_order
    target_chapter.display_order = old_order

    chapter.title = update_chapter_order_title(
        title=chapter.title,
        new_order=chapter.display_order,
    )
    target_chapter.title = update_chapter_order_title(
        title=target_chapter.title,
        new_order=target_chapter.display_order,
    )

    now = now_utc()
    chapter.updated_at = now
    target_chapter.updated_at = now
    novel.updated_at = now

    session.add(chapter)
    session.add(target_chapter)
    session.add(novel)
    session.commit()
    session.refresh(chapter)
    session.refresh(target_chapter)
    session.refresh(novel)

    sort_novels_by_updated_at(session)

    session.refresh(chapter)
    session.refresh(target_chapter)

    return {
        "moved": True,
        "chapterSlug": chapter.slug,
        "displayOrder": chapter.display_order,
        "targetChapterSlug": target_chapter.slug,
        "targetDisplayOrder": target_chapter.display_order,
    }


def shift_chapter_up(
    session: Session,
    novel_slug: str,
    chapter_slug: str,
):
    return shift_chapter(
        session=session,
        novel_slug=novel_slug,
        chapter_slug=chapter_slug,
        direction="up",
    )


def shift_chapter_down(
    session: Session,
    novel_slug: str,
    chapter_slug: str,
):
    return shift_chapter(
        session=session,
        novel_slug=novel_slug,
        chapter_slug=chapter_slug,
        direction="down",
    )


# ===== Novel Owner =====
def list_owner_candidates(session: Session) -> list[User]:
    statement = (
        select(User)
        .where(User.is_active == True)
        .where(User.role.in_(["author", "admin"]))
        .order_by(User.username)
    )

    return session.exec(statement).all()


def get_novel_owner(
    session: Session,
    novel: Novel,
) -> User | None:
    statement = (
        select(NovelUserLink)
        .where(NovelUserLink.novel_id == novel.id)
        .where(NovelUserLink.role == "owner")
    )

    link = session.exec(statement).first()

    if not link:
        return None

    return session.get(User, link.user_id)


def get_owner_novels(
    session: Session,
    user: User,
) -> list[Novel]:
    existing_links = session.exec(
        select(NovelUserLink)
        .where(NovelUserLink.user_id == user.id)
        .where(NovelUserLink.role == "owner")
    ).all()

    if not existing_links:
        return []

    novel_list = []

    for link in existing_links:
        statement = select(Novel).where(Novel.id == link.novel_id)
        novel = session.exec(statement).first()

        if not novel:
            raise ValueError(f"NovelUserLink 表中用户 id {user.id} 存在非法 novel_id")

        novel_list.append(novel)

    return novel_list


def set_novel_owner(
    session: Session,
    novel_slug: str,
    username: str | None,
) -> User | None:
    novel = get_novel(
        session=session,
        novel_slug=novel_slug,
    )

    existing_links = session.exec(
        select(NovelUserLink)
        .where(NovelUserLink.novel_id == novel.id)
        .where(NovelUserLink.role == "owner")
    ).all()

    for link in existing_links:
        session.delete(link)

    username = (username or "").strip()

    if not username:
        session.commit()
        return None

    user = session.exec(
        select(User).where(User.username == username)
    ).first()

    if not user:
        raise ValueError("用户不存在")

    if not user.is_active:
        raise ValueError("不能选择已停用用户作为 owner")

    if user.role not in {"author", "admin"}:
        raise ValueError("owner 必须是 author 或 admin")

    link = NovelUserLink(
        novel_id=novel.id,
        user_id=user.id,
        role="owner",
    )

    session.add(link)
    session.commit()
    session.refresh(user)

    return user


# ===== 删除 =====
def delete_chapter(
    session: Session,
    novel_slug: str,
    chapter_slug: str,
):
    novel = get_novel(
        session=session,
        novel_slug=novel_slug,
    )

    chapter = get_chapter(
        session=session,
        novel=novel,
        chapter_slug=chapter_slug,
    )

    logger.info(f"准备删除小说章节：{chapter.title} ({chapter.slug})")

    deleted_comments = hard_delete_comments_for_target(
        session,
        target_type="novel_chapter",
        target_id=chapter.id,
        commit=False,
    )

    if deleted_comments:
        logger.info(f"已删除小说章节评论 {deleted_comments} 条")

    deleted_images = delete_all_novel_chapter_images(
        session=session,
        novel=novel,
        chapter=chapter,
        commit=False,
    )

    if deleted_images:
        logger.info(f"已删除小说章节正文图片 {deleted_images} 张")

    session.delete(chapter)
    session.commit()

    logger.info("已删除 novel chapter")

    compact_chapter_orders(
        session=session,
        novel=novel,
    )

    touch_novel(
        session=session,
        novel=novel,
    )

    logger.info("删除完成")


def delete_novel(
    session: Session,
    novel_slug: str,
):
    novel = get_novel(
        session=session,
        novel_slug=novel_slug,
    )

    statement = select(NovelChapter).where(NovelChapter.novel_id == novel.id)
    chapters = session.exec(statement).all()

    deleted_novel_comments = hard_delete_comments_for_target(
        session,
        target_type="novel",
        target_id=novel.id,
        commit=False,
    )

    if deleted_novel_comments:
        logger.info(f"已删除小说详情页评论 {deleted_novel_comments} 条")

    deleted_chapter_comments = 0

    for chapter in chapters:
        deleted_chapter_comments += hard_delete_comments_for_target(
            session,
            target_type="novel_chapter",
            target_id=chapter.id,
            commit=False,
        )
        session.delete(chapter)

    if deleted_chapter_comments:
        logger.info(f"已删除小说章节评论 {deleted_chapter_comments} 条")

    logger.info(f"已删除 {len(chapters)} 个 novel chapter")

    links = session.exec(
        select(NovelUserLink).where(NovelUserLink.novel_id == novel.id)
    ).all()

    for link in links:
        session.delete(link)

    logger.info(f"已删除 {len(links)} 个 novel_user_link")

    old_cover_asset_id = novel.cover_asset_id

    novel_title = novel.title
    session.delete(novel)
    session.commit()

    if old_cover_asset_id:
        delete_cover_asset(
            session=session,
            asset_id=old_cover_asset_id,
        )

    sort_novels_by_updated_at(session)

    logger.info(f"已删除 novel：{novel_title}")

# ===== 章节正文图片 =====

def serialize_novel_chapter_image(
    image: NovelChapterImage,
    asset: Asset,
) -> dict:
    return {
        "id": image.id,
        "assetId": asset.id,
        "filename": asset.filename,
        "originalName": asset.original_name,
        "mimeType": asset.mime_type,
        "size": asset.size,
        "url": asset.url,
        "markdown": build_novel_chapter_image_markdown(asset),
        "displayOrder": image.display_order,
        "createdAt": image.created_at,
    }


def list_novel_chapter_images(
    session: Session,
    novel_slug: str,
    chapter_slug: str,
) -> list[dict]:
    novel = get_novel(
        session=session,
        novel_slug=novel_slug,
    )

    chapter = get_chapter(
        session=session,
        novel=novel,
        chapter_slug=chapter_slug,
    )

    images = session.exec(
        select(NovelChapterImage)
        .where(NovelChapterImage.chapter_id == chapter.id)
        .order_by(NovelChapterImage.display_order, NovelChapterImage.created_at)
    ).all()

    result: list[dict] = []

    for image in images:
        asset = session.get(Asset, image.asset_id)

        if asset:
            result.append(
                serialize_novel_chapter_image(
                    image=image,
                    asset=asset,
                )
            )

    return result


def get_next_novel_chapter_image_order(
    session: Session,
    chapter: NovelChapter,
) -> int:
    images = session.exec(
        select(NovelChapterImage)
        .where(NovelChapterImage.chapter_id == chapter.id)
        .order_by(NovelChapterImage.display_order)
    ).all()

    if not images:
        return 1

    return max(image.display_order for image in images) + 1


def count_novel_chapter_images(
    session: Session,
    chapter: NovelChapter,
) -> int:
    images = session.exec(
        select(NovelChapterImage)
        .where(NovelChapterImage.chapter_id == chapter.id)
    ).all()

    return len(images)


async def save_novel_chapter_image(
    session: Session,
    novel_slug: str,
    chapter_slug: str,
    upload_file: UploadFile,
) -> dict:
    novel = get_novel(
        session=session,
        novel_slug=novel_slug,
    )

    chapter = get_chapter(
        session=session,
        novel=novel,
        chapter_slug=chapter_slug,
    )

    current_count = count_novel_chapter_images(
        session=session,
        chapter=chapter,
    )

    if current_count >= MAX_NOVEL_CHAPTER_IMAGE_COUNT:
        raise ValueError(f"每个章节最多上传 {MAX_NOVEL_CHAPTER_IMAGE_COUNT} 张正文图片")

    original_name = validate_novel_chapter_image_filename(upload_file.filename)
    suffix = Path(original_name).suffix.lower()

    guessed_mime_type = guess_mime_type_by_suffix(original_name)
    normalized_content_type = (
        upload_file.content_type or guessed_mime_type
    ).split(";")[0].strip().lower()

    if normalized_content_type not in IMAGE_MIME_TYPES:
        raise ValueError(f"章节正文图片文件类型不合法：{original_name}")

    image_dir = get_novel_chapter_image_dir(
        novel_slug=novel.slug,
        chapter_slug=chapter.slug,
    )
    image_dir.mkdir(parents=True, exist_ok=True)

    filename = f"{uuid4()}{suffix}"
    target_path = image_dir / filename
    written_size = 0

    try:
        await upload_file.seek(0)

        with target_path.open("wb") as f:
            while True:
                chunk = await upload_file.read(1024 * 1024)

                if not chunk:
                    break

                written_size += len(chunk)

                if written_size > MAX_NOVEL_CHAPTER_IMAGE_SIZE_BYTES:
                    raise ValueError("单张章节正文图片不能超过 10MB")

                f.write(chunk)

        if written_size <= 0:
            raise ValueError(f"上传文件为空：{original_name}")

        asset_url = build_novel_chapter_image_url(
            novel_slug=novel.slug,
            chapter_slug=chapter.slug,
            filename=filename,
        )

        asset = Asset(
            filename=filename,
            original_name=original_name,
            mime_type=normalized_content_type,
            size=written_size,
            url=asset_url,
            usage="novel_chapter_image",
        )

        session.add(asset)
        session.flush()

        image = NovelChapterImage(
            chapter_id=chapter.id,
            asset_id=asset.id,
            display_order=get_next_novel_chapter_image_order(
                session=session,
                chapter=chapter,
            ),
        )

        session.add(image)
        session.commit()
        session.refresh(image)
        session.refresh(asset)

        return serialize_novel_chapter_image(
            image=image,
            asset=asset,
        )

    except Exception:
        session.rollback()

        if target_path.exists():
            target_path.unlink()

        raise


def compact_novel_chapter_image_orders(
    session: Session,
    chapter: NovelChapter,
    commit: bool = True,
) -> None:
    images = session.exec(
        select(NovelChapterImage)
        .where(NovelChapterImage.chapter_id == chapter.id)
        .order_by(NovelChapterImage.display_order, NovelChapterImage.created_at)
    ).all()

    changed = False

    for index, image in enumerate(images, start=1):
        if image.display_order != index:
            image.display_order = index
            session.add(image)
            changed = True

    if changed and commit:
        session.commit()


def delete_novel_chapter_image(
    session: Session,
    novel_slug: str,
    chapter_slug: str,
    image_id: str,
) -> list[dict]:
    novel = get_novel(
        session=session,
        novel_slug=novel_slug,
    )

    chapter = get_chapter(
        session=session,
        novel=novel,
        chapter_slug=chapter_slug,
    )

    image = session.get(NovelChapterImage, image_id)

    if not image or image.chapter_id != chapter.id:
        raise ValueError("章节正文图片不存在")

    asset = session.get(Asset, image.asset_id)

    if asset:
        file_path = get_novel_chapter_asset_path(asset)

        if file_path and file_path.exists():
            file_path.unlink()

        session.delete(asset)

    session.delete(image)
    session.flush()

    compact_novel_chapter_image_orders(
        session=session,
        chapter=chapter,
        commit=False,
    )

    session.commit()

    image_dir = get_novel_chapter_image_dir(
        novel_slug=novel.slug,
        chapter_slug=chapter.slug,
    )

    if image_dir.exists() and not any(image_dir.iterdir()):
        image_dir.rmdir()

    return list_novel_chapter_images(
        session=session,
        novel_slug=novel.slug,
        chapter_slug=chapter.slug,
    )


def delete_all_novel_chapter_images(
    session: Session,
    novel: Novel,
    chapter: NovelChapter,
    commit: bool = True,
) -> int:
    images = session.exec(
        select(NovelChapterImage)
        .where(NovelChapterImage.chapter_id == chapter.id)
    ).all()

    deleted_count = 0

    for image in images:
        asset = session.get(Asset, image.asset_id)

        if asset:
            file_path = get_novel_chapter_asset_path(asset)

            if file_path and file_path.exists():
                file_path.unlink()

            session.delete(asset)

        session.delete(image)
        deleted_count += 1

    image_dir = get_novel_chapter_image_dir(
        novel_slug=novel.slug,
        chapter_slug=chapter.slug,
    )

    if image_dir.exists():
        for path in image_dir.iterdir():
            if path.is_file():
                path.unlink()

        if not any(image_dir.iterdir()):
            image_dir.rmdir()

    if commit:
        session.commit()

    return deleted_count

# ===== 封面 =====
def copy_novel_cover_to_uploads(
    source_path: Path,
    novel_slug: str,
    upload_root: Path,
) -> tuple[Path, str]:
    if not source_path.exists():
        raise FileNotFoundError(f"封面文件不存在：{source_path}")

    if not source_path.is_file():
        raise ValueError(f"封面路径不是文件：{source_path}")

    if ":Zone.Identifier" in source_path.name:
        raise ValueError(f"非法文件名：{source_path.name}")

    suffix = source_path.suffix.lower()

    if suffix not in IMAGE_EXTENSIONS:
        raise ValueError(f"不支持的封面格式：{source_path.name}")

    target_dir = upload_root / novel_slug / "cover"
    target_dir.mkdir(parents=True, exist_ok=True)

    filename = f"{uuid4()}{suffix}"
    target_path = target_dir / filename

    copy2(source_path, target_path)

    asset_url = (
        f"/uploads/novels/"
        f"{novel_slug}/"
        f"cover/"
        f"{filename}"
    )

    return target_path, asset_url


def create_cover_asset(
    session: Session,
    asset_url: str,
    source_path: Path,
) -> Asset:
    asset = Asset(
        id=str(uuid4()),
        filename=Path(asset_url).name,
        original_name=source_path.name,
        mime_type=guess_mime_type(source_path),
        size=source_path.stat().st_size,
        url=asset_url,
        usage="novel_cover",
    )

    session.add(asset)
    session.commit()
    session.refresh(asset)

    return asset


def get_asset_upload_path(asset: Asset) -> Path | None:
    prefix = "/uploads/novels/"

    if not asset.url.startswith(prefix):
        return None

    relative_path = Path(asset.url.removeprefix(prefix))

    if relative_path.is_absolute() or ".." in relative_path.parts:
        raise ValueError("asset 文件路径非法")

    return UPLOADS_ROOT / relative_path


def delete_asset_file(asset: Asset) -> None:
    file_path = get_asset_upload_path(asset)

    if file_path is None:
        return

    if file_path.exists():
        file_path.unlink()


def delete_cover_asset(
    session: Session,
    asset_id: str | None,
) -> None:
    if not asset_id:
        return

    asset = session.get(Asset, asset_id)

    if not asset:
        return

    delete_asset_file(asset)

    session.delete(asset)
    session.commit()


def set_novel_cover(
    session: Session,
    novel_slug: str,
    source_path: Path,
    uploads_root: Path | None = UPLOADS_ROOT,
) -> Novel:
    if uploads_root is None:
        raise ValueError("uploads_root 不能为空")

    novel = get_novel(
        session=session,
        novel_slug=novel_slug,
    )

    old_cover_asset_id = novel.cover_asset_id

    _, asset_url = copy_novel_cover_to_uploads(
        source_path=source_path,
        novel_slug=novel.slug,
        upload_root=uploads_root,
    )

    asset = create_cover_asset(
        session=session,
        asset_url=asset_url,
        source_path=source_path,
    )

    novel.cover_asset_id = asset.id

    session.add(novel)
    session.commit()
    session.refresh(novel)

    touch_novel(session=session, novel=novel)

    if old_cover_asset_id and old_cover_asset_id != asset.id:
        delete_cover_asset(
            session=session,
            asset_id=old_cover_asset_id,
        )

    session.refresh(novel)

    return novel