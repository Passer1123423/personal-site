import os
import re
import unicodedata
from pathlib import Path
from uuid import uuid4

from sqlmodel import Session, select

from app.models import Asset, User, now_utc


IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
IMAGE_MIME_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
}

MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024

BACKEND_DIR = Path(__file__).resolve().parents[2]
UPLOADS_DIR = Path(os.getenv("UPLOADS_DIR", BACKEND_DIR / "uploads")).resolve()
USER_UPLOADS_ROOT = UPLOADS_DIR / "user"


def guess_mime_type_by_suffix(filename: str) -> str:
    suffix = Path(filename).suffix.lower()

    if suffix in {".jpg", ".jpeg"}:
        return "image/jpeg"

    if suffix == ".png":
        return "image/png"

    if suffix == ".webp":
        return "image/webp"

    if suffix == ".gif":
        return "image/gif"

    return "application/octet-stream"


def safe_user_dir_name(user: User) -> str:
    """
    把 username 转成安全目录名。

    中文 display_name 不受影响。
    如果 username 本身含中文或特殊字符，目录名会 fallback 到 user-{id前8位}。
    """

    raw = user.username.strip()

    normalized = (
        unicodedata.normalize("NFKD", raw)
        .encode("ascii", "ignore")
        .decode("ascii")
    )

    safe = re.sub(r"[^a-zA-Z0-9_-]+", "-", normalized)
    safe = re.sub(r"-+", "-", safe).strip("-_").lower()

    if not safe:
        safe = f"user-{user.id[:8]}"

    return safe


def get_user_avatar_dir(user: User) -> Path:
    return USER_UPLOADS_ROOT / safe_user_dir_name(user) / "avatars"


def build_avatar_url(user: User, filename: str) -> str:
    return f"/uploads/user/{safe_user_dir_name(user)}/avatars/{filename}"


def get_avatar_url(session: Session, user: User) -> str | None:
    if not user.avatar_asset_id:
        return None

    asset = session.get(Asset, user.avatar_asset_id)

    if not asset:
        return None

    return asset.url


def user_to_public_dict(session: Session, user: User) -> dict:
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


def update_current_user_profile(
    session: Session,
    user: User,
    display_name: str | None,
    bio: str | None,
) -> User:
    if display_name is not None:
        display_name = display_name.strip()

        if not display_name:
            raise ValueError("显示名不能为空")

        if len(display_name) > 40:
            raise ValueError("显示名不能超过 40 个字符")

        user.display_name = display_name

    if bio is not None:
        bio = bio.strip()

        if len(bio) > 300:
            raise ValueError("简介不能超过 300 个字符")

        user.bio = bio

    user.updated_at = now_utc()

    session.add(user)
    session.commit()
    session.refresh(user)

    return user


def create_avatar_asset_from_bytes(
    session: Session,
    user: User,
    content: bytes,
    original_name: str,
    content_type: str | None,
) -> Asset:
    original_name = original_name.strip() or "avatar"

    if ":Zone.Identifier" in original_name:
        raise ValueError("非法文件名")

    if not content:
        raise ValueError("头像文件不能为空")

    if len(content) > MAX_AVATAR_SIZE_BYTES:
        raise ValueError("头像文件不能超过 5MB")

    suffix = Path(original_name).suffix.lower()

    if suffix not in IMAGE_EXTENSIONS:
        raise ValueError("头像格式只支持 jpg、jpeg、png、webp、gif")

    guessed_mime_type = guess_mime_type_by_suffix(original_name)
    normalized_content_type = (content_type or guessed_mime_type).split(";")[0].strip().lower()

    if normalized_content_type not in IMAGE_MIME_TYPES:
        raise ValueError("头像文件类型不合法")

    avatar_dir = get_user_avatar_dir(user)
    avatar_dir.mkdir(parents=True, exist_ok=True)

    filename = f"{uuid4()}{suffix}"
    target_path = avatar_dir / filename
    target_path.write_bytes(content)

    asset_url = build_avatar_url(user, filename)

    asset = Asset(
        id=str(uuid4()),
        filename=filename,
        original_name=original_name,
        mime_type=normalized_content_type,
        size=len(content),
        url=asset_url,
        usage="user_avatar",
    )

    session.add(asset)
    session.commit()
    session.refresh(asset)

    return asset


def set_current_user_avatar(
    session: Session,
    user: User,
    asset: Asset,
) -> User:
    if asset.usage != "user_avatar":
        raise ValueError("资源不是用户头像")

    if not asset.url.startswith(f"/uploads/user/{safe_user_dir_name(user)}/avatars/"):
        raise ValueError("不能使用其他用户的头像资源")

    user.avatar_asset_id = asset.id
    user.updated_at = now_utc()

    session.add(user)
    session.commit()
    session.refresh(user)

    return user


def upload_current_user_avatar(
    session: Session,
    user: User,
    content: bytes,
    original_name: str,
    content_type: str | None,
) -> User:
    asset = create_avatar_asset_from_bytes(
        session=session,
        user=user,
        content=content,
        original_name=original_name,
        content_type=content_type,
    )

    return set_current_user_avatar(
        session=session,
        user=user,
        asset=asset,
    )


def list_current_user_avatars(
    session: Session,
    user: User,
) -> list[dict]:
    prefix = f"/uploads/user/{safe_user_dir_name(user)}/avatars/"

    assets = session.exec(
        select(Asset)
        .where(Asset.usage == "user_avatar")
        .where(Asset.url.startswith(prefix))
        .order_by(Asset.created_at.desc())
    ).all()

    return [
        {
            "id": asset.id,
            "filename": asset.filename,
            "originalName": asset.original_name,
            "mimeType": asset.mime_type,
            "size": asset.size,
            "url": asset.url,
            "usage": asset.usage,
            "createdAt": asset.created_at,
            "isCurrent": asset.id == user.avatar_asset_id,
        }
        for asset in assets
    ]


def switch_current_user_avatar(
    session: Session,
    user: User,
    asset_id: str | None,
) -> User:
    if not asset_id:
        user.avatar_asset_id = None
        user.updated_at = now_utc()

        session.add(user)
        session.commit()
        session.refresh(user)

        return user

    asset = session.get(Asset, asset_id)

    if not asset:
        raise ValueError("头像资源不存在")

    return set_current_user_avatar(
        session=session,
        user=user,
        asset=asset,
    )


def get_user_avatar_file_path(user: User, asset: Asset) -> Path:
    prefix = f"/uploads/user/{safe_user_dir_name(user)}/avatars/"

    if not asset.url.startswith(prefix):
        raise ValueError("不能删除其他用户的头像资源")

    relative_path = Path(asset.url.removeprefix("/uploads/"))

    if relative_path.is_absolute() or ".." in relative_path.parts:
        raise ValueError("头像文件路径非法")

    return UPLOADS_DIR / relative_path


def delete_current_user_avatar_asset(
    session: Session,
    user: User,
    asset_id: str,
) -> None:
    asset = session.get(Asset, asset_id)

    if not asset:
        raise ValueError("头像资源不存在")

    if asset.id == user.avatar_asset_id:
        raise ValueError("不能直接删除当前正在使用的头像，请先切换或清空头像")

    if asset.usage != "user_avatar":
        raise ValueError("资源不是用户头像")

    file_path = get_user_avatar_file_path(user, asset)

    if file_path.exists():
        file_path.unlink()

    session.delete(asset)
    session.commit()
