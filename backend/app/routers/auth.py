from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlmodel import Session, select


from app.database import get_session
from app.models import User
from app.core.security import (
    verify_password,
    create_access_token,
    hash_password,
)
from app.dependencies.auth import require_current_user


router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginRequest(BaseModel):
    username: str
    password: str

class RegisterRequest(BaseModel):
    username: str
    displayName: str
    password: str
    bio: str = ""

def user_to_public(user: User) -> dict:
    return {
        "id": user.id,
        "username": user.username,
        "displayName": user.display_name,
        "role": user.role,
        "isActive": user.is_active,
        "avatarUrl": None,
        "bio": user.bio,
        "createdAt": user.created_at,
    }

@router.post("/register")
def register(
    payload: RegisterRequest,
    session: Session = Depends(get_session),
):
    username = payload.username.strip()
    display_name = payload.displayName.strip()
    password = payload.password

    if not username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="用户名不能为空",
        )

    if not display_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="显示名不能为空",
        )

    if len(password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="密码至少需要 6 位",
        )

    existing_user = session.exec(
        select(User).where(User.username == username)
    ).first()

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="用户名已存在",
        )

    user = User(
        username=username,
        display_name=display_name,
        password_hash=hash_password(password),
        role="reader",
        bio=payload.bio,
    )

    session.add(user)
    session.commit()
    session.refresh(user)

    access_token = create_access_token({"sub": user.username})

    return {
        "accessToken": access_token,
        "tokenType": "bearer",
        "user": user_to_public(user),
    }

@router.post("/login")
def login(
    payload: LoginRequest,
    session: Session = Depends(get_session),
):
    user = session.exec(
        select(User).where(User.username == payload.username)
    ).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户名或密码错误",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="账号不可用",
        )

    if not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户名或密码错误",
        )

    access_token = create_access_token({"sub": user.username})

    return {
        "accessToken": access_token,
        "tokenType": "bearer",
        "user": user_to_public(user),
    }

@router.get("/me")
def get_me(
    current_user: User = Depends(require_current_user),
):
    return user_to_public(current_user)