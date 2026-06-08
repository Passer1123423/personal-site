import shutil
import tempfile
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, UploadFile, HTTPException, Request
from sqlmodel import Session, select

from app.database import get_session
from app.dependencies.auth import require_admin_user
from app.models import (
    Asset,
    ComicSeries,
    ComicPart,
    ComicChapter,
    ComicPage,
    User,
    ComicPartUserLink,
)

from pydantic import BaseModel

from app.services.comic_admin import (
    import_comic_chapter_from_dir,
    delete_chapter,
    delete_part,
    delete_series,
    shift_chapter,
    rename_series,
    rename_part,
    rename_chapter,
    list_owner_candidates,
    get_part_owner,
    set_part_owner,
    reset_series_summary,
    reset_part_summary,
    set_series_cover,
    set_part_cover,
    get_or_create_series,
    get_or_create_part,
    get_series,
    get_part,
    get_chapter,
)
from app.services.activity_logs import log_activity

class MoveChapterRequest(BaseModel):
    direction: str

class RenameTitleRequest(BaseModel):
    title: str


class RenameChapterRequest(BaseModel):
    customTitle: str | None = None

class SummaryRequest(BaseModel):
    summary: str | None = ""

class SetPartOwnerRequest(BaseModel):
    username: str | None = None

def user_to_owner_item(user: User | None):
    if not user:
        return None

    return {
        "id": user.id,
        "username": user.username,
        "displayName": user.display_name,
        "role": user.role,
        "avatarUrl": None,
    }

def get_page_count_for_chapter(session: Session, chapter_id: str) -> int:
    pages = session.exec(
        select(ComicPage).where(ComicPage.chapter_id == chapter_id)
    ).all()

    return len(pages)


def get_chapter_count_for_part(session: Session, part_id: str) -> int:
    chapters = session.exec(
        select(ComicChapter).where(ComicChapter.part_id == part_id)
    ).all()

    return len(chapters)


def get_part_count_for_series(session: Session, series_id: str) -> int:
    parts = session.exec(
        select(ComicPart).where(ComicPart.series_id == series_id)
    ).all()

    return len(parts)


def get_series_snapshot(series: ComicSeries | None) -> dict | None:
    if not series:
        return None

    return {
        "id": series.id,
        "slug": series.slug,
        "title": series.title,
        "summary_length": len(series.summary or ""),
        "cover_asset_id": series.cover_asset_id,
        "visibility": series.visibility,
        "display_order": series.display_order,
    }


def get_part_snapshot(
    session: Session,
    part: ComicPart | None,
) -> dict | None:
    if not part:
        return None

    owner = get_part_owner(session, part)

    return {
        "id": part.id,
        "series_id": part.series_id,
        "slug": part.slug,
        "title": part.title,
        "summary_length": len(part.summary or ""),
        "cover_asset_id": part.cover_asset_id,
        "visibility": part.visibility,
        "display_order": part.display_order,
        "owner": user_to_owner_item(owner),
        "chapter_count": get_chapter_count_for_part(session, part.id),
    }


def get_chapter_snapshot(
    session: Session,
    chapter: ComicChapter | None,
) -> dict | None:
    if not chapter:
        return None

    return {
        "id": chapter.id,
        "part_id": chapter.part_id,
        "slug": chapter.slug,
        "title": chapter.title,
        "visibility": chapter.visibility,
        "display_order": chapter.display_order,
        "page_count": get_page_count_for_chapter(session, chapter.id),
    }


def get_asset_snapshot(session: Session, asset_id: str | None) -> dict | None:
    if not asset_id:
        return None

    asset = session.get(Asset, asset_id)

    if not asset:
        return None

    return {
        "id": asset.id,
        "filename": asset.filename,
        "original_name": asset.original_name,
        "mime_type": asset.mime_type,
        "size": asset.size,
        "url": asset.url,
        "usage": asset.usage,
    }

class CreateComicSeriesRequest(BaseModel):
    slug: str
    title: str | None = None
    summary: str | None = None


