from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from pydantic import BaseModel
from sqlmodel import Session

from app.database import get_session
from app.dependencies.auth import require_current_user
from app.models import User
from app.services.user_profile import (
    delete_current_user_avatar_asset,
    list_current_user_avatars,
    switch_current_user_avatar,
    update_current_user_profile,
    upload_current_user_avatar,
    user_to_public_dict,
)


router = APIRouter(prefix="/api/users/me", tags=["user-profile"])


class UpdateMyProfileRequest(BaseModel):
    displayName: str | None = None
    bio: str | None = None


class SwitchAvatarRequest(BaseModel):
    assetId: str | None = None


@router.patch("/profile")
def update_my_profile(
    payload: UpdateMyProfileRequest,
    current_user: User = Depends(require_current_user),
    session: Session = Depends(get_session),
):
    try:
        user = update_current_user_profile(
            session=session,
            user=current_user,
            display_name=payload.displayName,
            bio=payload.bio,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )

    return user_to_public_dict(session, user)


@router.post("/avatar")
async def upload_my_avatar(
    file: UploadFile = File(...),
    current_user: User = Depends(require_current_user),
    session: Session = Depends(get_session),
):
    content = await file.read()

    try:
        user = upload_current_user_avatar(
            session=session,
            user=current_user,
            content=content,
            original_name=file.filename or "avatar",
            content_type=file.content_type,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )

    return user_to_public_dict(session, user)


@router.get("/avatars")
def list_my_avatars(
    current_user: User = Depends(require_current_user),
    session: Session = Depends(get_session),
):
    return list_current_user_avatars(
        session=session,
        user=current_user,
    )


@router.patch("/avatar")
def switch_my_avatar(
    payload: SwitchAvatarRequest,
    current_user: User = Depends(require_current_user),
    session: Session = Depends(get_session),
):
    try:
        user = switch_current_user_avatar(
            session=session,
            user=current_user,
            asset_id=payload.assetId,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )

    return user_to_public_dict(session, user)


@router.delete("/avatars/{asset_id}")
def delete_my_avatar(
    asset_id: str,
    current_user: User = Depends(require_current_user),
    session: Session = Depends(get_session),
):
    try:
        delete_current_user_avatar_asset(
            session=session,
            user=current_user,
            asset_id=asset_id,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )

    return {
        "deleted": True,
        "assetId": asset_id,
    }
