from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlmodel import Session, select

from app.database import get_session
from app.dependencies.auth import require_admin_user
from app.models import Asset, Novel, NovelChapter, User

from app.services.novel_admin import (
    create_novel,
    create_chapter,
    delete_chapter,
    delete_novel,
    get_chapter,
    get_novel,
    get_novel_owner,
    list_owner_candidates,
    rename_chapter,
    rename_novel,
    reset_chapter_content,
    set_novel_owner,
    shift_chapter,
)
from app.services.activity_logs import log_activity


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

def get_chapter_count_for_novel(session: Session, novel_id: str) -> int:
    chapters = session.exec(
        select(NovelChapter).where(NovelChapter.novel_id == novel_id)
    ).all()

    return len(chapters)


def get_novel_snapshot(
    session: Session,
    novel: Novel | None,
) -> dict | None:
    if not novel:
        return None

    owner = get_novel_owner(session, novel)

    return {
        "id": novel.id,
        "slug": novel.slug,
        "title": novel.title,
        "summary_length": len(novel.summary or ""),
        "cover_asset_id": novel.cover_asset_id,
        "display_order": novel.display_order,
        "owner": user_to_owner_item(owner),
        "chapter_count": get_chapter_count_for_novel(session, novel.id),
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


def get_content_length(value: str | None) -> int:
    return len(value or "")

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
    request: Request,
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

    log_activity(
        session,
        actor=current_user,
        action="novel.create",
        category="novel",
        target_type="novel",
        target_id=novel.id,
        target_label=novel.title,
        status="success",
        message="管理员创建小说",
        metadata={
            "source": "admin",
            "novel": get_novel_snapshot(session, novel),
            "owner": user_to_owner_item(current_user),
        },
        request=request,
    )

    return novel_to_admin_item(
        session=session,
        novel=novel,
        include_chapters=True,
    )

@router.post("/{novel_slug}/chapter/create")
def create_admin_novel_chapter(
    request: Request,
    novel_slug: str,
    payload: CreateNovelChapterRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_admin_user),
):
    try:
        novel = get_novel(
            session=session,
            novel_slug=novel_slug,
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
        message="管理员创建小说章节",
        metadata={
            "source": "admin",
            "novel": get_novel_snapshot(session, novel),
            "chapter": get_chapter_snapshot(chapter),
            "content_length": get_content_length(payload.content),
        },
        request=request,
    )

    return chapter_to_admin_item(chapter)

@router.delete("/{novel_slug}/{chapter_slug}")
def delete_admin_novel_chapter(
    request: Request,
    novel_slug: str,
    chapter_slug: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_admin_user),
):
    try:
        novel = get_novel(
            session=session,
            novel_slug=novel_slug,
        )
        chapter = get_chapter(
            session=session,
            novel=novel,
            chapter_slug=chapter_slug,
        )

        novel_before = get_novel_snapshot(session, novel)
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
        message="管理员删除小说章节",
        metadata={
            "source": "admin",
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
def delete_admin_novel(
    request: Request,
    novel_slug: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_admin_user),
):
    try:
        novel = get_novel(
            session=session,
            novel_slug=novel_slug,
        )

        novel_before = get_novel_snapshot(session, novel)

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
        message="管理员删除小说",
        metadata={
            "source": "admin",
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

@router.patch("/{novel_slug}/rename")
def rename_admin_novel(
    request: Request,
    novel_slug: str,
    payload: RenameTitleRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_admin_user),
):
    try:
        novel_before_obj = get_novel(
            session=session,
            novel_slug=novel_slug,
        )
        before_snapshot = get_novel_snapshot(session, novel_before_obj)

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
        message="管理员重命名小说",
        metadata={
            "source": "admin",
            "novel_slug": novel_slug,
            "before": before_snapshot,
            "after": get_novel_snapshot(session, novel),
        },
        request=request,
    )

    return novel_to_admin_item(
        session=session,
        novel=novel,
        include_chapters=False,
    )

@router.patch("/{novel_slug}/{chapter_slug}/rename")
def rename_admin_novel_chapter(
    request: Request,
    novel_slug: str,
    chapter_slug: str,
    payload: RenameChapterRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_admin_user),
):
    try:
        chapter_before_obj = get_chapter(
            session=session,
            novel_slug=novel_slug,
            chapter_slug=chapter_slug,
        )
        before_snapshot = get_chapter_snapshot(chapter_before_obj)

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
        message="管理员重命名小说章节",
        metadata={
            "source": "admin",
            "novel_slug": novel_slug,
            "chapter_slug": chapter_slug,
            "custom_title": payload.customTitle,
            "before": before_snapshot,
            "after": get_chapter_snapshot(chapter),
        },
        request=request,
    )

    return chapter_to_admin_item(chapter)

@router.patch("/{novel_slug}/{chapter_slug}/content")
def update_admin_novel_chapter_content(
    request: Request,
    novel_slug: str,
    chapter_slug: str,
    payload: ChapterContentRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_admin_user),
):
    try:
        chapter_before_obj = get_chapter(
            session=session,
            novel_slug=novel_slug,
            chapter_slug=chapter_slug,
        )
        before_snapshot = get_chapter_snapshot(chapter_before_obj)

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
        message="管理员更新小说章节正文",
        metadata={
            "source": "admin",
            "novel_slug": novel_slug,
            "chapter_slug": chapter_slug,
            "old_content_length": before_snapshot["content_length"] if before_snapshot else None,
            "new_content_length": after_snapshot["content_length"] if after_snapshot else None,
        },
        request=request,
    )

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
    request: Request,
    novel_slug: str,
    chapter_slug: str,
    payload: MoveChapterRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_admin_user),
):
    try:
        chapter_before_obj = get_chapter(
            session=session,
            novel_slug=novel_slug,
            chapter_slug=chapter_slug,
        )
        before_snapshot = get_chapter_snapshot(chapter_before_obj)

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
            message="管理员移动小说章节顺序",
            metadata={
                "source": "admin",
                "novel_slug": novel_slug,
                "chapter_slug": chapter_slug,
                "direction": payload.direction,
                "before": before_snapshot,
                "result": result,
            },
            request=request,
        )

    return result

@router.patch("/{novel_slug}/owner")
def set_admin_novel_owner(
    request: Request,
    novel_slug: str,
    payload: SetNovelOwnerRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_admin_user),
):
    try:
        novel_before_obj = get_novel(
            session=session,
            novel_slug=novel_slug,
        )
        before_snapshot = get_novel_snapshot(session, novel_before_obj)

        owner = set_novel_owner(
            session=session,
            novel_slug=novel_slug,
            username=payload.username,
        )

        novel_after = get_novel(
            session=session,
            novel_slug=novel_slug,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    log_activity(
        session,
        actor=current_user,
        action="novel.owner_update",
        category="novel",
        target_type="novel",
        target_id=novel_after.id,
        target_label=novel_after.title,
        status="success",
        message="管理员更新小说 owner",
        metadata={
            "source": "admin",
            "novel_slug": novel_slug,
            "new_owner_username": payload.username,
            "before": before_snapshot,
            "after": get_novel_snapshot(session, novel_after),
        },
        request=request,
    )

    return {
        "novelSlug": novel_slug,
        "owner": user_to_owner_item(owner),
    }