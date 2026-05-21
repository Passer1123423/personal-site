import os
from pathlib import Path
from shutil import copy2
from uuid import uuid4
from shutil import rmtree

from sqlalchemy import func
from sqlmodel import Session, select

from app.database import engine
from app.models import (
    Asset,
    ComicSeries,
    ComicPart,
    ComicChapter,
    ComicPage,
    User,
    ComicPartUserLink,
    now_utc,
)

import re

# ===== 文件识别 =====
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
BACKEND_DIR = Path(__file__).resolve().parents[2]
UPLOADS_DIR = Path(os.getenv("UPLOADS_DIR", BACKEND_DIR / "uploads")).resolve()
UPLOADS_ROOT = UPLOADS_DIR / "comics"

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

from collections.abc import Sequence
from pathlib import Path


def list_image_files(
    source_dir: Path,
    ordered_file_names: Sequence[str] | None = None,
) -> list[Path]:
    if not source_dir.exists():
        raise FileNotFoundError(f"导入目录不存在：{source_dir}")

    files: list[Path] = []

    for path in source_dir.iterdir():
        if not path.is_file():
            continue

        if ":Zone.Identifier" in path.name:
            continue

        if path.suffix.lower() not in IMAGE_EXTENSIONS:
            continue

        files.append(path)

    if not files:
        raise ValueError(f"导入目录中没有图片文件：{source_dir}")

    if ordered_file_names is None:
        files.sort(key=lambda path: path.stat().st_mtime)
    else:
        file_map = {path.name: path for path in files}

        ordered_names = list(ordered_file_names)

        if not ordered_names:
            raise ValueError("没有选择要发布的图片")

        if len(set(ordered_names)) != len(ordered_names):
            raise ValueError("图片顺序列表中存在重复文件")

        missing_names = [
            name for name in ordered_names
            if name not in file_map
        ]

        if missing_names:
            raise ValueError(f"以下图片不存在或不是合法图片：{missing_names}")

        files = [file_map[name] for name in ordered_names]

    print("将导入以下图片：")
    for index, path in enumerate(files, start=1):
        print(f"{index}. {path.name}")

    return files

# ===== 仅获取/没有时返回 =====
def get_series(
    session: Session,
    series: ComicSeries | None=None,
    series_id: str | None=None,
    series_slug: str | None=None,
) -> ComicSeries:

    if series:
        return series

    if series_id:
        statement = select(ComicSeries).where(ComicSeries.id == series_id)
        series = session.exec(statement).first()
    elif series_slug:
        statement = select(ComicSeries).where(ComicSeries.slug == series_slug)
        series = session.exec(statement).first()
    else:
        raise ValueError("未输入有效series_id/series_slug")

    if not series:
        raise ValueError("未找到目标series")

    return series

def get_part(
    session: Session,
    part: ComicPart | None=None,
    part_id: str | None=None,
    series: ComicSeries | None=None,
    series_id: str | None=None,
    series_slug:str | None=None,
    part_slug: str | None=None,
) -> ComicPart:
    if part:
        return part

    if part_id:
        statement = select(ComicPart).where(ComicPart.id == part_id)
        part = session.exec(statement).first()
        if part:
            return part

    if not part_slug:
        raise ValueError("未输入有效 part_id / part_slug")

    series = get_series(
        session = session,
        series = series,
        series_id = series_id,
        series_slug = series_slug,
    )

    statement = (
        select(ComicPart)
        .where(ComicPart.series_id == series.id)
        .where(ComicPart.slug == part_slug)
    )
    part = session.exec(statement).first()

    if not part:
        raise ValueError("未找到目标 part")

    return part