class CreateComicPartRequest(BaseModel):
    slug: str
    title: str | None = None
    summary: str | None = None

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

            owner = get_part_owner(session, part)
            part_items.append(
                {
                    "id": part.id,
                    "slug": part.slug,
                    "title": part.title,
                    "summary": part.summary,
                    "coverUrl": session.get(Asset, part.cover_asset_id).url
                    if part.cover_asset_id and session.get(Asset, part.cover_asset_id)
                    else None,
                    "visibility": part.visibility,
                    "displayOrder": part.display_order,
                    "owner": user_to_owner_item(owner),
                    "chapters": chapter_items,
                }
            )

        result.append(
            {
                "id": series.id,
                "slug": series.slug,
                "title": series.title,
                "summary": series.summary,
                "coverUrl": session.get(Asset, series.cover_asset_id).url
                if series.cover_asset_id and session.get(Asset, series.cover_asset_id)
                else None,
                "visibility": series.visibility,
                "displayOrder": series.display_order,
                "parts": part_items,
            }
        )

    return result

@router.get("/owner-candidates")
def get_admin_comic_owner_candidates(
    session: Session = Depends(get_session),
):
    users = list_owner_candidates(session)

    return [user_to_owner_item(user) for user in users]

@router.post("/chapters")
async def create_admin_comic_chapter(
    request: Request,
    series_slug: str = Form(...),
    part_slug: str = Form(...),
    chapter_title: str | None = Form(None),
    series_title: str | None = Form(None),
    part_title: str | None = Form(None),
    files: list[UploadFile] = File(...),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_admin_user),
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

    series = result["series"]
    part = result["part"]
    chapter = result["chapter"]

    log_activity(
        session,
        actor=current_user,
        action="comic.chapter.create",
        category="comic",
        target_type="comic_chapter",
        target_id=chapter.id,
        target_label=chapter.title,
        status="success",
        message="管理员创建漫画章节",
        metadata={
            "source": "admin",
            "series": get_series_snapshot(series),
            "part": get_part_snapshot(session, part),
            "chapter": get_chapter_snapshot(session, chapter),
            "page_count": result.get("page_count"),
            "uploaded_file_count": len(files),
            "uploaded_original_names": [file.filename for file in files],
        },
        request=request,
    )

    return result

@router.delete("/{series_slug}/{part_slug}/{chapter_slug}")
def delete_admin_comic_chapter(
    request: Request,
    series_slug: str,
    part_slug: str,
    chapter_slug: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_admin_user),
):
    try:
        series = get_series(
            session=session,
            series_slug=series_slug,
        )
        part = get_part(
            session=session,
            series=series,
            part_slug=part_slug,
        )
        chapter = get_chapter(
            session=session,
            series=series,
            part=part,
            part_slug=part_slug,
            chapter_slug=chapter_slug,
        )

        series_before = get_series_snapshot(series)
        part_before = get_part_snapshot(session, part)
        chapter_before = get_chapter_snapshot(session, chapter)

        delete_chapter(
            session=session,
            series_slug=series_slug,
            part_slug=part_slug,
            chapter_slug=chapter_slug,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))

    log_activity(
        session,
        actor=current_user,
        action="comic.chapter.delete",
        category="comic",
        target_type="comic_chapter",
        target_id=chapter_before["id"] if chapter_before else None,
        target_label=chapter_before["title"] if chapter_before else chapter_slug,
        status="success",
        message="管理员删除漫画章节",
        metadata={
            "source": "admin",
            "series": series_before,
            "part": part_before,
            "chapter": chapter_before,
            "series_slug": series_slug,
            "part_slug": part_slug,
            "chapter_slug": chapter_slug,
        },
        request=request,
    )

    return {
        "deleted": True,
        "seriesSlug": series_slug,
        "partSlug": part_slug,
        "chapterSlug": chapter_slug,
    }

@router.delete("/{series_slug}/{part_slug}")
def delete_admin_comic_part(
    request: Request,
    series_slug: str,
    part_slug: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_admin_user),
):
    try:
        series = get_series(
            session=session,
            series_slug=series_slug,
        )
        part = get_part(
            session=session,
            series=series,
            part_slug=part_slug,
        )

        series_before = get_series_snapshot(series)
        part_before = get_part_snapshot(session, part)

        delete_part(
            session=session,
            series_slug=series_slug,
            part_slug=part_slug,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))

    log_activity(
        session,
        actor=current_user,
        action="comic.part.delete",
        category="comic",
        target_type="comic_part",
        target_id=part_before["id"] if part_before else None,
        target_label=part_before["title"] if part_before else part_slug,
        status="success",
        message="管理员删除漫画分部",
        metadata={
            "source": "admin",
            "series": series_before,
            "part": part_before,
            "series_slug": series_slug,
            "part_slug": part_slug,
        },
        request=request,
    )

    return {
        "deleted": True,
        "type": "part",
        "seriesSlug": series_slug,
        "partSlug": part_slug,
    }

