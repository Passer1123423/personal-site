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
    Novel,
    NovelChapter,
    NovelTextBuffer,
    NovelUserLink,
    User,
)

from app.services.novel_admin import (
    create_chapter,
    create_novel,
    delete_chapter,
    delete_novel,
    delete_novel_chapter_image,
    get_chapter,
    get_novel,
    get_owner_novels,
    list_novel_chapter_images,
    rename_chapter,
    rename_novel,
    reset_chapter_content,
    reset_novel_summary,
    save_novel_chapter_image,
    set_novel_cover,
    set_novel_owner,
    shift_chapter,
)

from app.services.novel_buffer import (
    create_empty_buffer_for_novel,
    delete_text_buffer,
    get_text_buffer,
    list_user_text_buffers,
    load_chapter_to_buffer,
    publish_buffer_to_existing_chapter,
    publish_buffer_to_new_chapter,
    update_text_buffer,
)

from app.services.activity_logs import log_activity


class CreateNovelRequest(BaseModel):
    slug: str
    title: str | None = None


class CreateChapterRequest(BaseModel):
    slug: str
    customTitle: str | None = None
    content: str | None = ""


class RenameNovelRequest(BaseModel):
    title: str


class SummaryRequest(BaseModel):
    summary: str | None = ""


class RenameChapterRequest(BaseModel):
    customTitle: str | None = None


class ChapterContentRequest(BaseModel):
    content: str | None = ""


class MoveChapterRequest(BaseModel):
    direction: str


class CreateTextBufferRequest(BaseModel):
    contentType: str | None = "markdown"


class UpdateTextBufferRequest(BaseModel):
    content: str | None = ""
    contentType: str | None = None


class PublishNewChapterBufferRequest(BaseModel):
    bufferId: str
    slug: str
    customTitle: str | None = None


class PublishExistingChapterBufferRequest(BaseModel):
    bufferId: str


