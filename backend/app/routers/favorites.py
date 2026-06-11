from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session

from app.database import get_session
from app.dependencies.auth import require_current_user
from app.models import User
from app.services.favorite_service import (
    favorite_comic_part,
    favorite_novel,
    get_comic_part_favorite_state,
    get_novel_favorite_state,
    unfavorite_comic_part,
    unfavorite_novel,
)


router = APIRouter(
    prefix="/api/favorites",
    tags=["favorites"],
)


@router.get("/novels/{novel_slug}")
def read_novel_favorite_state(
    novel_slug: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_current_user),
):
    try:
        return get_novel_favorite_state(
            session,
            novel_slug=novel_slug,
            user=current_user,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        )


@router.post("/novels/{novel_slug}")
def create_novel_favorite(
    novel_slug: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_current_user),
):
    try:
        return favorite_novel(
            session,
            novel_slug=novel_slug,
            user=current_user,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        )


@router.delete("/novels/{novel_slug}")
def delete_novel_favorite(
    novel_slug: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_current_user),
):
    try:
        return unfavorite_novel(
            session,
            novel_slug=novel_slug,
            user=current_user,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        )


@router.get("/comics/{series_slug}/{part_slug}")
def read_comic_part_favorite_state(
    series_slug: str,
    part_slug: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_current_user),
):
    try:
        return get_comic_part_favorite_state(
            session,
            series_slug=series_slug,
            part_slug=part_slug,
            user=current_user,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        )


@router.post("/comics/{series_slug}/{part_slug}")
def create_comic_part_favorite(
    series_slug: str,
    part_slug: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_current_user),
):
    try:
        return favorite_comic_part(
            session,
            series_slug=series_slug,
            part_slug=part_slug,
            user=current_user,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        )


@router.delete("/comics/{series_slug}/{part_slug}")
def delete_comic_part_favorite(
    series_slug: str,
    part_slug: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_current_user),
):
    try:
        return unfavorite_comic_part(
            session,
            series_slug=series_slug,
            part_slug=part_slug,
            user=current_user,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        )