@router.delete("/{series_slug}")
def delete_admin_comic_series(
    request: Request,
    series_slug: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_admin_user),
):
    try:
        series = get_series(
            session=session,
            series_slug=series_slug,
        )

        series_before = get_series_snapshot(series)
        part_count = get_part_count_for_series(session, series.id)

        delete_series(
            session=session,
            series_slug=series_slug,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))

    log_activity(
        session,
        actor=current_user,
        action="comic.series.delete",
        category="comic",
        target_type="comic_series",
        target_id=series_before["id"] if series_before else None,
        target_label=series_before["title"] if series_before else series_slug,
        status="success",
        message="管理员删除漫画系列",
        metadata={
            "source": "admin",
            "series": series_before,
            "series_slug": series_slug,
            "part_count": part_count,
        },
        request=request,
    )

    return {
        "deleted": True,
        "type": "series",
        "seriesSlug": series_slug,
    }

@router.patch("/{series_slug}/{part_slug}/{chapter_slug}/move")
def move_admin_comic_chapter(
    request: Request,
    series_slug: str,
    part_slug: str,
    chapter_slug: str,
    payload: MoveChapterRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_admin_user),
):
    try:
        chapter_before = get_chapter(
            session=session,
            series_slug=series_slug,
            part_slug=part_slug,
            chapter_slug=chapter_slug,
        )
        chapter_before_snapshot = get_chapter_snapshot(session, chapter_before)

        result = shift_chapter(
            session=session,
            series_slug=series_slug,
            part_slug=part_slug,
            chapter_slug=chapter_slug,
            direction=payload.direction,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    if result.get("moved"):
        log_activity(
            session,
            actor=current_user,
            action="comic.chapter.move",
            category="comic",
            target_type="comic_chapter",
            target_id=chapter_before_snapshot["id"] if chapter_before_snapshot else None,
            target_label=chapter_before_snapshot["title"] if chapter_before_snapshot else chapter_slug,
            status="success",
            message="管理员移动漫画章节顺序",
            metadata={
                "source": "admin",
                "series_slug": series_slug,
                "part_slug": part_slug,
                "chapter_slug": chapter_slug,
                "direction": payload.direction,
                "before": chapter_before_snapshot,
                "result": result,
            },
            request=request,
        )

    return result

@router.patch("/{series_slug}/rename")
def rename_admin_comic_series(
    request: Request,
    series_slug: str,
    payload: RenameTitleRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_admin_user),
):
    try:
        series_before = get_series(
            session=session,
            series_slug=series_slug,
        )
        before_snapshot = get_series_snapshot(series_before)

        series = rename_series(
            session=session,
            series_slug=series_slug,
            title=payload.title,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    log_activity(
        session,
        actor=current_user,
        action="comic.series.rename",
        category="comic",
        target_type="comic_series",
        target_id=series.id,
        target_label=series.title,
        status="success",
        message="管理员重命名漫画系列",
        metadata={
            "source": "admin",
            "series_slug": series_slug,
            "before": before_snapshot,
            "after": get_series_snapshot(series),
        },
        request=request,
    )

    return {
        "id": series.id,
        "slug": series.slug,
        "title": series.title,
        "visibility": series.visibility,
        "displayOrder": series.display_order,
    }

@router.patch("/{series_slug}/{part_slug}/rename")
def rename_admin_comic_part(
    request: Request,
    series_slug: str,
    part_slug: str,
    payload: RenameTitleRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_admin_user),
):
    try:
        part_before = get_part(
            session=session,
            series_slug=series_slug,
            part_slug=part_slug,
        )
        before_snapshot = get_part_snapshot(session, part_before)

        part = rename_part(
            session=session,
            series_slug=series_slug,
            part_slug=part_slug,
            title=payload.title,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    log_activity(
        session,
        actor=current_user,
        action="comic.part.rename",
        category="comic",
        target_type="comic_part",
        target_id=part.id,
        target_label=part.title,
        status="success",
        message="管理员重命名漫画分部",
        metadata={
            "source": "admin",
            "series_slug": series_slug,
            "part_slug": part_slug,
            "before": before_snapshot,
            "after": get_part_snapshot(session, part),
        },
        request=request,
    )

    return {
        "id": part.id,
        "slug": part.slug,
        "title": part.title,
        "visibility": part.visibility,
        "displayOrder": part.display_order,
    }

@router.patch("/{series_slug}/{part_slug}/{chapter_slug}/rename")
def rename_admin_comic_chapter(
    request: Request,
    series_slug: str,
    part_slug: str,
    chapter_slug: str,
    payload: RenameChapterRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_admin_user),
):
    try:
        chapter_before = get_chapter(
            session=session,
            series_slug=series_slug,
            part_slug=part_slug,
            chapter_slug=chapter_slug,
        )
        before_snapshot = get_chapter_snapshot(session, chapter_before)

        chapter = rename_chapter(
            session=session,
            series_slug=series_slug,
            part_slug=part_slug,
            chapter_slug=chapter_slug,
            custom_title=payload.customTitle,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    log_activity(
        session,
        actor=current_user,
        action="comic.chapter.rename",
        category="comic",
        target_type="comic_chapter",
        target_id=chapter.id,
        target_label=chapter.title,
        status="success",
        message="管理员重命名漫画章节",
        metadata={
            "source": "admin",
            "series_slug": series_slug,
            "part_slug": part_slug,
            "chapter_slug": chapter_slug,
            "custom_title": payload.customTitle,
            "before": before_snapshot,
            "after": get_chapter_snapshot(session, chapter),
        },
        request=request,
    )

    return {
        "id": chapter.id,
        "slug": chapter.slug,
        "title": chapter.title,
        "visibility": chapter.visibility,
        "displayOrder": chapter.display_order,
    }

@router.patch("/{series_slug}/{part_slug}/owner")
def set_admin_comic_part_owner(
    request: Request,
    series_slug: str,
    part_slug: str,
    payload: SetPartOwnerRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_admin_user),
):
    try:
        part_before = get_part(
            session=session,
            series_slug=series_slug,
            part_slug=part_slug,
        )
        before_snapshot = get_part_snapshot(session, part_before)

        owner = set_part_owner(
            session=session,
            series_slug=series_slug,
            part_slug=part_slug,
            username=payload.username,
        )

        part_after = get_part(
            session=session,
            series_slug=series_slug,
            part_slug=part_slug,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    log_activity(
        session,
        actor=current_user,
        action="comic.part.owner_update",
        category="comic",
        target_type="comic_part",
        target_id=part_after.id,
        target_label=part_after.title,
        status="success",
        message="管理员更新漫画分部 owner",
        metadata={
            "source": "admin",
            "series_slug": series_slug,
            "part_slug": part_slug,
            "new_owner_username": payload.username,
            "before": before_snapshot,
            "after": get_part_snapshot(session, part_after),
        },
        request=request,
    )

    return {
        "seriesSlug": series_slug,
        "partSlug": part_slug,
        "owner": user_to_owner_item(owner),
    }

@router.patch("/{series_slug}/summary")
def update_admin_comic_series_summary(
    request: Request,
    series_slug: str,
    payload: SummaryRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_admin_user),
):
    try:
        series_before = get_series(
            session=session,
            series_slug=series_slug,
        )
        before_snapshot = get_series_snapshot(series_before)

        series = reset_series_summary(
            session=session,
            series_slug=series_slug,
            summary=payload.summary,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    log_activity(
        session,
        actor=current_user,
        action="comic.series.summary_update",
        category="comic",
        target_type="comic_series",
        target_id=series.id,
        target_label=series.title,
        status="success",
        message="管理员更新漫画系列简介",
        metadata={
            "source": "admin",
            "series_slug": series_slug,
            "old_summary_length": before_snapshot["summary_length"] if before_snapshot else None,
            "new_summary_length": len(series.summary or ""),
        },
        request=request,
    )

    return {
        "id": series.id,
        "slug": series.slug,
        "title": series.title,
        "summary": series.summary,
        "visibility": series.visibility,
        "displayOrder": series.display_order,
    }

@router.patch("/{series_slug}/{part_slug}/summary")
def update_admin_comic_part_summary(
    request: Request,
    series_slug: str,
    part_slug: str,
    payload: SummaryRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_admin_user),
):
    try:
        part_before = get_part(
            session=session,
            series_slug=series_slug,
            part_slug=part_slug,
        )
        before_snapshot = get_part_snapshot(session, part_before)

        part = reset_part_summary(
            session=session,
            series_slug=series_slug,
            part_slug=part_slug,
            summary=payload.summary,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    log_activity(
        session,
        actor=current_user,
        action="comic.part.summary_update",
        category="comic",
        target_type="comic_part",
        target_id=part.id,
        target_label=part.title,
        status="success",
        message="管理员更新漫画分部简介",
        metadata={
            "source": "admin",
            "series_slug": series_slug,
            "part_slug": part_slug,
            "old_summary_length": before_snapshot["summary_length"] if before_snapshot else None,
            "new_summary_length": len(part.summary or ""),
        },
        request=request,
    )

    return {
        "id": part.id,
        "slug": part.slug,
        "title": part.title,
        "summary": part.summary,
        "visibility": part.visibility,
        "displayOrder": part.display_order,
    }

@router.post("/{series_slug}/cover")
async def upload_admin_comic_series_cover(
    request: Request,
    series_slug: str,
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_admin_user),
):
    series_before = get_series(
        session=session,
        series_slug=series_slug,
    )
    old_cover_asset = get_asset_snapshot(session, series_before.cover_asset_id)
    with tempfile.TemporaryDirectory() as temp_dir:
        temp_path = Path(temp_dir)

        original_name = file.filename or "cover"
        suffix = Path(original_name).suffix.lower()

        if suffix not in {".jpg", ".jpeg", ".png", ".webp", ".gif"}:
            raise HTTPException(
                status_code=400,
                detail=f"不支持的文件类型：{original_name}",
            )

        source_path = temp_path / f"cover{suffix}"

        with source_path.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        try:
            series = set_series_cover(
                session=session,
                series_slug=series_slug,
                source_path=source_path,
            )
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc))

    new_cover_asset = get_asset_snapshot(session, series.cover_asset_id)

    log_activity(
        session,
        actor=current_user,
        action="comic.series.cover_upload",
        category="comic",
        target_type="comic_series",
        target_id=series.id,
        target_label=series.title,
        status="success",
        message="管理员上传漫画系列封面",
        metadata={
            "source": "admin",
            "series_slug": series_slug,
            "uploaded_original_name": file.filename,
            "old_cover_asset": old_cover_asset,
            "new_cover_asset": new_cover_asset,
        },
        request=request,
    )

    return {
        "id": series.id,
        "slug": series.slug,
        "title": series.title,
        "summary": series.summary,
        "coverUrl": session.get(Asset, series.cover_asset_id).url,
        "visibility": series.visibility,
        "displayOrder": series.display_order,
    }


