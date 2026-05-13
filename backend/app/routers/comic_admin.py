import shutil
import tempfile
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, UploadFile, HTTPException
from sqlmodel import Session, select

from app.database import get_session
from app.dependencies.auth import require_admin_user
from app.models import ComicSeries, ComicPart, ComicChapter, ComicPage

from app.services.comic_admin import (
    import_comic_chapter_from_dir,
    delete_chapter,
    delete_part,
    delete_series,
)


router = APIRouter(
    prefix="/api/admin/comics",
    tags=["admin-comics"],
    dependencies=[Depends(require_admin_user)],
)


@router.get("/tree")
def get_admin_comics_tree(session: Session = Depends(get_session)):
    series_list = session.exec(
        select(ComicSeries).order_by(ComicSeries.display_order)
    ).all()

    result = []

    for series in series_list:
        parts = session.exec(
            select(ComicPart)
            .where(ComicPart.series_id == series.id)
            .order_by(ComicPart.display_order)
        ).all()

        part_items = []

        for part in parts:
            chapters = session.exec(
                select(ComicChapter)
                .where(ComicChapter.part_id == part.id)
                .order_by(ComicChapter.display_order)
            ).all()

            chapter_items = []

            for chapter in chapters:
                pages = session.exec(
                    select(ComicPage).where(ComicPage.chapter_id == chapter.id)
                ).all()

                chapter_items.append(
                    {
                        "id": chapter.id,
                        "slug": chapter.slug,
                        "title": chapter.title,
                        "visibility": chapter.visibility,
                        "displayOrder": chapter.display_order,
                        "pageCount": len(pages),
                    }
                )

            part_items.append(
                {
                    "id": part.id,
                    "slug": part.slug,
                    "title": part.title,
                    "visibility": part.visibility,
                    "displayOrder": part.display_order,
                    "chapters": chapter_items,
                }
            )

        result.append(
            {
                "id": series.id,
                "slug": series.slug,
                "title": series.title,
                "visibility": series.visibility,
                "displayOrder": series.display_order,
                "parts": part_items,
            }
        )

    return result

@router.post("/chapters")
async def create_admin_comic_chapter(
    series_slug: str = Form(...),
    part_slug: str = Form(...),
    chapter_title: str | None = Form(None),
    series_title: str | None = Form(None),
    part_title: str | None = Form(None),
    files: list[UploadFile] = File(...),
    session: Session = Depends(get_session),
):
    if not files:
        raise HTTPException(status_code=400, detail="没有上传图片文件。")

    with tempfile.TemporaryDirectory() as temp_dir:
        temp_path = Path(temp_dir)

        for index, file in enumerate(files, start=1):
            original_name = file.filename or f"page-{index}"
            suffix = Path(original_name).suffix.lower()

            if suffix not in {".jpg", ".jpeg", ".png", ".webp", ".gif"}:
                raise HTTPException(
                    status_code=400,
                    detail=f"不支持的文件类型：{original_name}",
                )

            target_path = temp_path / f"{index:03d}{suffix}"

            with target_path.open("wb") as buffer:
                shutil.copyfileobj(file.file, buffer)

        result = import_comic_chapter_from_dir(
            session=session,
            source_dir=temp_path,
            series_slug=series_slug,
            part_slug=part_slug,
            series_title=series_title,
            part_title=part_title,
            chapter_title=chapter_title,
        )

    return result

@router.delete("/{series_slug}/{part_slug}/{chapter_slug}")
def delete_admin_comic_chapter(
    series_slug: str,
    part_slug: str,
    chapter_slug: str,
    session: Session = Depends(get_session),
):
    try:
        delete_chapter(
            session=session,
            series_slug=series_slug,
            part_slug=part_slug,
            chapter_slug=chapter_slug,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))

    return {
        "deleted": True,
        "seriesSlug": series_slug,
        "partSlug": part_slug,
        "chapterSlug": chapter_slug,
    }

@router.delete("/{series_slug}/{part_slug}")
def delete_admin_comic_part(
    series_slug: str,
    part_slug: str,
    session: Session = Depends(get_session),
):
    try:
        delete_part(
            session=session,
            series_slug=series_slug,
            part_slug=part_slug,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))

    return {
        "deleted": True,
        "type": "part",
        "seriesSlug": series_slug,
        "partSlug": part_slug,
    }

@router.delete("/{series_slug}")
def delete_admin_comic_series(
    series_slug: str,
    session: Session = Depends(get_session),
):
    try:
        delete_series(
            session=session,
            series_slug=series_slug,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))

    return {
        "deleted": True,
        "type": "series",
        "seriesSlug": series_slug,
    }