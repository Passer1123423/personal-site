import shutil
import tempfile
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
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
    get_chapter,
    get_novel,
    get_owner_novels,
    rename_chapter,
    rename_novel,
    reset_chapter_content,
    reset_novel_summary,
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

    return novel_to_author_item(
        session=session,
        novel=novel,
        include_chapters=True,
    )


@router.post("/{novel_slug}/chapter/create")
def create_author_novel_chapter(
    novel_slug: str,
    payload: CreateChapterRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_author_user),
):
    try:
        require_owned_novel(
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

    return chapter_to_author_item(chapter)


@router.patch("/{novel_slug}/rename")
def rename_author_novel(
    novel_slug: str,
    payload: RenameNovelRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_author_user),
):
    try:
        require_owned_novel(
            session=session,
            novel_slug=novel_slug,
            current_user=current_user,
        )

        novel = rename_novel(
            session=session,
            novel_slug=novel_slug,
            title=payload.title,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    return novel_to_author_item(
        session=session,
        novel=novel,
        include_chapters=False,
    )


@router.patch("/{novel_slug}/summary")
def update_author_novel_summary(
    novel_slug: str,
    payload: SummaryRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_author_user),
):
    try:
        require_owned_novel(
            session=session,
            novel_slug=novel_slug,
            current_user=current_user,
        )

        novel = reset_novel_summary(
            session=session,
            novel_slug=novel_slug,
            summary=payload.summary,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    return novel_to_author_item(
        session=session,
        novel=novel,
        include_chapters=False,
    )


@router.post("/{novel_slug}/cover")
async def upload_author_novel_cover(
    novel_slug: str,
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_author_user),
):
    try:
        require_owned_novel(
            session=session,
            novel_slug=novel_slug,
            current_user=current_user,
        )
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

    return novel_to_author_item(
        session=session,
        novel=novel,
        include_chapters=False,
    )


@router.patch("/{novel_slug}/{chapter_slug}/rename")
def rename_author_novel_chapter(
    novel_slug: str,
    chapter_slug: str,
    payload: RenameChapterRequest,
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

        chapter = rename_chapter(
            session=session,
            novel_slug=novel_slug,
            chapter_slug=chapter_slug,
            custom_title=payload.customTitle,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    return chapter_to_author_item(chapter)


@router.patch("/{novel_slug}/{chapter_slug}/content")
def update_author_novel_chapter_content(
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
        require_owned_chapter(
            session=session,
            novel_slug=novel_slug,
            chapter_slug=chapter_slug,
            current_user=current_user,
        )

        chapter = reset_chapter_content(
            session=session,
            novel_slug=novel_slug,
            chapter_slug=chapter_slug,
            content=payload.content,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    return chapter_to_author_item(chapter)


@router.patch("/{novel_slug}/{chapter_slug}/move")
def move_author_novel_chapter(
    novel_slug: str,
    chapter_slug: str,
    payload: MoveChapterRequest,
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

        result = shift_chapter(
            session=session,
            novel_slug=novel_slug,
            chapter_slug=chapter_slug,
            direction=payload.direction,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    return result


@router.delete("/{novel_slug}/{chapter_slug}")
def delete_author_novel_chapter(
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

        delete_chapter(
            session=session,
            novel_slug=novel_slug,
            chapter_slug=chapter_slug,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))

    return {
        "deleted": True,
        "type": "chapter",
        "novelSlug": novel_slug,
        "chapterSlug": chapter_slug,
    }


@router.delete("/{novel_slug}")
def delete_author_novel(
    novel_slug: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_author_user),
):
    try:
        require_owned_novel(
            session=session,
            novel_slug=novel_slug,
            current_user=current_user,
        )

        delete_novel(
            session=session,
            novel_slug=novel_slug,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))

    return {
        "deleted": True,
        "type": "novel",
        "novelSlug": novel_slug,
    }


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
    novel_slug: str,
    chapter_slug: str,
    payload: PublishExistingChapterBufferRequest,
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

        chapter = publish_buffer_to_existing_chapter(
            session=session,
            buffer_id=payload.bufferId,
            user_id=current_user.id,
            novel_slug=novel_slug,
            chapter_slug=chapter_slug,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    return chapter_to_author_item(chapter)


@router.post("/{novel_slug}/text-buffer/publish-new-chapter")
def publish_author_text_buffer_to_new_chapter(
    novel_slug: str,
    payload: PublishNewChapterBufferRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_author_user),
):
    try:
        require_owned_novel(
            session=session,
            novel_slug=novel_slug,
            current_user=current_user,
        )

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