@router.post("/{series_slug}/{part_slug}/cover")
async def upload_admin_comic_part_cover(
    request: Request,
    series_slug: str,
    part_slug: str,
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_admin_user),
):
    part_before = get_part(
        session=session,
        series_slug=series_slug,
        part_slug=part_slug,
    )
    old_cover_asset = get_asset_snapshot(session, part_before.cover_asset_id)
    with tempfile.TemporaryDirectory() as temp_dir:
        temp_path = Path(temp_dir)

        original_name = file.filename or "cover"
        suffix = Path(original_name).suffix.lower()

        if suffix not in {".jpg", ".jpeg", ".png", ".webp", ".gif"}:
            raise HTTPException(
                status_code=400,
                detail=f"不支持的文件类型：{original_name}",
            )

        source_path = temp_path / f"cover{suffix}"

        with source_path.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        try:
            part = set_part_cover(
                session=session,
                series_slug=series_slug,
                part_slug=part_slug,
                source_path=source_path,
            )
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc))

    new_cover_asset = get_asset_snapshot(session, part.cover_asset_id)

    log_activity(
        session,
        actor=current_user,
        action="comic.part.cover_upload",
        category="comic",
        target_type="comic_part",
        target_id=part.id,
        target_label=part.title,
        status="success",
        message="管理员上传漫画分部封面",
        metadata={
            "source": "admin",
            "series_slug": series_slug,
            "part_slug": part_slug,
            "uploaded_original_name": file.filename,
            "old_cover_asset": old_cover_asset,
            "new_cover_asset": new_cover_asset,
        },
        request=request,
    )

    return {
        "id": part.id,
        "slug": part.slug,
        "title": part.title,
        "summary": part.summary,
        "coverUrl": session.get(Asset, part.cover_asset_id).url,
        "visibility": part.visibility,
        "displayOrder": part.display_order,
    }

