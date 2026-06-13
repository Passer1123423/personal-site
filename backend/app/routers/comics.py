"""
comics.py

这个文件专门放漫画相关 API。

当前已有：
1. GET /api/comics
   查询漫画系列列表

现在新增：
2. GET /api/comics/{series_slug}
   查询某个漫画系列详情，包括分部和章节
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from ..database import get_session
from ..models import (
    Asset,
    ComicChapter,
    ComicPage,
    ComicPart,
    ComicPartUserLink,
    ComicSeries,
    User,
)


router = APIRouter(
    prefix="/api/comics",
    tags=["comics"],
)


def get_asset_url(session: Session, asset_id: str | None) -> str | None:
    """
    根据 Asset ID 查询资源 URL。

    为什么单独写成函数：
    1. ComicSeries 的封面需要查 Asset
    2. 后面 ComicPage 的图片也需要查 Asset
    3. 抽出来后可以避免重复代码

    参数：
    session:
        数据库会话。

    asset_id:
        Asset 表中的 id。
        可以为空。

    返回：
    如果找到资源，返回 asset.url。
    如果 asset_id 为空或资源不存在，返回 None。
    """

    if not asset_id:
        return None

    asset = session.get(Asset, asset_id)

    if not asset:
        return None

    return asset.url


def get_comic_part_owner(session: Session, part: ComicPart) -> User | None:
    link = session.exec(
        select(ComicPartUserLink)
        .where(ComicPartUserLink.part_id == part.id)
        .where(ComicPartUserLink.role == "owner")
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
def list_comics(session: Session = Depends(get_session)):
    """
    查询漫画系列列表。

    当前逻辑：
    1. 只查询 visibility = public 的漫画系列
    2. 按 display_order 从小到大排序
    3. 如果系列有关联封面，就返回 coverUrl
    """

    statement = (
        select(ComicSeries)
        .where(ComicSeries.visibility == "public")
        .order_by(ComicSeries.display_order)
    )

    series_list = session.exec(statement).all()

    result = []

    for series in series_list:
        result.append(
            {
                "id": series.id,
                "slug": series.slug,
                "title": series.title,
                "summary": series.summary,
                "status": series.status,
                "visibility": series.visibility,
                "displayOrder": series.display_order,
                "coverUrl": get_asset_url(session, series.cover_asset_id),
                "createdAt": series.created_at,
                "updatedAt": series.updated_at,
            }
        )

    return result


@router.get("/{series_slug}")
def get_comic_detail(
    series_slug: str,
    session: Session = Depends(get_session),
):
    """
    查询漫画系列详情。

    访问示例：

        GET /api/comics/demo-comic

    当前返回结构：

        ComicSeries
        └── ComicPart
            └── ComicChapter

    注意：
    这个接口暂时不返回漫画页图片。
    漫画页图片后面交给阅读接口：

        GET /api/comics/{series_slug}/{chapter_slug}

    这样接口职责更清楚。
    """

    # 1. 根据 series_slug 查询漫画系列。
    #
    # 只允许查询 public 系列。
    # private 系列后面留给后台管理接口。
    series = session.exec(
        select(ComicSeries).where(
            ComicSeries.slug == series_slug,
            ComicSeries.visibility == "public",
        )
    ).first()

    if not series:
        raise HTTPException(status_code=404, detail="Comic series not found")

    # 2. 查询该系列下面的公开分部。
    parts = session.exec(
        select(ComicPart)
        .where(
            ComicPart.series_id == series.id,
            ComicPart.visibility == "public",
        )
        .order_by(ComicPart.display_order)
    ).all()

    part_results = []

    for part in parts:
        # 3. 查询每个分部下面的公开章节。
        chapters = session.exec(
            select(ComicChapter)
            .where(
                ComicChapter.part_id == part.id,
                ComicChapter.visibility == "public",
            )
            .order_by(ComicChapter.display_order)
        ).all()

        chapter_results = []

        for chapter in chapters:
            chapter_results.append(
                {
                    "id": chapter.id,
                    "slug": chapter.slug,
                    "title": chapter.title,
                    "summary": chapter.summary,
                    "visibility": chapter.visibility,
                    "displayOrder": chapter.display_order,
                    "publishedAt": chapter.published_at,
                    "createdAt": chapter.created_at,
                    "updatedAt": chapter.updated_at,
                }
            )

        part_results.append(
            {
                "id": part.id,
                "slug": part.slug,
                "title": part.title,
                "summary": part.summary,
                "status": part.status,
                "visibility": part.visibility,
                "displayOrder": part.display_order,
                "coverUrl": get_asset_url(session, part.cover_asset_id),
                "owner": owner_to_public_item(get_comic_part_owner(session, part)),
                "createdAt": part.created_at,
                "updatedAt": part.updated_at,
                "chapters": chapter_results,
            }
        )

    # 4. 返回整理后的系列详情。
    return {
        "id": series.id,
        "slug": series.slug,
        "title": series.title,
        "summary": series.summary,
        "status": series.status,
        "visibility": series.visibility,
        "displayOrder": series.display_order,
        "coverUrl": get_asset_url(session, series.cover_asset_id),
        "createdAt": series.created_at,
        "updatedAt": series.updated_at,
        "parts": part_results,
    }


@router.get("/{series_slug}/{part_slug}")
def get_comic_part_detail(
    series_slug: str,
    part_slug: str,
    session: Session = Depends(get_session),
):
    series = session.exec(
        select(ComicSeries).where(
            ComicSeries.slug == series_slug,
            ComicSeries.visibility == "public",
        )
    ).first()

    if not series:
        raise HTTPException(status_code=404, detail="Comic series not found")

    part = session.exec(
        select(ComicPart).where(
            ComicPart.series_id == series.id,
            ComicPart.slug == part_slug,
            ComicPart.visibility == "public",
        )
    ).first()

    if not part:
        raise HTTPException(status_code=404, detail="Comic part not found")

    chapters = session.exec(
        select(ComicChapter)
        .where(
            ComicChapter.part_id == part.id,
            ComicChapter.visibility == "public",
        )
        .order_by(ComicChapter.display_order)
    ).all()

    chapter_results = []

    for chapter in chapters:
        chapter_results.append(
            {
                "id": chapter.id,
                "slug": chapter.slug,
                "title": chapter.title,
                "summary": chapter.summary,
                "visibility": chapter.visibility,
                "displayOrder": chapter.display_order,
                "publishedAt": chapter.published_at,
                "createdAt": chapter.created_at,
                "updatedAt": chapter.updated_at,
            }
        )

    return {
        "series": {
            "id": series.id,
            "slug": series.slug,
            "title": series.title,
        },
        "part": {
            "id": part.id,
            "slug": part.slug,
            "title": part.title,
            "summary": part.summary,
            "status": part.status,
            "visibility": part.visibility,
            "displayOrder": part.display_order,
            "coverUrl": get_asset_url(session, part.cover_asset_id),
            "owner": owner_to_public_item(get_comic_part_owner(session, part)),
            "createdAt": part.created_at,
            "updatedAt": part.updated_at,
        },
        "chapters": chapter_results,
    }


@router.get("/{series_slug}/{part_slug}/{chapter_slug}")
def get_comic_chapter_reader(
    series_slug: str,
    part_slug: str,
    chapter_slug: str,
    session: Session = Depends(get_session),
):
    """
    查询漫画阅读页数据。

    访问示例：

        GET /api/comics/demo-comic/part-1/chapter-1

    查询层级：

        ComicSeries
        └── ComicPart
            └── ComicChapter
                └── ComicPage
                    └── Asset

    返回给前端时，不直接暴露 asset_id，
    而是返回 imageUrl，方便前端直接展示图片。
    """

    # 1. 先根据 series_slug 找到公开漫画系列。
    series = session.exec(
        select(ComicSeries).where(
            ComicSeries.slug == series_slug,
            ComicSeries.visibility == "public",
        )
    ).first()

    if not series:
        raise HTTPException(status_code=404, detail="Comic series not found")

    # 2. 在这个系列下面，根据 part_slug 找到公开分部。
    part = session.exec(
        select(ComicPart).where(
            ComicPart.series_id == series.id,
            ComicPart.slug == part_slug,
            ComicPart.visibility == "public",
        )
    ).first()

    if not part:
        raise HTTPException(status_code=404, detail="Comic part not found")

    # 3. 在这个分部下面，根据 chapter_slug 找到公开章节。
    chapter = session.exec(
        select(ComicChapter).where(
            ComicChapter.part_id == part.id,
            ComicChapter.slug == chapter_slug,
            ComicChapter.visibility == "public",
        )
    ).first()

    if not chapter:
        raise HTTPException(status_code=404, detail="Comic chapter not found")

    # 4. 查询这个章节下面的漫画页。
    pages = session.exec(
        select(ComicPage)
        .where(ComicPage.chapter_id == chapter.id)
        .order_by(ComicPage.display_order)
    ).all()

    page_results = []

    for page in pages:
        page_results.append(
            {
                "id": page.id,
                "displayOrder": page.display_order,
                "imageUrl": get_asset_url(session, page.asset_id),
                "width": page.width,
                "height": page.height,
                "createdAt": page.created_at,
                "updatedAt": page.updated_at,
            }
        )

    return {
        "series": {
            "id": series.id,
            "slug": series.slug,
            "title": series.title,
        },
        "part": {
            "id": part.id,
            "slug": part.slug,
            "title": part.title,
        },
        "chapter": {
            "id": chapter.id,
            "slug": chapter.slug,
            "title": chapter.title,
            "summary": chapter.summary,
            "publishedAt": chapter.published_at,
            "createdAt": chapter.created_at,
            "updatedAt": chapter.updated_at,
        },
        "pageCount": len(page_results),
        "pages": page_results,
    }
