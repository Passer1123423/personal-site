from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from pydantic import BaseModel
from sqlmodel import Session

from app.database import get_session
from app.dependencies.auth import require_current_user
from app.models import Asset, User
from app.services.activity_logs import log_activity
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


def get_changed_fields(changes: dict[str, tuple[object, object]]) -> list[str]:
    return [
        field_name
        for field_name, (old_value, new_value) in changes.items()
        if old_value != new_value
    ]


@router.patch("/profile")
def update_my_profile(
    request: Request,
    payload: UpdateMyProfileRequest,
    current_user: User = Depends(require_current_user),
    session: Session = Depends(get_session),
):
    old_display_name = current_user.display_name
    old_bio_length = len(current_user.bio or "")

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

    changes = {
        "display_name": (old_display_name, user.display_name),
        "bio_length": (old_bio_length, len(user.bio or "")),
    }
    changed_fields = get_changed_fields(changes)

    log_activity(
        session,
        actor=user,
        action="user.profile.update",
        category="user",
        target_type="user",
        target_id=user.id,
        target_label=user.username,
        status="success",
        message="用户更新个人资料",
        metadata={
            "username": user.username,
            "changed_fields": changed_fields,
            "old_display_name": old_display_name,
            "new_display_name": user.display_name,
            "old_bio_length": old_bio_length,
            "new_bio_length": len(user.bio or ""),
        },
        request=request,
    )

    return user_to_public_dict(session, user)


@router.post("/avatar")
async def upload_my_avatar(
    request: Request,
    file: UploadFile = File(...),
    current_user: User = Depends(require_current_user),
    session: Session = Depends(get_session),
):
    old_avatar_asset_id = current_user.avatar_asset_id
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

    new_avatar_asset_id = user.avatar_asset_id
    new_asset = session.get(Asset, new_avatar_asset_id) if new_avatar_asset_id else None

    log_activity(
        session,
        actor=user,
        action="user.avatar.upload",
        category="user",
        target_type="asset",
        target_id=new_avatar_asset_id,
        target_label=new_asset.original_name if new_asset else (file.filename or "avatar"),
        status="success",
        message="用户上传头像",
        metadata={
            "user_id": user.id,
            "username": user.username,
            "old_avatar_asset_id": old_avatar_asset_id,
            "new_avatar_asset_id": new_avatar_asset_id,
            "filename": new_asset.filename if new_asset else None,
            "original_name": new_asset.original_name if new_asset else (file.filename or "avatar"),
            "content_type": new_asset.mime_type if new_asset else file.content_type,
            "size": new_asset.size if new_asset else len(content),
            "url": new_asset.url if new_asset else None,
        },
        request=request,
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
    request: Request,
    payload: SwitchAvatarRequest,
    current_user: User = Depends(require_current_user),
    session: Session = Depends(get_session),
):
    old_avatar_asset_id = current_user.avatar_asset_id

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

    new_avatar_asset_id = user.avatar_asset_id
    new_asset = session.get(Asset, new_avatar_asset_id) if new_avatar_asset_id else None

    log_activity(
        session,
        actor=user,
        action="user.avatar.switch",
        category="user",
        target_type="user",
        target_id=user.id,
        target_label=user.username,
        status="success",
        message="用户切换头像" if new_avatar_asset_id else "用户清空头像",
        metadata={
            "user_id": user.id,
            "username": user.username,
            "old_avatar_asset_id": old_avatar_asset_id,
            "new_avatar_asset_id": new_avatar_asset_id,
            "cleared": new_avatar_asset_id is None,
            "new_avatar_original_name": new_asset.original_name if new_asset else None,
            "new_avatar_url": new_asset.url if new_asset else None,
        },
        request=request,
    )

    return user_to_public_dict(session, user)


@router.delete("/avatars/{asset_id}")
def delete_my_avatar(
    request: Request,
    asset_id: str,
    current_user: User = Depends(require_current_user),
    session: Session = Depends(get_session),
):
    asset = session.get(Asset, asset_id)

    asset_snapshot = {
        "asset_id": asset.id if asset else asset_id,
        "filename": asset.filename if asset else None,
        "original_name": asset.original_name if asset else None,
        "mime_type": asset.mime_type if asset else None,
        "size": asset.size if asset else None,
        "url": asset.url if asset else None,
        "usage": asset.usage if asset else None,
    }

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

    log_activity(
        session,
        actor=current_user,
        action="user.avatar.delete",
        category="user",
        target_type="asset",
        target_id=asset_id,
        target_label=asset_snapshot["original_name"] or asset_id,
        status="success",
        message="用户删除头像资源",
        metadata={
            "user_id": current_user.id,
            "username": current_user.username,
            **asset_snapshot,
        },
        request=request,
    )

    return {
        "deleted": True,
        "assetId": asset_id,
    }