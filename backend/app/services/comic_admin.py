from pathlib import Path
from shutil import copy2
from uuid import uuid4

from sqlmodel import Session, select

from app.database import engine
from app.models import Asset, ComicSeries, ComicPart, ComicChapter, ComicPage

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}

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

def get_or_create_series(
    session: Session,
    series_slug: str,
    series_title: str,
    series_summary: str | None,
    display_order: int,
) -> ComicSeries:
    statement = select(ComicSeries).where(ComicSeries.slug == series_slug)
    series = session.exec(statement).first()

    if series:
        return series

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
    display_order: int,
) -> ComicPart:
    statement = (
        select(ComicPart)
        .where(ComicPart.series_id == series.id)
        .where(ComicPart.slug == part_slug)
    )

    part = session.exec(statement).first()

    if part:
        return part

    if part_title:
        title = f"第{display_order}章 {part_title}"
    else:
        title = f"第{display_order}章"

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

def list_image_files(source_dir: Path) -> list[Path]:
    if not source_dir.exists():
        raise FileNotFoundError(f"导入目录不存在：{source_dir}")

    files = []

    for path in source_dir.iterdir():
        if not path.is_file():
            continue

        if ":Zone.Identifier" in path.name:
            continue

        if path.suffix.lower() not in IMAGE_EXTENSIONS:
            continue

        files.append(path)

    files.sort(key=lambda path: path.stat().st_mtime)

    if not files:
        raise ValueError(f"导入目录中没有图片文件：{source_dir}")

    print("将导入以下图片：")
    for index, path in enumerate(files, start=1):
        print(f"{index}. {path.name}")

    return files

def import_comic_chapter_from_dir(
    session: Session,
    source_dir: Path,
    uploads_root: Path,
    series_slug: str,
    series_title: str,
    series_summary: str | None,
    series_display_order: int,
    part_slug: str,
    part_title: str | None,
    part_summary: str | None,
    part_display_order: int,
    chapter_title=str | None,
):
    image_files = list_image_files(source_dir)

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