router = APIRouter(
    prefix="/api/author/novels",
    tags=["author-novels"],
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

def get_chapter_count_for_novel(session: Session, novel_id: str) -> int:
    chapters = session.exec(
        select(NovelChapter).where(NovelChapter.novel_id == novel_id)
    ).all()

    return len(chapters)


def get_novel_snapshot(novel: Novel | None) -> dict | None:
    if not novel:
        return None

    return {
        "id": novel.id,
        "slug": novel.slug,
        "title": novel.title,
        "summary_length": len(novel.summary or ""),
        "cover_asset_id": novel.cover_asset_id,
        "display_order": novel.display_order,
        "created_at": novel.created_at,
        "updated_at": novel.updated_at,
    }


def get_chapter_snapshot(chapter: NovelChapter | None) -> dict | None:
    if not chapter:
        return None

    return {
        "id": chapter.id,
        "novel_id": chapter.novel_id,
        "slug": chapter.slug,
        "title": chapter.title,
        "content_length": len(chapter.content or ""),
        "display_order": chapter.display_order,
        "created_at": chapter.created_at,
        "updated_at": chapter.updated_at,
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


def get_chapter_image_snapshot(image_item: dict | None) -> dict | None:
    if not image_item:
        return None

    return {
        "id": image_item.get("id"),
        "asset_id": image_item.get("assetId"),
        "filename": image_item.get("filename"),
        "original_name": image_item.get("originalName"),
        "mime_type": image_item.get("mimeType"),
        "size": image_item.get("size"),
        "url": image_item.get("url"),
        "display_order": image_item.get("displayOrder"),
        "created_at": image_item.get("createdAt"),
    }

def get_buffer_snapshot(buffer: NovelTextBuffer | None) -> dict | None:
    if not buffer:
        return None

    return {
        "id": buffer.id,
        "user_id": buffer.user_id,
        "novel_id": buffer.novel_id,
        "chapter_id": buffer.chapter_id,
        "content_type": buffer.content_type,
        "content_length": len(buffer.content or ""),
        "created_at": buffer.created_at,
        "updated_at": buffer.updated_at,
    }

def current_user_owns_novel(
    session: Session,
    novel: Novel,
    current_user: User,
) -> bool:
    statement = (
        select(NovelUserLink)
        .where(NovelUserLink.novel_id == novel.id)
        .where(NovelUserLink.user_id == current_user.id)
        .where(NovelUserLink.role == "owner")
    )

    link = session.exec(statement).first()

    return link is not None


def require_owned_novel(
    session: Session,
    novel_slug: str,
    current_user: User,
) -> Novel:
    novel = get_novel(
        session=session,
        novel_slug=novel_slug,
    )

    if not current_user_owns_novel(
        session=session,
        novel=novel,
        current_user=current_user,
    ):
        raise ValueError("只能操作 owner 为自己的 novel")

    return novel


def require_owned_chapter(
    session: Session,
    novel_slug: str,
    chapter_slug: str,
    current_user: User,
) -> tuple[Novel, NovelChapter]:
    novel = require_owned_novel(
        session=session,
        novel_slug=novel_slug,
        current_user=current_user,
    )

    chapter = get_chapter(
        session=session,
        novel=novel,
        chapter_slug=chapter_slug,
    )

    return novel, chapter


def chapter_to_author_item(chapter: NovelChapter) -> dict:
    return {
        "id": chapter.id,
        "slug": chapter.slug,
        "title": chapter.title,
        "content": chapter.content,
        "displayOrder": chapter.display_order,
        "createdAt": chapter.created_at,
        "updatedAt": chapter.updated_at,
    }


def novel_to_author_item(
    session: Session,
    novel: Novel,
    include_chapters: bool = False,
) -> dict:
    item = {
        "id": novel.id,
        "slug": novel.slug,
        "title": novel.title,
        "summary": novel.summary,
        "coverAssetId": novel.cover_asset_id,
        "coverUrl": get_asset_url(session, novel.cover_asset_id),
        "displayOrder": novel.display_order,
        "createdAt": novel.created_at,
        "updatedAt": novel.updated_at,
    }

    if include_chapters:
        chapters = session.exec(
            select(NovelChapter)
            .where(NovelChapter.novel_id == novel.id)
            .order_by(NovelChapter.display_order)
        ).all()

        item["chapters"] = [
            chapter_to_author_item(chapter)
            for chapter in chapters
        ]

    return item


def text_buffer_to_item(buffer: NovelTextBuffer) -> dict:
    return {
        "id": buffer.id,
        "novelId": buffer.novel_id,
        "chapterId": buffer.chapter_id,
        "contentType": buffer.content_type,
        "content": buffer.content,
        "createdAt": buffer.created_at,
        "updatedAt": buffer.updated_at,
    }


@router.get("/tree")
def get_author_novels_tree(
    session: Session = Depends(get_session),
    current_user: User = Depends(require_author_user),
):
    novels = get_owner_novels(
        session=session,
        user=current_user,
    )

    novels = sorted(
        novels,
        key=lambda novel: novel.display_order,
    )

    return [
        novel_to_author_item(
            session=session,
            novel=novel,
            include_chapters=True,
        )
        for novel in novels
    ]

@router.post("/create")
def create_author_novel(
    request: Request,
    payload: CreateNovelRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_author_user),
):
    try:
        novel = create_novel(
            session=session,
            novel_slug=payload.slug,
            title=payload.title,
        )

        set_novel_owner(
            session=session,
            novel_slug=novel.slug,
            username=current_user.username,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    session.refresh(novel)

    log_activity(
        session,
        actor=current_user,
        action="novel.create",
        category="novel",
        target_type="novel",
        target_id=novel.id,
        target_label=novel.title,
        status="success",
        message="作者创建小说",
        metadata={
            "source": "author",
            "novel": get_novel_snapshot(novel),
            "owner": user_to_owner_item(current_user),
        },
        request=request,
    )

    return novel_to_author_item(
        session=session,
        novel=novel,
        include_chapters=True,
    )

@router.post("/{novel_slug}/chapter/create")
def create_author_novel_chapter(
    request: Request,
    novel_slug: str,
    payload: CreateChapterRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_author_user),
):
    try:
        novel = require_owned_novel(
            session=session,
            novel_slug=novel_slug,
            current_user=current_user,
        )

        chapter = create_chapter(
            session=session,
            novel_slug=novel_slug,
            chapter_slug=payload.slug,
            custom_title=payload.customTitle,
            content=payload.content,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    log_activity(
        session,
        actor=current_user,
        action="novel.chapter.create",
        category="novel",
        target_type="novel_chapter",
        target_id=chapter.id,
        target_label=chapter.title,
        status="success",
        message="作者创建小说章节",
        metadata={
            "source": "author",
            "novel": get_novel_snapshot(novel),
            "chapter": get_chapter_snapshot(chapter),
            "content_length": len(payload.content or ""),
        },
        request=request,
    )

    return chapter_to_author_item(chapter)

@router.patch("/{novel_slug}/rename")
def rename_author_novel(
    request: Request,
    novel_slug: str,
    payload: RenameNovelRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_author_user),
):
    try:
        novel_before = require_owned_novel(
            session=session,
            novel_slug=novel_slug,
            current_user=current_user,
        )
        before_snapshot = get_novel_snapshot(novel_before)

        novel = rename_novel(
            session=session,
            novel_slug=novel_slug,
            title=payload.title,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    log_activity(
        session,
        actor=current_user,
        action="novel.rename",
        category="novel",
        target_type="novel",
        target_id=novel.id,
        target_label=novel.title,
        status="success",
        message="作者重命名小说",
        metadata={
            "source": "author",
            "novel_slug": novel_slug,
            "before": before_snapshot,
            "after": get_novel_snapshot(novel),
        },
        request=request,
    )

    return novel_to_author_item(
        session=session,
        novel=novel,
        include_chapters=False,
    )

@router.patch("/{novel_slug}/summary")
def update_author_novel_summary(
    request: Request,
    novel_slug: str,
    payload: SummaryRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_author_user),
):
    try:
        novel_before = require_owned_novel(
            session=session,
            novel_slug=novel_slug,
            current_user=current_user,
        )
        before_snapshot = get_novel_snapshot(novel_before)

        novel = reset_novel_summary(
            session=session,
            novel_slug=novel_slug,
            summary=payload.summary,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    log_activity(
        session,
        actor=current_user,
        action="novel.summary_update",
        category="novel",
        target_type="novel",
        target_id=novel.id,
        target_label=novel.title,
        status="success",
        message="作者更新小说简介",
        metadata={
            "source": "author",
            "novel_slug": novel_slug,
            "old_summary_length": before_snapshot["summary_length"] if before_snapshot else None,
            "new_summary_length": len(novel.summary or ""),
        },
        request=request,
    )

    return novel_to_author_item(
        session=session,
        novel=novel,
        include_chapters=False,
    )

@router.post("/{novel_slug}/cover")
async def upload_author_novel_cover(
    request: Request,
    novel_slug: str,
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_author_user),
):
    try:
        novel_before = require_owned_novel(
            session=session,
            novel_slug=novel_slug,
            current_user=current_user,
        )
        old_cover_asset = get_asset_snapshot(session, novel_before.cover_asset_id)
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
            novel = set_novel_cover(
                session=session,
                novel_slug=novel_slug,
                source_path=source_path,
            )
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc))

    new_cover_asset = get_asset_snapshot(session, novel.cover_asset_id)

    log_activity(
        session,
        actor=current_user,
        action="novel.cover_upload",
        category="novel",
        target_type="novel",
        target_id=novel.id,
        target_label=novel.title,
        status="success",
        message="作者上传小说封面",
        metadata={
            "source": "author",
            "novel_slug": novel_slug,
            "uploaded_original_name": file.filename,
            "old_cover_asset": old_cover_asset,
            "new_cover_asset": new_cover_asset,
        },
        request=request,
    )

    return novel_to_author_item(
        session=session,
        novel=novel,
        include_chapters=False,
    )

