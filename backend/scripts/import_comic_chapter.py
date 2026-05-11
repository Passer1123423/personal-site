from pathlib import Path
from shutil import copy2
from uuid import uuid4

from sqlmodel import Session, select

from app.database import engine
from app.models import Asset, ComicSeries, ComicPart, ComicChapter, ComicPage


# ===== 这里先手动指定，后续可以改成命令行参数或后台表单 =====

SERIES_SLUG = "test-series"
SERIES_TITLE = "测试漫画"
SERIES_SUMMARY = "用于测试漫画上传和阅读流程。"

PART_SLUG = "part-3"
PART_TITLE = "第一3部"
PART_SUMMARY = "测试分部。"

CHAPTER_TITLE = "测试章节"

# 把本次要导入的一章图片先放到这里
SOURCE_DIR = Path("import_data/comic_chapter")

# 正式静态资源目录
UPLOADS_ROOT = Path("uploads/comics")

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

def get_or_create_series(session: Session) -> ComicSeries:
    statement = select(ComicSeries).where(ComicSeries.slug == SERIES_SLUG)
    series = session.exec(statement).first()

    if series:
        return series

    series = ComicSeries(
        id=str(uuid4()),
        slug=SERIES_SLUG,
        title=SERIES_TITLE,
        summary=SERIES_SUMMARY,
        status="ongoing",
        visibility="public",
        display_order=0,
    )

    session.add(series)
    session.commit()
    session.refresh(series)

    return series


def get_or_create_part(session: Session, series: ComicSeries) -> ComicPart:
    statement = (
        select(ComicPart)
        .where(ComicPart.series_id == series.id)
        .where(ComicPart.slug == PART_SLUG)
    )
    part = session.exec(statement).first()

    if part:
        return part

    max_order_statement = select(ComicPart).where(ComicPart.series_id == series.id)
    existing_parts = session.exec(max_order_statement).all()
    next_order = len(existing_parts) + 1

    part = ComicPart(
        id=str(uuid4()),
        series_id=series.id,
        slug=PART_SLUG,
        title=PART_TITLE,
        summary=PART_SUMMARY,
        status="ongoing",
        visibility="public",
        display_order=next_order,
    )

    session.add(part)
    session.commit()
    session.refresh(part)

    return part


def create_next_chapter(session: Session, part: ComicPart) -> ComicChapter:
    statement = select(ComicChapter).where(ComicChapter.part_id == part.id)
    existing_chapters = session.exec(statement).all()

    next_order = len(existing_chapters) + 1
    chapter_slug = f"chapter-{next_order:03d}"

    chapter = ComicChapter(
        id=str(uuid4()),
        part_id=part.id,
        slug=chapter_slug,
        title=CHAPTER_TITLE,
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
) -> tuple[Path, str]:
    target_dir = UPLOADS_ROOT / series_slug / part_slug / chapter_slug
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


def import_chapter() -> None:
    image_files = list_image_files(SOURCE_DIR)

    with Session(engine) as session:
        series = get_or_create_series(session)
        part = get_or_create_part(session, series)
        chapter = create_next_chapter(session, part)

        print(f"系列：{series.title} ({series.slug})")
        print(f"分部：{part.title} ({part.slug})")
        print(f"新章节：{chapter.title} ({chapter.slug})")
        print(f"图片数量：{len(image_files)}")

        for index, source_path in enumerate(image_files, start=1):
            _, asset_url = copy_image_to_uploads(
                source_path=source_path,
                series_slug=series.slug,
                part_slug=part.slug,
                chapter_slug=chapter.slug,
                display_order=index,
            )

            asset = create_asset(session, asset_url, source_path)

            create_comic_page(
                session=session,
                chapter=chapter,
                asset=asset,
                display_order=index,
            )

            print(f"第 {index} 页：{source_path.name} -> {asset_url}")

        print("导入完成。")


if __name__ == "__main__":
    import_chapter()
