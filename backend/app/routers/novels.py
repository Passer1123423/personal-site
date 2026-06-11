"""
novels.py

这个文件专门放小说前台公开 API。

当前已有：
1. GET /api/novels
   查询小说列表

2. GET /api/novels/{novel_slug}
   查询某部小说详情，包括章节列表

3. GET /api/novels/{novel_slug}/{chapter_slug}
   查询某一章小说正文
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.database import get_session
from app.models import Asset, Novel, NovelChapter, NovelUserLink, User


router = APIRouter(
    prefix="/api/novels",
    tags=["novels"],
)


def get_asset_url(session: Session, asset_id: str | None) -> str | None:
    if not asset_id:
        return None

    asset = session.get(Asset, asset_id)

    if not asset:
        return None

    return asset.url


def novel_to_list_item(session: Session, novel: Novel) -> dict:
    return {
        "id": novel.id,
        "slug": novel.slug,
        "title": novel.title,
        "summary": novel.summary,
        "coverUrl": get_asset_url(session, novel.cover_asset_id),
        "displayOrder": novel.display_order,
        "createdAt": novel.created_at,
        "updatedAt": novel.updated_at,
    }


def chapter_to_list_item(chapter: NovelChapter) -> dict:
    return {
        "id": chapter.id,
        "slug": chapter.slug,
        "title": chapter.title,
        "displayOrder": chapter.display_order,
        "createdAt": chapter.created_at,
        "updatedAt": chapter.updated_at,
    }


def get_novel_owner(session: Session, novel: Novel) -> User | None:
    link = session.exec(
        select(NovelUserLink)
        .where(NovelUserLink.novel_id == novel.id)
        .where(NovelUserLink.role == "owner")
    ).first()

    if not link:
        return None

    return session.get(User, link.user_id)


def owner_to_public_item(user: User | None) -> dict | None:
    if not user:
        return None

    return {
        "id": user.id,
        "username": user.username,
        "displayName": user.display_name,
    }


@router.get("")
def list_novels(session: Session = Depends(get_session)):
    novels = session.exec(
        select(Novel).order_by(Novel.display_order)
    ).all()

    return [novel_to_list_item(session, novel) for novel in novels]


@router.get("/{novel_slug}")
def get_novel_detail(
    novel_slug: str,
    session: Session = Depends(get_session),
):
    novel = session.exec(
        select(Novel).where(Novel.slug == novel_slug)
    ).first()

    if not novel:
        raise HTTPException(status_code=404, detail="Novel not found")

    chapters = session.exec(
        select(NovelChapter)
        .where(NovelChapter.novel_id == novel.id)
        .order_by(NovelChapter.display_order)
    ).all()

    return {
        **novel_to_list_item(session, novel),
        "owner": owner_to_public_item(get_novel_owner(session, novel)),
        "chapters": [chapter_to_list_item(chapter) for chapter in chapters],
    }


@router.get("/{novel_slug}/{chapter_slug}")
def get_novel_chapter_reader(
    novel_slug: str,
    chapter_slug: str,
    session: Session = Depends(get_session),
):
    novel = session.exec(
        select(Novel).where(Novel.slug == novel_slug)
    ).first()

    if not novel:
        raise HTTPException(status_code=404, detail="Novel not found")

    chapter = session.exec(
        select(NovelChapter)
        .where(NovelChapter.novel_id == novel.id)
        .where(NovelChapter.slug == chapter_slug)
    ).first()

    if not chapter:
        raise HTTPException(status_code=404, detail="Novel chapter not found")

    return {
        "novel": {
            "id": novel.id,
            "slug": novel.slug,
            "title": novel.title,
        },
        "chapter": {
            "id": chapter.id,
            "slug": chapter.slug,
            "title": chapter.title,
            "content": chapter.content,
            "displayOrder": chapter.display_order,
            "createdAt": chapter.created_at,
            "updatedAt": chapter.updated_at,
        },
    }
