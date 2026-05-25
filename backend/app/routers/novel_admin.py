from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.database import get_session
from app.dependencies.auth import require_admin_user
from app.models import Asset, Novel, NovelChapter, User

from app.services.novel_admin import (
    create_novel,
    create_chapter,
    delete_chapter,
    delete_novel,
    get_novel_owner,
    list_owner_candidates,
    rename_chapter,
    rename_novel,
    reset_chapter_content,
    set_novel_owner,
    shift_chapter,
)


class MoveChapterRequest(BaseModel):
    direction: str


class RenameTitleRequest(BaseModel):
    title: str


class RenameChapterRequest(BaseModel):
    customTitle: str | None = None


class ChapterContentRequest(BaseModel):
    content: str | None = ""


class SetNovelOwnerRequest(BaseModel):
    username: str | None = None


class CreateNovelRequest(BaseModel):
    slug: str
    title: str | None = None


class CreateNovelChapterRequest(BaseModel):
    slug: str
    customTitle: str | None = None
    content: str | None = ""


router = APIRouter(
    prefix="/api/admin/novels",
    tags=["admin-novels"],
    dependencies=[Depends(require_admin_user)],
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


def chapter_to_admin_item(chapter: NovelChapter) -> dict:
    return {
        "id": chapter.id,
        "slug": chapter.slug,
        "title": chapter.title,
        "displayOrder": chapter.display_order,
        "createdAt": chapter.created_at,
        "updatedAt": chapter.updated_at,
    }


def novel_to_admin_item(
    session: Session,
    novel: Novel,
    include_chapters: bool = False,
) -> dict:
    item = {
        "id": novel.id,
        "slug": novel.slug,
        "title": novel.title,
        "summary": novel.summary,
        "coverUrl": get_asset_url(session, novel.cover_asset_id),
        "displayOrder": novel.display_order,
        "owner": user_to_owner_item(get_novel_owner(session, novel)),
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
            chapter_to_admin_item(chapter)
            for chapter in chapters
        ]

    return item


@router.get("/tree")
def get_admin_novels_tree(
    session: Session = Depends(get_session),
):
    novels = session.exec(
        select(Novel).order_by(Novel.display_order)
    ).all()

    return [
        novel_to_admin_item(
            session=session,
            novel=novel,
            include_chapters=True,
        )
        for novel in novels
    ]


@router.get("/owner-candidates")
def get_admin_novel_owner_candidates(
    session: Session = Depends(get_session),
):
    users = list_owner_candidates(session)

    return [user_to_owner_item(user) for user in users]


@router.post("/create")
def create_admin_novel(
    payload: CreateNovelRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_admin_user),
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

    return novel_to_admin_item(
        session=session,
        novel=novel,
        include_chapters=True,
    )


@router.post("/{novel_slug}/chapter/create")
def create_admin_novel_chapter(
    novel_slug: str,
    payload: CreateNovelChapterRequest,
    session: Session = Depends(get_session),
):
    try:
        chapter = create_chapter(
            session=session,
            novel_slug=novel_slug,
            chapter_slug=payload.slug,
            custom_title=payload.customTitle,
            content=payload.content,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    return chapter_to_admin_item(chapter)


@router.delete("/{novel_slug}/{chapter_slug}")
def delete_admin_novel_chapter(
    novel_slug: str,
    chapter_slug: str,
    session: Session = Depends(get_session),
):
    try:
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
def delete_admin_novel(
    novel_slug: str,
    session: Session = Depends(get_session),
):
    try:
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


@router.patch("/{novel_slug}/rename")
def rename_admin_novel(
    novel_slug: str,
    payload: RenameTitleRequest,
    session: Session = Depends(get_session),
):
    try:
        novel = rename_novel(
            session=session,
            novel_slug=novel_slug,
            title=payload.title,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    return novel_to_admin_item(
        session=session,
        novel=novel,
        include_chapters=False,
    )


@router.patch("/{novel_slug}/{chapter_slug}/rename")
def rename_admin_novel_chapter(
    novel_slug: str,
    chapter_slug: str,
    payload: RenameChapterRequest,
    session: Session = Depends(get_session),
):
    try:
        chapter = rename_chapter(
            session=session,
            novel_slug=novel_slug,
            chapter_slug=chapter_slug,
            custom_title=payload.customTitle,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    return chapter_to_admin_item(chapter)


@router.patch("/{novel_slug}/{chapter_slug}/content")
def update_admin_novel_chapter_content(
    novel_slug: str,
    chapter_slug: str,
    payload: ChapterContentRequest,
    session: Session = Depends(get_session),
):
    try:
        chapter = reset_chapter_content(
            session=session,
            novel_slug=novel_slug,
            chapter_slug=chapter_slug,
            content=payload.content,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    return {
        "id": chapter.id,
        "slug": chapter.slug,
        "title": chapter.title,
        "content": chapter.content,
        "displayOrder": chapter.display_order,
        "createdAt": chapter.created_at,
        "updatedAt": chapter.updated_at,
    }


@router.patch("/{novel_slug}/{chapter_slug}/move")
def move_admin_novel_chapter(
    novel_slug: str,
    chapter_slug: str,
    payload: MoveChapterRequest,
    session: Session = Depends(get_session),
):
    try:
        result = shift_chapter(
            session=session,
            novel_slug=novel_slug,
            chapter_slug=chapter_slug,
            direction=payload.direction,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    return result


@router.patch("/{novel_slug}/owner")
def set_admin_novel_owner(
    novel_slug: str,
    payload: SetNovelOwnerRequest,
    session: Session = Depends(get_session),
):
    try:
        owner = set_novel_owner(
            session=session,
            novel_slug=novel_slug,
            username=payload.username,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    return {
        "novelSlug": novel_slug,
        "owner": user_to_owner_item(owner),
    }