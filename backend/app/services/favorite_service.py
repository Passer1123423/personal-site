from sqlmodel import Session, select

from app.models import (
    ComicPart,
    ComicPartFavorite,
    ComicSeries,
    Novel,
    NovelFavorite,
    User,
)


def get_novel_by_slug(session: Session, novel_slug: str) -> Novel:
    novel = session.exec(
        select(Novel).where(Novel.slug == novel_slug)
    ).first()

    if not novel:
        raise ValueError("小说不存在")

    return novel


def get_comic_part_by_slug(
    session: Session,
    *,
    series_slug: str,
    part_slug: str,
) -> tuple[ComicSeries, ComicPart]:
    series = session.exec(
        select(ComicSeries).where(ComicSeries.slug == series_slug)
    ).first()

    if not series:
        raise ValueError("漫画系列不存在")

    part = session.exec(
        select(ComicPart)
        .where(ComicPart.series_id == series.id)
        .where(ComicPart.slug == part_slug)
    ).first()

    if not part:
        raise ValueError("漫画分部不存在")

    return series, part


def is_novel_favorited(
    session: Session,
    *,
    novel_id: str,
    user_id: str,
) -> bool:
    favorite = session.exec(
        select(NovelFavorite)
        .where(NovelFavorite.novel_id == novel_id)
        .where(NovelFavorite.user_id == user_id)
    ).first()

    return favorite is not None


def is_comic_part_favorited(
    session: Session,
    *,
    part_id: str,
    user_id: str,
) -> bool:
    favorite = session.exec(
        select(ComicPartFavorite)
        .where(ComicPartFavorite.part_id == part_id)
        .where(ComicPartFavorite.user_id == user_id)
    ).first()

    return favorite is not None


def favorite_novel(
    session: Session,
    *,
    novel_slug: str,
    user: User,
) -> dict:
    novel = get_novel_by_slug(session, novel_slug)

    favorite = session.exec(
        select(NovelFavorite)
        .where(NovelFavorite.novel_id == novel.id)
        .where(NovelFavorite.user_id == user.id)
    ).first()

    if not favorite:
        favorite = NovelFavorite(
            novel_id=novel.id,
            user_id=user.id,
        )
        session.add(favorite)
        session.commit()
        session.refresh(favorite)

    return {
        "targetType": "novel",
        "targetId": novel.id,
        "slug": novel.slug,
        "title": novel.title,
        "isFavorited": True,
        "favoriteId": favorite.id,
    }


def unfavorite_novel(
    session: Session,
    *,
    novel_slug: str,
    user: User,
) -> dict:
    novel = get_novel_by_slug(session, novel_slug)

    favorite = session.exec(
        select(NovelFavorite)
        .where(NovelFavorite.novel_id == novel.id)
        .where(NovelFavorite.user_id == user.id)
    ).first()

    if favorite:
        session.delete(favorite)
        session.commit()

    return {
        "targetType": "novel",
        "targetId": novel.id,
        "slug": novel.slug,
        "title": novel.title,
        "isFavorited": False,
        "favoriteId": None,
    }


def get_novel_favorite_state(
    session: Session,
    *,
    novel_slug: str,
    user: User,
) -> dict:
    novel = get_novel_by_slug(session, novel_slug)

    return {
        "targetType": "novel",
        "targetId": novel.id,
        "slug": novel.slug,
        "title": novel.title,
        "isFavorited": is_novel_favorited(
            session,
            novel_id=novel.id,
            user_id=user.id,
        ),
    }


def favorite_comic_part(
    session: Session,
    *,
    series_slug: str,
    part_slug: str,
    user: User,
) -> dict:
    series, part = get_comic_part_by_slug(
        session,
        series_slug=series_slug,
        part_slug=part_slug,
    )

    favorite = session.exec(
        select(ComicPartFavorite)
        .where(ComicPartFavorite.part_id == part.id)
        .where(ComicPartFavorite.user_id == user.id)
    ).first()

    if not favorite:
        favorite = ComicPartFavorite(
            part_id=part.id,
            user_id=user.id,
        )
        session.add(favorite)
        session.commit()
        session.refresh(favorite)

    return {
        "targetType": "comic_part",
        "targetId": part.id,
        "seriesSlug": series.slug,
        "partSlug": part.slug,
        "title": part.title,
        "isFavorited": True,
        "favoriteId": favorite.id,
    }


def unfavorite_comic_part(
    session: Session,
    *,
    series_slug: str,
    part_slug: str,
    user: User,
) -> dict:
    series, part = get_comic_part_by_slug(
        session,
        series_slug=series_slug,
        part_slug=part_slug,
    )

    favorite = session.exec(
        select(ComicPartFavorite)
        .where(ComicPartFavorite.part_id == part.id)
        .where(ComicPartFavorite.user_id == user.id)
    ).first()

    if favorite:
        session.delete(favorite)
        session.commit()

    return {
        "targetType": "comic_part",
        "targetId": part.id,
        "seriesSlug": series.slug,
        "partSlug": part.slug,
        "title": part.title,
        "isFavorited": False,
        "favoriteId": None,
    }


def get_comic_part_favorite_state(
    session: Session,
    *,
    series_slug: str,
    part_slug: str,
    user: User,
) -> dict:
    series, part = get_comic_part_by_slug(
        session,
        series_slug=series_slug,
        part_slug=part_slug,
    )

    return {
        "targetType": "comic_part",
        "targetId": part.id,
        "seriesSlug": series.slug,
        "partSlug": part.slug,
        "title": part.title,
        "isFavorited": is_comic_part_favorited(
            session,
            part_id=part.id,
            user_id=user.id,
        ),
    }
