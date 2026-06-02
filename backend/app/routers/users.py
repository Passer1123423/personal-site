from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from app.database import get_session
from app.models import User
from app.services.user_profile import get_avatar_url


router = APIRouter(prefix="/api/users", tags=["users"])


def user_to_public_profile(session: Session, user: User) -> dict:
    return {
        "id": user.id,
        "username": user.username,
        "displayName": user.display_name,
        "avatarUrl": get_avatar_url(session, user),
        "bio": user.bio,
        "role": user.role,
        "series": [],
    }


@router.get("/{username}")
def get_user_profile(
    username: str,
    session: Session = Depends(get_session),
):
    user = session.exec(
        select(User).where(User.username == username)
    ).first()

    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在",
        )

    return user_to_public_profile(session, user)