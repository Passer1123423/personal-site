import shutil
import tempfile
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from pydantic import BaseModel
from sqlmodel import Session, select

from app.database import get_session
from app.dependencies.auth import require_author_user
from app.models import (
    Asset,
    ComicSeries,
    ComicPart,
    ComicChapter,
    ComicPage,
    ComicPartUserLink,
    User,
)
from app.services.comic_admin import (
    delete_chapter,
    get_chapter,
    get_or_create_part,
    get_or_create_series,
    get_part,
    get_series,
    rename_chapter,
    rename_part,
    rename_series,
    reset_part_summary,
    reset_series_summary,
    set_part_cover,
    set_series_cover,
    shift_chapter,
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


class CreateComicSeriesRequest(BaseModel):
    slug: str
    title: str | None = None
    summary: str | None = None


class CreateComicPartRequest(BaseModel):
    slug: str
    title: str | None = None
    summary: str | None = None


router = APIRouter(
    prefix="/api/author/comics",
    tags=["author-comics"],
    dependencies=[Depends(require_author_user)],
)


def get_asset_url(session: Session, asset_id: str | None) -> str | None:
    if not asset_id:
        return None

    asset = session.get(Asset, asset_id)

    if not asset:
        return None

    return asset.url


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


def current_user_owns_part(
    session: Session,
    part: ComicPart,
    current_user: User,
) -> bool:
    statement = (
        select(ComicPartUserLink)
        .where(ComicPartUserLink.part_id == part.id)
        .where(ComicPartUserLink.user_id == current_user.id)
        .where(ComicPartUserLink.role == "owner")
    )

    link = session.exec(statement).first()

    return link is not None


def require_owned_part(
    session: Session,
    series_slug: str,
    part_slug: str,
    current_user: User,
) -> ComicPart:
    part = get_part(
        session=session,
        series_slug=series_slug,
        part_slug=part_slug,
    )

    if not current_user_owns_part(
        session=session,
        part=part,
        current_user=current_user,
    ):
        raise ValueError("只能操作 owner 为自己的 part")

    return part


def require_owned_chapter(
    session: Session,
    series_slug: str,
    part_slug: str,
    chapter_slug: str,
    current_user: User,
) -> tuple[ComicPart, ComicChapter]:
    part = require_owned_part(
        session=session,
        series_slug=series_slug,
        part_slug=part_slug,
        current_user=current_user,
    )

    chapter = get_chapter(
        session=session,
        series_slug=series_slug,
        part=part,
        part_slug=part_slug,
        chapter_slug=chapter_slug,
    )

    return part, chapter


def chapter_to_author_item(
    session: Session,
    chapter: ComicChapter,
) -> dict:
    pages = session.exec(
        select(ComicPage).where(ComicPage.chapter_id == chapter.id)
    ).all()

    return {
        "id": chapter.id,
        "slug": chapter.slug,
        "title": chapter.title,
        "visibility": chapter.visibility,
        "displayOrder": chapter.display_order,
        "pageCount": len(pages),
    }


def part_to_author_item(
    session: Session,
    part: ComicPart,
    include_chapters: bool = True,
) -> dict:
    owner = get_part_owner(session, part)

    item = {
        "id": part.id,
        "slug": part.slug,
        "title": part.title,
        "summary": part.summary,
        "coverUrl": get_asset_url(session, part.cover_asset_id),
        "visibility": part.visibility,
        "displayOrder": part.display_order,
        "owner": user_to_owner_item(owner),
        "chapters": [],
    }

    if include_chapters:
        chapters = session.exec(
            select(ComicChapter)
            .where(ComicChapter.part_id == part.id)
            .order_by(ComicChapter.display_order)
        ).all()

        item["chapters"] = [
            chapter_to_author_item(session, chapter)
            for chapter in chapters
        ]

    return item


def series_to_author_item(
    session: Session,
    series: ComicSeries,
    current_user: User,
    include_parts: bool = True,
) -> dict:
    item = {
        "id": series.id,
        "slug": series.slug,
        "title": series.title,
        "summary": series.summary,
        "coverUrl": get_asset_url(session, series.cover_asset_id),
        "visibility": series.visibility,
        "displayOrder": series.display_order,
        "parts": [],
    }

    if include_parts:
        parts = session.exec(
            select(ComicPart)
            .where(ComicPart.series_id == series.id)
            .order_by(ComicPart.display_order)
        ).all()

        item["parts"] = [
            part_to_author_item(session, part, include_chapters=True)
            for part in parts
            if current_user_owns_part(
                session=session,
                part=part,
                current_user=current_user,
            )
        ]

    return item


@router.get("/tree")
def get_author_comics_tree(
    session: Session = Depends(get_session),
    current_user: User = Depends(require_author_user),
):
    series_list = session.exec(
        select(ComicSeries).order_by(ComicSeries.display_order)
    ).all()

    return [
        series_to_author_item(
            session=session,
            series=series,
            current_user=current_user,
            include_parts=True,
        )
        for series in series_list
    ]


@router.post("/series/create")
def create_author_comic_series(
    request: Request,
    payload: CreateComicSeriesRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_author_user),
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

    try:
        series = get_or_create_series(
            session=session,
            series_slug=series_slug,
            series_title=payload.title,
            series_summary=payload.summary,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    log_activity(
        session,
        actor=current_user,
        action="comic.series.create",
        category="comic",
        target_type="comic_series",
        target_id=series.id,
        target_label=series.title,
        status="success",
        message="作者创建漫画系列",
        metadata={
            "source": "author",
            "series": get_series_snapshot(series),
        },
        request=request,
    )

    return {
        "id": series.id,
        "slug": series.slug,
        "title": series.title,
        "summary": series.summary,
        "coverUrl": get_asset_url(session, series.cover_asset_id),
        "visibility": series.visibility,
        "displayOrder": series.display_order,
        "parts": [],
    }


@router.post("/{series_slug}/part/create")
def create_author_comic_part(
    request: Request,
    series_slug: str,
    payload: CreateComicPartRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_author_user),
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

    try:
        part = get_or_create_part(
            session=session,
            series=series,
            part_slug=part_slug,
            part_title=payload.title,
            part_summary=payload.summary,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

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
        message="作者创建漫画分部",
        metadata={
            "source": "author",
            "series": get_series_snapshot(series),
            "part": get_part_snapshot(session, part),
            "owner": user_to_owner_item(current_user),
        },
        request=request,
    )

    return part_to_author_item(
        session=session,
        part=part,
        include_chapters=True,
    )

@router.patch("/{series_slug}/rename")
def rename_author_comic_series(
    request: Request,
    series_slug: str,
    payload: RenameTitleRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_author_user),
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
        message="作者重命名漫画系列",
        metadata={
            "source": "author",
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
        "summary": series.summary,
        "coverUrl": get_asset_url(session, series.cover_asset_id),
        "visibility": series.visibility,
        "displayOrder": series.display_order,
        "parts": [],
    }

@router.patch("/{series_slug}/summary")
def update_author_comic_series_summary(
    request: Request,
    series_slug: str,
    payload: SummaryRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_author_user),
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
        message="作者更新漫画系列简介",
        metadata={
            "source": "author",
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
        "coverUrl": get_asset_url(session, series.cover_asset_id),
        "visibility": series.visibility,
        "displayOrder": series.display_order,
        "parts": [],
    }

@router.post("/{series_slug}/cover")
async def upload_author_comic_series_cover(
    request: Request,
    series_slug: str,
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_author_user),
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
        message="作者上传漫画系列封面",
        metadata={
            "source": "author",
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
        "coverUrl": get_asset_url(session, series.cover_asset_id),
        "visibility": series.visibility,
        "displayOrder": series.display_order,
        "parts": [],
    }

@router.patch("/{series_slug}/{part_slug}/rename")
def rename_author_comic_part(
    request: Request,
    series_slug: str,
    part_slug: str,
    payload: RenameTitleRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_author_user),
):
    try:
        part_before = require_owned_part(
            session=session,
            series_slug=series_slug,
            part_slug=part_slug,
            current_user=current_user,
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
        message="作者重命名漫画分部",
        metadata={
            "source": "author",
            "series_slug": series_slug,
            "part_slug": part_slug,
            "before": before_snapshot,
            "after": get_part_snapshot(session, part),
        },
        request=request,
    )

    return part_to_author_item(
        session=session,
        part=part,
        include_chapters=True,
    )

@router.patch("/{series_slug}/{part_slug}/summary")
def update_author_comic_part_summary(
    request: Request,
    series_slug: str,
    part_slug: str,
    payload: SummaryRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_author_user),
):
    try:
        part_before = require_owned_part(
            session=session,
            series_slug=series_slug,
            part_slug=part_slug,
            current_user=current_user,
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
        message="作者更新漫画分部简介",
        metadata={
            "source": "author",
            "series_slug": series_slug,
            "part_slug": part_slug,
            "old_summary_length": before_snapshot["summary_length"] if before_snapshot else None,
            "new_summary_length": len(part.summary or ""),
        },
        request=request,
    )

    return part_to_author_item(
        session=session,
        part=part,
        include_chapters=True,
    )