@router.post("/series/create")
def create_comic_series(
    request: Request,
    payload: CreateComicSeriesRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_admin_user),
):
    series_slug = payload.slug.strip()

    if not series_slug:
        raise HTTPException(
            status_code=400,
            detail="series slug 不能为空",
        )

    existing_series = session.exec(
        select(ComicSeries).where(ComicSeries.slug == series_slug)
    ).first()

    if existing_series:
        raise HTTPException(
            status_code=409,
            detail="这个 series slug 已存在，slug 是不可更改的唯一识别码，请换一个",
        )

    series = get_or_create_series(
        session=session,
        series_slug=series_slug,
        series_title=payload.title,
        series_summary=payload.summary,
    )

    log_activity(
        session,
        actor=current_user,
        action="comic.series.create",
        category="comic",
        target_type="comic_series",
        target_id=series.id,
        target_label=series.title,
        status="success",
        message="管理员创建漫画系列",
        metadata={
            "source": "admin",
            "series": get_series_snapshot(series),
        },
        request=request,
    )

    return {
        "id": series.id,
        "slug": series.slug,
        "title": series.title,
        "summary": series.summary,
        "visibility": series.visibility,
        "displayOrder": series.display_order,
    }

@router.post("/{series_slug}/part/create")
def create_comic_part(
    request: Request,
    series_slug: str,
    payload: CreateComicPartRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_admin_user),
):
    clean_series_slug = series_slug.strip()
    part_slug = payload.slug.strip()

    if not part_slug:
        raise HTTPException(
            status_code=400,
            detail="part slug 不能为空",
        )

    series = session.exec(
        select(ComicSeries).where(ComicSeries.slug == clean_series_slug)
    ).first()

    if not series:
        raise HTTPException(
            status_code=404,
            detail="series 不存在，不能在不存在的 series 下新建 part",
        )

    existing_part = session.exec(
        select(ComicPart)
        .where(ComicPart.series_id == series.id)
        .where(ComicPart.slug == part_slug)
    ).first()

    if existing_part:
        raise HTTPException(
            status_code=409,
            detail="这个 part slug 已存在，slug 是不可更改的唯一识别码，请换一个",
        )

    part = get_or_create_part(
        session=session,
        series=series,
        part_slug=part_slug,
        part_title=payload.title,
        part_summary=payload.summary,
    )

    existing_link = session.exec(
        select(ComicPartUserLink)
        .where(ComicPartUserLink.part_id == part.id)
        .where(ComicPartUserLink.user_id == current_user.id)
    ).first()

    if not existing_link:
        link = ComicPartUserLink(
            part_id=part.id,
            user_id=current_user.id,
            role="owner",
        )
        session.add(link)
        session.commit()

    session.refresh(part)

    log_activity(
        session,
        actor=current_user,
        action="comic.part.create",
        category="comic",
        target_type="comic_part",
        target_id=part.id,
        target_label=part.title,
        status="success",
        message="管理员创建漫画分部",
        metadata={
            "source": "admin",
            "series": get_series_snapshot(series),
            "part": get_part_snapshot(session, part),
            "owner": user_to_owner_item(current_user),
        },
        request=request,
    )

    return {
        "id": part.id,
        "slug": part.slug,
        "title": part.title,
        "summary": part.summary,
        "visibility": part.visibility,
        "displayOrder": part.display_order,
        "owner": user_to_owner_item(current_user),
    }