def get_chapter(
    session: Session,
    chapter: ComicChapter | None=None,
    chapter_id: str | None=None,
    series: ComicSeries | None=None,
    series_id: str | None=None,
    series_slug: str | None=None,
    part: ComicPart | None=None,
    part_id: str | None=None,
    part_slug: str | None=None,
    chapter_slug: str | None=None,
) -> ComicChapter:

    if chapter_id:
        statement = select(ComicChapter).where(ComicChapter.id == chapter_id)
        chapter = session.exec(statement).first()

    if chapter:
        return chapter

    if not chapter_slug:
        raise ValueError("未输入有效 chapter_id / chapter_slug")

    series = get_series(
        session = session,
        series = series,
        series_id = series_id,
        series_slug = series_slug,
    )

    part = get_part(
        session = session,
        part = part,
        part_id = part_id,
        part_slug = part_slug,
        series = series,
        series_id = series_id,
        series_slug = series_slug,
    )

    statement = (
        select(ComicChapter)
        .where(ComicChapter.part_id == part.id)
        .where(ComicChapter.slug == chapter_slug)
    )
    chapter = session.exec(statement).first()

    if not chapter:
        raise ValueError("未找到目标 chapter")

    return chapter

def get_pages(
    session: Session,
    chapter: ComicChapter,
) -> list[ComicPage]:

    statement = select(ComicPage).where(ComicPage.chapter_id == chapter.id)
    pages = session.exec(statement).all()

    if not pages:
        raise ValueError("未找到目标chapter下的pages")

    return pages

# ===== 获取/没有时创建 =====
def get_or_create_series(
    session: Session,
    series_slug: str,
    series_title: str | None,
    series_summary: str | None,
    display_order: int | None=None,
) -> ComicSeries:
    statement = select(ComicSeries).where(ComicSeries.slug == series_slug)
    series = session.exec(statement).first()

    if series:
        return series

    if series_title:
        series_title = series_title
    else:
        series_title = "未命名系列"

    if display_order is None:
        statement = select(func.max(ComicSeries.display_order))
        max_order = session.exec(statement).one()

        if max_order is None:
            display_order = 0
        else:
            display_order = max_order + 1

    series = ComicSeries(
        id=str(uuid4()),
        slug=series_slug,
        title=series_title,
        summary=series_summary,
        status="ongoing",
        visibility="public",
        display_order=display_order,
    )

    session.add(series)
    session.commit()
    session.refresh(series)

    return series

def get_or_create_part(
    session: Session,
    series: ComicSeries,
    part_slug: str,
    part_title: str | None,
    part_summary: str | None,
    display_order: int | None=None,
) -> ComicPart:
    statement = (
        select(ComicPart)
        .where(ComicPart.series_id == series.id)
        .where(ComicPart.slug == part_slug)
    )

    part = session.exec(statement).first()

    if part:
        return part

    if display_order is None:
        statement = select(func.max(ComicPart.display_order)).where(ComicPart.series_id==series)
        max_order = session.exec(statement).one()

        if max_order is None:
            display_order = 0
        else:
            display_order = max_order + 1

    if part_title:
        title = f"第{display_order+1}章 {part_title}"
    else:
        title = f"第{display_order+1}章"

    part = ComicPart(
        id=str(uuid4()),
        series_id=series.id,
        slug=part_slug,
        title=title,
        summary=part_summary,
        status="ongoing",
        visibility="public",
        display_order=display_order,
    )

    session.add(part)
    session.commit()
    session.refresh(part)

    return part

def create_next_chapter(
    session: Session,
    part: ComicPart,
    chapter_title: str | None,
) -> ComicChapter:
    statement = select(ComicChapter).where(ComicChapter.part_id == part.id)
    existing_chapters = session.exec(statement).all()

    next_order = len(existing_chapters) + 1
    chapter_slug = f"chapter-{next_order:03d}"

    if chapter_title:
        title = f"第{next_order}话 {chapter_title}"
    else:
        title = f"第{next_order}话"

    chapter = ComicChapter(
        id=str(uuid4()),
        part_id=part.id,
        slug=chapter_slug,
        title=title,
        summary=None,
        visibility="public",
        display_order=next_order,
        published_at=None,
    )

    session.add(chapter)
    session.commit()
    session.refresh(chapter)

    return chapter