@router.post("/{series_slug}/{part_slug}/cover")
async def upload_author_comic_part_cover(
    request: Request,
    series_slug: str,
    part_slug: str,
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_author_user),
):
    try:
        part_before = require_owned_part(
            session=session,
            series_slug=series_slug,
            part_slug=part_slug,
            current_user=current_user,
        )
        old_cover_asset = get_asset_snapshot(session, part_before.cover_asset_id)
    except ValueError as exc:
        raise HTTPException(status_code=403, detail=str(exc))

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
        message="作者上传漫画分部封面",
        metadata={
            "source": "author",
            "series_slug": series_slug,
            "part_slug": part_slug,
            "uploaded_original_name": file.filename,
            "old_cover_asset": old_cover_asset,
            "new_cover_asset": new_cover_asset,
        },
        request=request,
    )

    return part_to_author_item(
        session=session,
        part=part,
        include_chapters=True,
    )

@router.patch("/{series_slug}/{part_slug}/{chapter_slug}/rename")
def rename_author_comic_chapter(
    request: Request,
    series_slug: str,
    part_slug: str,
    chapter_slug: str,
    payload: RenameChapterRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_author_user),
):
    try:
        _, chapter_before = require_owned_chapter(
            session=session,
            series_slug=series_slug,
            part_slug=part_slug,
            chapter_slug=chapter_slug,
            current_user=current_user,
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
        message="作者重命名漫画章节",
        metadata={
            "source": "author",
            "series_slug": series_slug,
            "part_slug": part_slug,
            "chapter_slug": chapter_slug,
            "custom_title": payload.customTitle,
            "before": before_snapshot,
            "after": get_chapter_snapshot(session, chapter),
        },
        request=request,
    )

    return chapter_to_author_item(
        session=session,
        chapter=chapter,
    )

