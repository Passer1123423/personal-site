import time
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlmodel import Session, select


from app.database import get_session
from app.models import SiteSetting, User
from app.core.security import (
    verify_password,
    create_access_token,
    hash_password,
)
from app.dependencies.auth import require_current_user
from app.services.user_profile import user_to_public_dict

router = APIRouter(prefix="/api/auth", tags=["auth"])

class LoginRequest(BaseModel):
    username: str
    password: str

class RegisterRequest(BaseModel):
    username: str
    displayName: str
    password: str
    bio: str = ""
    humanCheck: str = ""

REGISTER_WINDOW_SECONDS = 60
REGISTER_MAX_ATTEMPTS = 100
register_attempts: dict[str, list[float]] = {}


def check_register_rate_limit(client_key: str) -> None:
    now = time.time()
    attempts = [
        attempt_time
        for attempt_time in register_attempts.get(client_key, [])
        if now - attempt_time < REGISTER_WINDOW_SECONDS
    ]

    if len(attempts) >= REGISTER_MAX_ATTEMPTS:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="注册太频繁，请稍后再试",
        )

    attempts.append(now)
    register_attempts[client_key] = attempts


def is_registration_enabled(session: Session) -> bool:
    setting = session.get(SiteSetting, "registration_enabled")

    if setting is None:
        return True

    return setting.value == "true"

def user_to_public(session: Session, user: User) -> dict:
    return user_to_public_dict(session, user)

@router.post("/register")
def register(
    payload: RegisterRequest,
    request: Request,
    session: Session = Depends(get_session),
):
    username = payload.username.strip()
    display_name = payload.displayName.strip()
    password = payload.password

    client_host = request.client.host if request.client else "unknown"
    check_register_rate_limit(client_host)

    if not is_registration_enabled(session):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="当前未开放注册",
        )

    if payload.humanCheck.strip() != "是":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="请在人类验证中输入“是”",
        )

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
        "user": user_to_public(session, user),
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
        "user": user_to_public(session, user),
    }

@router.get("/me")
def get_me(
    current_user: User = Depends(require_current_user),
    session: Session = Depends(get_session),
):
    return user_to_public(session, current_user)