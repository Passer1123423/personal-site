from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from app.core.security import hash_password, verify_password
from app.database import get_session
from app.dependencies.auth import require_admin_user
from app.models import SiteSetting, User, now_utc
from app.services.user_profile import get_avatar_url
from app.services.interactions import hard_delete_comments_for_target


router = APIRouter(
    prefix="/api/admin/users",
    tags=["admin-users"],
    dependencies=[Depends(require_admin_user)],
)


VALID_ROLES = {"reader", "author", "admin"}


class CreateUserRequest(BaseModel):
    username: str
    displayName: str
    password: str
    role: str = "reader"
    bio: str = ""


class UpdateUserRequest(BaseModel):
    displayName: str | None = None
    role: str | None = None
    isActive: bool | None = None
    bio: str | None = None


class ResetPasswordRequest(BaseModel):
    password: str

class DeleteUserRequest(BaseModel):
    confirmUsername: str
    adminPassword: str

class RegistrationSettingRequest(BaseModel):
    enabled: bool

def user_to_admin_item(session: Session, user: User) -> dict:
    return {
        "id": user.id,
        "username": user.username,
        "displayName": user.display_name,
        "role": user.role,
        "isActive": user.is_active,
        "avatarUrl": get_avatar_url(session, user),
        "bio": user.bio,
        "createdAt": user.created_at,
        "updatedAt": user.updated_at,
    }


@router.get("")
def list_admin_users(
    session: Session = Depends(get_session),
):
    users = session.exec(
        select(User).order_by(User.created_at)
    ).all()

    return [user_to_admin_item(session, user) for user in users]

@router.get("/settings/registration")
def get_registration_setting(
    session: Session = Depends(get_session),
):
    setting = session.get(SiteSetting, "registration_enabled")

    enabled = True if setting is None else setting.value == "true"

    return {
        "enabled": enabled,
    }


@router.patch("/settings/registration")
def update_registration_setting(
    payload: RegistrationSettingRequest,
    session: Session = Depends(get_session),
):
    setting = session.get(SiteSetting, "registration_enabled")

    if setting is None:
        setting = SiteSetting(
            key="registration_enabled",
            value="true" if payload.enabled else "false",
        )
    else:
        setting.value = "true" if payload.enabled else "false"
        setting.updated_at = now_utc()

    session.add(setting)
    session.commit()

    return {
        "enabled": setting.value == "true",
    }

@router.post("")
def create_admin_user(
    payload: CreateUserRequest,
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

    if payload.role not in VALID_ROLES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="role 不合法",
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
        role=payload.role,
        bio=payload.bio,
    )

    session.add(user)
    session.commit()
    session.refresh(user)

    return user_to_admin_item(session, user)


@router.patch("/{username}")
def update_admin_user(
    username: str,
    payload: UpdateUserRequest,
    session: Session = Depends(get_session),
):
    user = session.exec(
        select(User).where(User.username == username)
    ).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在",
        )

    if payload.displayName is not None:
        display_name = payload.displayName.strip()
        if not display_name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="显示名不能为空",
            )
        user.display_name = display_name

    if payload.role is not None:
        if payload.role not in VALID_ROLES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="role 不合法",
            )
        user.role = payload.role

    if payload.isActive is not None:
        user.is_active = payload.isActive

    if payload.bio is not None:
        user.bio = payload.bio

    session.add(user)
    session.commit()
    session.refresh(user)

    return user_to_admin_item(session, user)


@router.patch("/{username}/password")
def reset_admin_user_password(
    username: str,
    payload: ResetPasswordRequest,
    session: Session = Depends(get_session),
):
    user = session.exec(
        select(User).where(User.username == username)
    ).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在",
        )

    if len(payload.password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="密码至少需要 6 位",
        )

    user.password_hash = hash_password(payload.password)

    session.add(user)
    session.commit()
    session.refresh(user)

    return user_to_admin_item(session, user)


@router.delete("/{username}")
def delete_admin_user(
    username: str,
    payload: DeleteUserRequest,
    current_user: User = Depends(require_admin_user),
    session: Session = Depends(get_session),
):
    if username == current_user.username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="不能删除当前登录用户",
        )

    if payload.confirmUsername != username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="确认用户名不匹配",
        )

    if not verify_password(payload.adminPassword, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="管理员密码错误",
        )

    user = session.exec(
        select(User).where(User.username == username)
    ).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在",
        )

    deleted_user_page_comments = hard_delete_comments_for_target(
        session,
        target_type="user_page",
        target_id=user.id,
        commit=False,
    )

    session.delete(user)
    session.commit()

    return {
        "deleted": True,
        "username": username,
        "deletedUserPageComments": deleted_user_page_comments,
    }