# ===== 导入章节 =====
def copy_image_to_uploads(
    source_path: Path,
    series_slug: str,
    part_slug: str,
    chapter_slug: str,
    display_order: int,
    upload_root: Path,
) -> tuple[Path, str]:
    target_dir = upload_root / series_slug / part_slug / chapter_slug
    target_dir.mkdir(parents=True, exist_ok=True)

    suffix = source_path.suffix.lower()
    filename = f"{display_order:03d}{suffix}"
    target_path = target_dir / filename

    copy2(source_path, target_path)

    asset_url = (
        f"/uploads/comics/"
        f"{series_slug}/"
        f"{part_slug}/"
        f"{chapter_slug}/"
        f"{filename}"
    )

    return target_path, asset_url

def create_asset(session: Session, asset_url: str, source_path: Path) -> Asset:
    asset = Asset(
        id=str(uuid4()),
        filename=Path(asset_url).name,
        original_name=source_path.name,
        mime_type=guess_mime_type(source_path),
        size=source_path.stat().st_size,
        url=asset_url,
        usage="comic_page",
    )

    session.add(asset)
    session.commit()
    session.refresh(asset)

    return asset

def create_comic_page(
    session: Session,
    chapter: ComicChapter,
    asset: Asset,
    display_order: int,
) -> ComicPage:
    page = ComicPage(
        id=str(uuid4()),
        chapter_id=chapter.id,
        asset_id=asset.id,
        display_order=display_order,
        width=None,
        height=None,
    )

    session.add(page)
    session.commit()
    session.refresh(page)

    return page

def import_comic_chapter_from_dir(
    session: Session,
    source_dir: Path,
    series_slug: str,
    part_slug: str,
    series_title: str | None=None,
    series_summary: str | None=None,
    part_title: str | None=None,
    part_summary: str | None=None,
    chapter_title: str | None=None,
    uploads_root: Path | None = UPLOADS_ROOT,
    series_display_order: int | None = None,
    part_display_order: int | None=None,
    ordered_file_names: Sequence[str] | None = None,
):
    image_files = list_image_files(source_dir=source_dir,ordered_file_names=ordered_file_names,)

    series = get_or_create_series(
        session,
        series_slug=series_slug,
        series_title=series_title,
        series_summary=series_summary,
        display_order=series_display_order,
    )
    part = get_or_create_part(
        session,
        series,
        part_slug=part_slug,
        part_title=part_title,
        part_summary=part_summary,
        display_order=part_display_order,
    )
    chapter = create_next_chapter(
        session,
        part,
        chapter_title=chapter_title,
    )

    pages = []

    for index, source_path in enumerate(image_files, start=1):
        _, asset_url = copy_image_to_uploads(
            source_path=source_path,
            series_slug=series.slug,
            part_slug=part.slug,
            chapter_slug=chapter.slug,
            display_order=index,
            upload_root=uploads_root,
        )

        asset = create_asset(session, asset_url, source_path)

        page = create_comic_page(
            session=session,
            chapter=chapter,
            asset=asset,
            display_order=index,
        )

        pages.append(page)

    return {
        "series": series,
        "part": part,
        "chapter": chapter,
        "pages": pages,
        "page_count": len(pages),
    }

# ===== 删除 =====
def delete_chapter_files(
    series_slug: str,
    part_slug: str,
    chapter_slug: str,
):
    chapter_dir = (
        UPLOADS_ROOT
        / series_slug
        / part_slug
        / chapter_slug
    )

    if chapter_dir.exists():
        rmtree(chapter_dir)
        print(f"已删除目录：{chapter_dir}")
    else:
        print(f"目录不存在：{chapter_dir}")

def reorder_chapters(session: Session, part_id: str):#重排part下的chapter display order
    statement = (
        select(ComicChapter)
        .where(ComicChapter.part_id == part_id)
        .order_by(ComicChapter.display_order)
    )

    chapters = session.exec(statement).all()

    for index, chapter in enumerate(chapters, start=1):
        chapter.display_order = index
        title = chapter.title
        new_title = re.sub(r"第\d+话",f"第{index}话", title)
        chapter.title = new_title

    session.commit()

