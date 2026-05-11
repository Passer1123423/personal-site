from pathlib import Path
from shutil import copy2
from uuid import uuid4

from sqlmodel import Session, select

from app.database import engine
from app.models import Asset, ComicSeries, ComicPart, ComicChapter, ComicPage
from app.services.comic_admin import get_or_create_series,get_or_create_part,create_next_chapter,copy_image_to_uploads,create_asset,create_comic_page


# ===== 这里先手动指定，后续可以改成命令行参数或后台表单 =====

SERIES_SLUG = "test-series"
SERIES_TITLE = "测试漫画"
SERIES_SUMMARY = "用于测试漫画上传和阅读流程。"

PART_SLUG = "part-2"
PART_TITLE = "第一3部"
PART_SUMMARY = "测试分部。"

CHAPTER_TITLE = "测试章节"

# 把本次要导入的一章图片先放到这里
SOURCE_DIR = Path("import_data/comic_chapter")

# 正式静态资源目录
UPLOADS_ROOT = Path("uploads/comics")

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
"""
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
"""
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

def import_chapter() -> None:
    image_files = list_image_files(SOURCE_DIR)

    with Session(engine) as session:
        series = get_or_create_series(
            session,
            series_slug=SERIES_SLUG,
            series_title=SERIES_TITLE,
            series_summary=SERIES_SUMMARY,
            display_order=0,
        )
        part = get_or_create_part(
            session,
            series,
            part_slug=PART_SLUG,
            part_title=PART_TITLE,
            part_summary=None,
            display_order=0,
        )
        chapter = create_next_chapter(
            session,
            part,
            chapter_title=None,
        )

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
                upload_root=UPLOADS_ROOT,
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