@router.patch("/{novel_slug}/{chapter_slug}/rename")
def rename_author_novel_chapter(
    request: Request,
    novel_slug: str,
    chapter_slug: str,
    payload: RenameChapterRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_author_user),
):
    try:
        _, chapter_before = require_owned_chapter(
            session=session,
            novel_slug=novel_slug,
            chapter_slug=chapter_slug,
            current_user=current_user,
        )
        before_snapshot = get_chapter_snapshot(chapter_before)

        chapter = rename_chapter(
            session=session,
            novel_slug=novel_slug,
            chapter_slug=chapter_slug,
            custom_title=payload.customTitle,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    log_activity(
        session,
        actor=current_user,
        action="novel.chapter.rename",
        category="novel",
        target_type="novel_chapter",
        target_id=chapter.id,
        target_label=chapter.title,
        status="success",
        message="作者重命名小说章节",
        metadata={
            "source": "author",
            "novel_slug": novel_slug,
            "chapter_slug": chapter_slug,
            "custom_title": payload.customTitle,
            "before": before_snapshot,
            "after": get_chapter_snapshot(chapter),
        },
        request=request,
    )

    return chapter_to_author_item(chapter)

@router.patch("/{novel_slug}/{chapter_slug}/content")
def update_author_novel_chapter_content(
    request: Request,
    novel_slug: str,
    chapter_slug: str,
    payload: ChapterContentRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_author_user),
):
    """
    直接正式修改 chapter content。

    前端如果采用待传区流程，应该优先使用 text-buffer 接口。
    这个接口保留给简单管理操作。
    """

    try:
        _, chapter_before = require_owned_chapter(
            session=session,
            novel_slug=novel_slug,
            chapter_slug=chapter_slug,
            current_user=current_user,
        )
        before_snapshot = get_chapter_snapshot(chapter_before)

        chapter = reset_chapter_content(
            session=session,
            novel_slug=novel_slug,
            chapter_slug=chapter_slug,
            content=payload.content,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    after_snapshot = get_chapter_snapshot(chapter)

    log_activity(
        session,
        actor=current_user,
        action="novel.chapter.update_content",
        category="novel",
        target_type="novel_chapter",
        target_id=chapter.id,
        target_label=chapter.title,
        status="success",
        message="作者更新小说章节正文",
        metadata={
            "source": "author",
            "novel_slug": novel_slug,
            "chapter_slug": chapter_slug,
            "old_content_length": before_snapshot["content_length"] if before_snapshot else None,
            "new_content_length": after_snapshot["content_length"] if after_snapshot else None,
        },
        request=request,
    )

    return chapter_to_author_item(chapter)

@router.get("/{novel_slug}/{chapter_slug}/images")
def list_author_novel_chapter_images(
    novel_slug: str,
    chapter_slug: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_author_user),
):
    try:
        require_owned_chapter(
            session=session,
            novel_slug=novel_slug,
            chapter_slug=chapter_slug,
            current_user=current_user,
        )

        return list_novel_chapter_images(
            session=session,
            novel_slug=novel_slug,
            chapter_slug=chapter_slug,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

@router.post("/{novel_slug}/{chapter_slug}/images")
async def upload_author_novel_chapter_image(
    request: Request,
    novel_slug: str,
    chapter_slug: str,
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_author_user),
):
    try:
        _, chapter = require_owned_chapter(
            session=session,
            novel_slug=novel_slug,
            chapter_slug=chapter_slug,
            current_user=current_user,
        )

        image_item = await save_novel_chapter_image(
            session=session,
            novel_slug=novel_slug,
            chapter_slug=chapter_slug,
            upload_file=file,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    log_activity(
        session,
        actor=current_user,
        action="novel.chapter.image_upload",
        category="novel",
        target_type="asset",
        target_id=image_item.get("assetId"),
        target_label=image_item.get("originalName") or image_item.get("filename"),
        status="success",
        message="作者上传小说章节正文图片",
        metadata={
            "source": "author",
            "novel_slug": novel_slug,
            "chapter_slug": chapter_slug,
            "chapter": get_chapter_snapshot(chapter),
            "image": get_chapter_image_snapshot(image_item),
        },
        request=request,
    )

    return image_item

@router.delete("/{novel_slug}/{chapter_slug}/images/{image_id}")
def delete_author_novel_chapter_image(
    request: Request,
    novel_slug: str,
    chapter_slug: str,
    image_id: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_author_user),
):
    try:
        _, chapter = require_owned_chapter(
            session=session,
            novel_slug=novel_slug,
            chapter_slug=chapter_slug,
            current_user=current_user,
        )

        images_before = list_novel_chapter_images(
            session=session,
            novel_slug=novel_slug,
            chapter_slug=chapter_slug,
        )
        image_before = next(
            (image for image in images_before if image.get("id") == image_id),
            None,
        )

        images_after = delete_novel_chapter_image(
            session=session,
            novel_slug=novel_slug,
            chapter_slug=chapter_slug,
            image_id=image_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    log_activity(
        session,
        actor=current_user,
        action="novel.chapter.image_delete",
        category="novel",
        target_type="asset",
        target_id=image_before.get("assetId") if image_before else None,
        target_label=(
            image_before.get("originalName")
            if image_before
            else image_id
        ),
        status="success",
        message="作者删除小说章节正文图片",
        metadata={
            "source": "author",
            "novel_slug": novel_slug,
            "chapter_slug": chapter_slug,
            "chapter": get_chapter_snapshot(chapter),
            "image_id": image_id,
            "deleted_image": get_chapter_image_snapshot(image_before),
            "remaining_image_count": len(images_after),
        },
        request=request,
    )

    return images_after

@router.patch("/{novel_slug}/{chapter_slug}/move")
def move_author_novel_chapter(
    request: Request,
    novel_slug: str,
    chapter_slug: str,
    payload: MoveChapterRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_author_user),
):
    try:
        _, chapter_before = require_owned_chapter(
            session=session,
            novel_slug=novel_slug,
            chapter_slug=chapter_slug,
            current_user=current_user,
        )
        before_snapshot = get_chapter_snapshot(chapter_before)

        result = shift_chapter(
            session=session,
            novel_slug=novel_slug,
            chapter_slug=chapter_slug,
            direction=payload.direction,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    if result.get("moved"):
        log_activity(
            session,
            actor=current_user,
            action="novel.chapter.move",
            category="novel",
            target_type="novel_chapter",
            target_id=before_snapshot["id"] if before_snapshot else None,
            target_label=before_snapshot["title"] if before_snapshot else chapter_slug,
            status="success",
            message="作者移动小说章节顺序",
            metadata={
                "source": "author",
                "novel_slug": novel_slug,
                "chapter_slug": chapter_slug,
                "direction": payload.direction,
                "before": before_snapshot,
                "result": result,
            },
            request=request,
        )

    return result

# ===== 文字缓冲区 =====

@router.get("/{novel_slug}/text-buffers")
def list_author_novel_text_buffers(
    novel_slug: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_author_user),
):
    try:
        novel = require_owned_novel(
            session=session,
            novel_slug=novel_slug,
            current_user=current_user,
        )

        buffers = list_user_text_buffers(
            session=session,
            user_id=current_user.id,
            novel_id=novel.id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    return [
        text_buffer_to_item(buffer)
        for buffer in buffers
    ]


@router.post("/{novel_slug}/text-buffer/create")
def create_author_text_buffer(
    novel_slug: str,
    payload: CreateTextBufferRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_author_user),
):
    try:
        novel = require_owned_novel(
            session=session,
            novel_slug=novel_slug,
            current_user=current_user,
        )

        buffer = create_empty_buffer_for_novel(
            session=session,
            user_id=current_user.id,
            novel=novel,
            content_type=payload.contentType,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    return text_buffer_to_item(buffer)


@router.post("/{novel_slug}/{chapter_slug}/text-buffer/load")
def load_author_chapter_to_text_buffer(
    novel_slug: str,
    chapter_slug: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_author_user),
):
    try:
        novel, chapter = require_owned_chapter(
            session=session,
            novel_slug=novel_slug,
            chapter_slug=chapter_slug,
            current_user=current_user,
        )

        buffer = load_chapter_to_buffer(
            session=session,
            user_id=current_user.id,
            novel=novel,
            chapter=chapter,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    return text_buffer_to_item(buffer)


@router.patch("/text-buffer/{buffer_id}")
def update_author_text_buffer(
    buffer_id: str,
    payload: UpdateTextBufferRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_author_user),
):
    try:
        buffer = get_text_buffer(
            session=session,
            buffer_id=buffer_id,
            user_id=current_user.id,
        )

        novel = session.get(Novel, buffer.novel_id)

        if not novel or not current_user_owns_novel(
            session=session,
            novel=novel,
            current_user=current_user,
        ):
            raise ValueError("只能编辑自己 novel 下的文字缓冲区")

        buffer = update_text_buffer(
            session=session,
            buffer_id=buffer_id,
            user_id=current_user.id,
            content=payload.content,
            content_type=payload.contentType,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    return text_buffer_to_item(buffer)


@router.post("/{novel_slug}/{chapter_slug}/text-buffer/publish")
def publish_author_text_buffer_to_existing_chapter(
    request: Request,
    novel_slug: str,
    chapter_slug: str,
    payload: PublishExistingChapterBufferRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_author_user),
):
    try:
        novel, chapter_before = require_owned_chapter(
            session=session,
            novel_slug=novel_slug,
            chapter_slug=chapter_slug,
            current_user=current_user,
        )

        buffer_before = get_text_buffer(
            session=session,
            buffer_id=payload.bufferId,
            user_id=current_user.id,
        )

        buffer_snapshot = get_buffer_snapshot(buffer_before)
        chapter_before_snapshot = get_chapter_snapshot(chapter_before)

        chapter = publish_buffer_to_existing_chapter(
            session=session,
            buffer_id=payload.bufferId,
            user_id=current_user.id,
            novel_slug=novel_slug,
            chapter_slug=chapter_slug,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    after_snapshot = get_chapter_snapshot(chapter)

    log_activity(
        session,
        actor=current_user,
        action="novel.buffer.publish",
        category="novel_buffer",
        target_type="novel_chapter",
        target_id=chapter.id,
        target_label=chapter.title,
        status="success",
        message="作者发布正文缓冲区到已有章节",
        metadata={
            "source": "author",
            "novel": get_novel_snapshot(novel),
            "buffer": buffer_snapshot,
            "chapter_before": chapter_before_snapshot,
            "chapter_after": after_snapshot,
            "old_content_length": chapter_before_snapshot["content_length"] if chapter_before_snapshot else None,
            "new_content_length": after_snapshot["content_length"] if after_snapshot else None,
        },
        request=request,
    )

    return chapter_to_author_item(chapter)


@router.post("/{novel_slug}/text-buffer/publish-new-chapter")
def publish_author_text_buffer_to_new_chapter(
    request: Request,
    novel_slug: str,
    payload: PublishNewChapterBufferRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_author_user),
):
    try:
        novel = require_owned_novel(
            session=session,
            novel_slug=novel_slug,
            current_user=current_user,
        )

        buffer_before = get_text_buffer(
            session=session,
            buffer_id=payload.bufferId,
            user_id=current_user.id,
        )
        buffer_snapshot = get_buffer_snapshot(buffer_before)

        chapter = publish_buffer_to_new_chapter(
            session=session,
            buffer_id=payload.bufferId,
            user_id=current_user.id,
            novel_slug=novel_slug,
            chapter_slug=payload.slug,
            custom_title=payload.customTitle,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    log_activity(
        session,
        actor=current_user,
        action="novel.buffer.publish_new_chapter",
        category="novel_buffer",
        target_type="novel_chapter",
        target_id=chapter.id,
        target_label=chapter.title,
        status="success",
        message="作者发布正文缓冲区为新章节",
        metadata={
            "source": "author",
            "novel": get_novel_snapshot(novel),
            "buffer": buffer_snapshot,
            "chapter": get_chapter_snapshot(chapter),
            "chapter_slug": payload.slug,
            "custom_title": payload.customTitle,
        },
        request=request,
    )

    return chapter_to_author_item(chapter)


@router.delete("/text-buffer/{buffer_id}")
def delete_author_text_buffer(
    buffer_id: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_author_user),
):
    try:
        buffer = get_text_buffer(
            session=session,
            buffer_id=buffer_id,
            user_id=current_user.id,
        )

        novel = session.get(Novel, buffer.novel_id)

        if not novel or not current_user_owns_novel(
            session=session,
            novel=novel,
            current_user=current_user,
        ):
            raise ValueError("只能删除自己 novel 下的文字缓冲区")

        delete_text_buffer(
            session=session,
            buffer_id=buffer_id,
            user_id=current_user.id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    return {
        "deleted": True,
        "bufferId": buffer_id,
    }

@router.delete("/{novel_slug}/{chapter_slug}")
def delete_author_novel_chapter(
    request: Request,
    novel_slug: str,
    chapter_slug: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_author_user),
):
    try:
        novel, chapter = require_owned_chapter(
            session=session,
            novel_slug=novel_slug,
            chapter_slug=chapter_slug,
            current_user=current_user,
        )

        novel_before = get_novel_snapshot(novel)
        chapter_before = get_chapter_snapshot(chapter)

        delete_chapter(
            session=session,
            novel_slug=novel_slug,
            chapter_slug=chapter_slug,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))

    log_activity(
        session,
        actor=current_user,
        action="novel.chapter.delete",
        category="novel",
        target_type="novel_chapter",
        target_id=chapter_before["id"] if chapter_before else None,
        target_label=chapter_before["title"] if chapter_before else chapter_slug,
        status="success",
        message="作者删除小说章节",
        metadata={
            "source": "author",
            "novel": novel_before,
            "chapter": chapter_before,
            "novel_slug": novel_slug,
            "chapter_slug": chapter_slug,
        },
        request=request,
    )

    return {
        "deleted": True,
        "type": "chapter",
        "novelSlug": novel_slug,
        "chapterSlug": chapter_slug,
    }

@router.delete("/{novel_slug}")
def delete_author_novel(
    request: Request,
    novel_slug: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_author_user),
):
    try:
        novel = require_owned_novel(
            session=session,
            novel_slug=novel_slug,
            current_user=current_user,
        )

        novel_before = get_novel_snapshot(novel)

        delete_novel(
            session=session,
            novel_slug=novel_slug,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))

    log_activity(
        session,
        actor=current_user,
        action="novel.delete",
        category="novel",
        target_type="novel",
        target_id=novel_before["id"] if novel_before else None,
        target_label=novel_before["title"] if novel_before else novel_slug,
        status="success",
        message="作者删除小说",
        metadata={
            "source": "author",
            "novel": novel_before,
            "novel_slug": novel_slug,
        },
        request=request,
    )

    return {
        "deleted": True,
        "type": "novel",
        "novelSlug": novel_slug,
    }