def delete_chapter(
    session: Session,
    series_slug: str,
    part_slug: str,
    chapter_slug: str,
):
    chapter = get_chapter(
        session=session,
        series_slug=series_slug,
        part_slug=part_slug,
        chapter_slug=chapter_slug,
    )

    print(f"准备删除：{chapter.title} ({chapter.slug})")

    page_statement = (
        select(ComicPage)
        .where(ComicPage.chapter_id == chapter.id)
    )

    pages = session.exec(page_statement).all()

    asset_ids = []

    for page in pages:
        if page.asset_id:
            asset_ids.append(page.asset_id)

    delete_chapter_files(series_slug, part_slug, chapter_slug)

    for page in pages:
        session.delete(page)

    session.commit()

    print(f"已删除 {len(pages)} 个 comic_page")

    for asset_id in asset_ids:
        asset = session.get(Asset, asset_id)
        if asset:
            session.delete(asset)
    session.commit()

    print(f"已删除 {len(asset_ids)} 个 asset")

    part_id = chapter.part_id
    session.delete(chapter)
    session.commit()

    print("已删除 chapter")

    reorder_chapters(session, part_id)

    print("删除完成")

def delete_part(
    session: Session,
    series_slug: str,
    part_slug: str,
):
    part = get_part(session=session, series_slug=series_slug, part_slug=part_slug)

    statement = select(ComicChapter).where(ComicChapter.part_id == part.id)
    chapters = session.exec(statement).all()

    chapters_slug = []
    for chapter in chapters:
        chapters_slug.append(chapter.slug)

    for chapter_slug in chapters_slug:
        delete_chapter(
            session=session,
            series_slug=series_slug,
            part_slug=part_slug,
            chapter_slug=chapter_slug,
        )

    session.commit()

    if part.cover_asset_id:
        asset = session.get(Asset, part.cover_asset_id)

        if asset:
            print("检测到part封面")
            session.delete(asset)
            print("part封面已删除")

    part_title = part.title
    session.delete(part)
    session.commit()
    print(f"已删除part{part_title}")

def delete_series(
    session: Session,
    series_slug: str,
):
    series = get_series(session=session, series_slug=series_slug)

    statement = select(ComicPart).where(ComicPart.series_id == series.id)
    parts = session.exec(statement).all()

    parts_slug = []
    for part in parts:
        parts_slug.append(part.slug)

    for part_slug in parts_slug:
        delete_part(
            session=session,
            series_slug=series_slug,
            part_slug=part_slug,
        )
    session.commit()

    if series.cover_asset_id:
        asset = session.get(Asset, series.cover_asset_id)

        if asset:
            print("检测到series封面")
            session.delete(asset)
            print("series封面已删除")

    series_title = series.title
    session.delete(series)
    session.commit()
    print(f"已删除series{series_title}")

# ===== 顺序 =====
def update_chapter_order_title(title: str, new_order: int) -> str:
    return re.sub(
        r"^第\s*\d+\s*话",
        f"第{new_order}话",
        title,
        count=1,
    )

def shift_chapter(
    session: Session,
    series_slug: str,
    part_slug: str,
    chapter_slug: str,
    direction: str,
):
    chapter = get_chapter(
        session=session,
        series_slug=series_slug,
        part_slug=part_slug,
        chapter_slug=chapter_slug,
    )

    if direction == "up":
        target_order = chapter.display_order - 1
    elif direction == "down":
        target_order = chapter.display_order + 1
    else:
        raise ValueError("direction 必须是 up 或 down")

    statement = (
        select(ComicChapter)
        .where(ComicChapter.part_id == chapter.part_id)
        .where(ComicChapter.display_order == target_order)
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
        chapter.title,
        chapter.display_order,
    )
    target_chapter.title = update_chapter_order_title(
        target_chapter.title,
        target_chapter.display_order,
    )

    session.commit()
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
    series_slug: str,
    part_slug: str,
    chapter_slug: str,
):
    return shift_chapter(
        session=session,
        series_slug=series_slug,
        part_slug=part_slug,
        chapter_slug=chapter_slug,
        direction="up",
    )