@router.patch("/{series_slug}/{part_slug}/{chapter_slug}/move")
def move_author_comic_chapter(
    request: Request,
    series_slug: str,
    part_slug: str,
    chapter_slug: str,
    payload: MoveChapterRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_author_user),
):
    try:
        _, chapter_before = require_owned_chapter(
            session=session,
            series_slug=series_slug,
            part_slug=part_slug,
            chapter_slug=chapter_slug,
            current_user=current_user,
        )
        before_snapshot = get_chapter_snapshot(session, chapter_before)

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
            target_id=before_snapshot["id"] if before_snapshot else None,
            target_label=before_snapshot["title"] if before_snapshot else chapter_slug,
            status="success",
            message="作者移动漫画章节顺序",
            metadata={
                "source": "author",
                "series_slug": series_slug,
                "part_slug": part_slug,
                "chapter_slug": chapter_slug,
                "direction": payload.direction,
                "before": before_snapshot,
                "result": result,
            },
            request=request,
        )

    return result

@router.delete("/{series_slug}/{part_slug}/{chapter_slug}")
def delete_author_comic_chapter(
    request: Request,
    series_slug: str,
    part_slug: str,
    chapter_slug: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_author_user),
):
    try:
        part, chapter = require_owned_chapter(
            session=session,
            series_slug=series_slug,
            part_slug=part_slug,
            chapter_slug=chapter_slug,
            current_user=current_user,
        )

        series = get_series(
            session=session,
            series_slug=series_slug,
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
        message="作者删除漫画章节",
        metadata={
            "source": "author",
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
        "type": "chapter",
        "seriesSlug": series_slug,
        "partSlug": part_slug,
        "chapterSlug": chapter_slug,
    }