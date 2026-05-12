from pathlib import Path
from shutil import rmtree

from sqlmodel import Session, select

from app.database import engine
from app.models import ComicSeries, ComicPart, ComicChapter, ComicPage, Asset
from app.services.comic_admin import delete_chapter, delete_part, delete_series

SERIES_SLUG = "test-series"
PART_SLUG = "part-3"
CHAPTER_SLUG = "chapter-006"

UPLOADS_ROOT = Path("uploads/comics")

"""
def get_target_chapter(session: Session):
    statement = (
        select(ComicChapter)
        .join(ComicPart, ComicChapter.part_id == ComicPart.id)
        .join(ComicSeries, ComicPart.series_id == ComicSeries.id)
        .where(ComicSeries.slug == SERIES_SLUG)
        .where(ComicPart.slug == PART_SLUG)
        .where(ComicChapter.slug == CHAPTER_SLUG)
    )

    chapter = session.exec(statement).first()

    if not chapter:
        raise ValueError("未找到目标 chapter")

    return chapter


def delete_chapter_files():
    chapter_dir = (
        UPLOADS_ROOT
        / SERIES_SLUG
        / PART_SLUG
        / CHAPTER_SLUG
    )

    if chapter_dir.exists():
        rmtree(chapter_dir)
        print(f"已删除目录：{chapter_dir}")
    else:
        print(f"目录不存在：{chapter_dir}")


def reorder_chapters(session: Session, part_id: str):
    statement = (
        select(ComicChapter)
        .where(ComicChapter.part_id == part_id)
        .order_by(ComicChapter.display_order)
    )

    chapters = session.exec(statement).all()

    for index, chapter in enumerate(chapters, start=1):
        chapter.display_order = index

    session.commit()

    print("已重排 chapter.display_order")


def delete_chapter():
    with Session(engine) as session:
        chapter = get_target_chapter(session)

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

        delete_chapter_files()

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
"""

if __name__ == "__main__":
    with Session(engine) as session:
        #delete_chapter(session=session,series_slug=SERIES_SLUG, part_slug=PART_SLUG, chapter_slug=CHAPTER_SLUG)
        delete_part(session, series_slug=SERIES_SLUG, part_slug=PART_SLUG)