def shift_chapter_down(
    session: Session,
    series_slug: str,
    part_slug: str,
    chapter_slug: str,
):
    return shift_chapter(
        session=session,
        series_slug=series_slug,
        part_slug=part_slug,
        chapter_slug=chapter_slug,
        direction="down",
    )

# ===== 重命名 =====
def rename_series(
    session: Session,
    series_slug: str,
    title: str,
) -> ComicSeries:
    title = title.strip()

    if not title:
        raise ValueError("series 标题不能为空")

    series = get_series(
        session=session,
        series_slug=series_slug,
    )

    series.title = title
    session.add(series)
    session.commit()
    session.refresh(series)

    return series


def rename_part(
    session: Session,
    series_slug: str,
    part_slug: str,
    title: str,
) -> ComicPart:
    title = title.strip()

    if not title:
        raise ValueError("part 标题不能为空")

    part = get_part(
        session=session,
        series_slug=series_slug,
        part_slug=part_slug,
    )

    part.title = title
    session.add(part)
    session.commit()
    session.refresh(part)

    return part


def build_chapter_title(display_order: int, custom_title: str | None) -> str:
    custom_title = (custom_title or "").strip()

    if custom_title:
        return f"第{display_order}话 {custom_title}"

    return f"第{display_order}话"


def rename_chapter(
    session: Session,
    series_slug: str,
    part_slug: str,
    chapter_slug: str,
    custom_title: str | None,
) -> ComicChapter:
    chapter = get_chapter(
        session=session,
        series_slug=series_slug,
        part_slug=part_slug,
        chapter_slug=chapter_slug,
    )

    chapter.title = build_chapter_title(
        display_order=chapter.display_order,
        custom_title=custom_title,
    )

    session.add(chapter)
    session.commit()
    session.refresh(chapter)

    return chapter

# ===== 简介 =====
def reset_series_summary(
    session: Session,
    series_slug: str,
    summary: str | None = None,
) -> ComicSeries:
    series = get_series(
        session=session,
        series_slug=series_slug,
    )

    series.summary = (summary or "").strip()
    series.updated_at = now_utc()

    session.add(series)
    session.commit()
    session.refresh(series)

    return series


def reset_part_summary(
    session: Session,
    series_slug: str,
    part_slug: str,
    summary: str | None = None,
) -> ComicPart:
    part = get_part(
        session=session,
        series_slug=series_slug,
        part_slug=part_slug,
    )

    part.summary = (summary or "").strip()
    part.updated_at = now_utc()

    session.add(part)
    session.commit()
    session.refresh(part)

    return part

# ===== 封面 =====


# ===== Part Owner =====
def list_owner_candidates(session: Session) -> list[User]:
    statement = (
        select(User)
        .where(User.is_active == True)
        .where(User.role.in_(["author", "admin"]))
        .order_by(User.username)
    )

    return session.exec(statement).all()


def get_part_owner(
    session: Session,
    part: ComicPart,
) -> User | None:
    statement = (
        select(ComicPartUserLink)
        .where(ComicPartUserLink.part_id == part.id)
        .where(ComicPartUserLink.role == "owner")
    )

    link = session.exec(statement).first()

    if not link:
        return None

    return session.get(User, link.user_id)

def get_owner_parts(
    session: Session,
    user: User,
) -> list[ComicPart]:
    existing_links = session.exec(
        select(ComicPartUserLink)
        .where(ComicPartUserLink.user_id == user.id)
        .where(ComicPartUserLink.role == "owner")
    ).all()

    if not existing_links:
        return []

    part_list = []

    for link in existing_links:
        statement = select(ComicPart).where(ComicPart.id == link.part_id)
        part = session.exec(statement).first()

        if not part:
            raise ValueError(f"ComicPartUserLink表中用户id{user.id}存在非法part_id")

        part_list.append(part)

    return part_list


def set_part_owner(
    session: Session,
    series_slug: str,
    part_slug: str,
    username: str | None,
) -> User | None:
    part = get_part(
        session=session,
        series_slug=series_slug,
        part_slug=part_slug,
    )

    existing_links = session.exec(
        select(ComicPartUserLink)
        .where(ComicPartUserLink.part_id == part.id)
        .where(ComicPartUserLink.role == "owner")
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

    link = ComicPartUserLink(
        part_id=part.id,
        user_id=user.id,
        role="owner",
    )

    session.add(link)
    session.commit()
    session.refresh(user)

    return user

# ===== 封面 =====
def copy_series_cover_to_uploads(
    source_path: Path,
    series_slug: str,
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

    target_dir = upload_root / series_slug / "cover"
    target_dir.mkdir(parents=True, exist_ok=True)

    filename = f"{uuid4()}{suffix}"
    target_path = target_dir / filename

    copy2(source_path, target_path)

    asset_url = (
        f"/uploads/comics/"
        f"{series_slug}/"
        f"cover/"
        f"{filename}"
    )

    return target_path, asset_url


def copy_part_cover_to_uploads(
    source_path: Path,
    series_slug: str,
    part_slug: str,
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

    target_dir = upload_root / series_slug / part_slug / "cover"
    target_dir.mkdir(parents=True, exist_ok=True)

    filename = f"{uuid4()}{suffix}"
    target_path = target_dir / filename

    copy2(source_path, target_path)

    asset_url = (
        f"/uploads/comics/"
        f"{series_slug}/"
        f"{part_slug}/"
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
        usage="comic_cover",
    )

    session.add(asset)
    session.commit()
    session.refresh(asset)

    return asset


def get_asset_upload_path(asset: Asset) -> Path | None:
    prefix = "/uploads/comics/"

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


def set_series_cover(
    session: Session,
    series_slug: str,
    source_path: Path,
    uploads_root: Path | None = UPLOADS_ROOT,
) -> ComicSeries:
    if uploads_root is None:
        raise ValueError("uploads_root 不能为空")

    series = get_series(
        session=session,
        series_slug=series_slug,
    )

    old_cover_asset_id = series.cover_asset_id

    _, asset_url = copy_series_cover_to_uploads(
        source_path=source_path,
        series_slug=series.slug,
        upload_root=uploads_root,
    )

    asset = create_cover_asset(
        session=session,
        asset_url=asset_url,
        source_path=source_path,
    )

    series.cover_asset_id = asset.id
    series.updated_at = now_utc()

    session.add(series)
    session.commit()
    session.refresh(series)

    if old_cover_asset_id and old_cover_asset_id != asset.id:
        delete_cover_asset(
            session=session,
            asset_id=old_cover_asset_id,
        )

    return series


def set_part_cover(
    session: Session,
    series_slug: str,
    part_slug: str,
    source_path: Path,
    uploads_root: Path | None = UPLOADS_ROOT,
) -> ComicPart:
    if uploads_root is None:
        raise ValueError("uploads_root 不能为空")

    part = get_part(
        session=session,
        series_slug=series_slug,
        part_slug=part_slug,
    )

    old_cover_asset_id = part.cover_asset_id

    _, asset_url = copy_part_cover_to_uploads(
        source_path=source_path,
        series_slug=series_slug,
        part_slug=part.slug,
        upload_root=uploads_root,
    )

    asset = create_cover_asset(
        session=session,
        asset_url=asset_url,
        source_path=source_path,
    )

    part.cover_asset_id = asset.id
    part.updated_at = now_utc()

    session.add(part)
    session.commit()
    session.refresh(part)

    if old_cover_asset_id and old_cover_asset_id != asset.id:
        delete_cover_asset(
            session=session,
            asset_id=old_cover_asset_id,
        )

    return part