from collections.abc import Sequence
from pathlib import Path

from fastapi import UploadFile
from sqlmodel import Session, func, select

from app.models import ComicUploadImage, new_id, now_utc

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
STAGING_LIMIT_BYTES = 100 * 1024 * 1024
UPLOAD_FILE_LIMIT_BYTES = 20 * 1024 * 1024

# 当前文件位置：
# backend/app/services/comic_upload.py
# parents[2] = backend/
IMPORT_DATA_ROOT = Path(__file__).resolve().parents[2] / "import_data"


def get_user_staging_dir(user_id: str) -> Path:
    return IMPORT_DATA_ROOT / "users" / user_id / "comic-staging"


def get_user_staging_relative_path(user_id: str, stored_filename: str) -> str:
    return f"users/{user_id}/comic-staging/{stored_filename}"


def get_upload_image_path(image: ComicUploadImage) -> Path:
    relative_path = Path(image.storage_path)

    if relative_path.is_absolute() or ".." in relative_path.parts:
        raise ValueError("缓存图片路径非法")

    return IMPORT_DATA_ROOT / relative_path


def clean_original_filename(filename: str | None) -> str:
    if not filename:
        return "unnamed"

    normalized = filename.replace("\\", "/")
    name = Path(normalized).name.strip()

    if not name:
        return "unnamed"

    return name


def validate_image_filename(filename: str) -> str:
    original_filename = clean_original_filename(filename)
    suffix = Path(original_filename).suffix.lower()

    if suffix not in IMAGE_EXTENSIONS:
        raise ValueError(f"不支持的图片格式：{original_filename}")

    if ":Zone.Identifier" in original_filename:
        raise ValueError(f"非法文件名：{original_filename}")

    return original_filename


def get_user_staging_size(session: Session, user_id: str) -> int:
    statement = select(func.sum(ComicUploadImage.size_bytes)).where(
        ComicUploadImage.user_id == user_id
    )

    total = session.exec(statement).one()

    return int(total or 0)


def get_next_display_order(session: Session, user_id: str) -> int:
    statement = select(func.max(ComicUploadImage.display_order)).where(
        ComicUploadImage.user_id == user_id
    )

    max_order = session.exec(statement).one()

    return int(max_order or 0) + 1


def list_user_upload_images(session: Session, user_id: str) -> list[ComicUploadImage]:
    statement = (
        select(ComicUploadImage)
        .where(ComicUploadImage.user_id == user_id)
        .order_by(ComicUploadImage.display_order, ComicUploadImage.created_at)
    )

    return list(session.exec(statement).all())


def get_upload_image(
    session: Session,
    user_id: str,
    image_id: str,
) -> ComicUploadImage:
    statement = select(ComicUploadImage).where(
        ComicUploadImage.id == image_id,
        ComicUploadImage.user_id == user_id,
    )

    image = session.exec(statement).first()

    if image is None:
        raise ValueError("待传图片不存在")

    return image


def compact_user_upload_orders(
    session: Session,
    user_id: str,
    commit: bool = True,
) -> list[ComicUploadImage]:
    images = list_user_upload_images(session, user_id)

    now = now_utc()

    for index, image in enumerate(images, start=1):
        if image.display_order != index:
            image.display_order = index
            image.updated_at = now
            session.add(image)

    if commit:
        session.commit()

    return list_user_upload_images(session, user_id)


async def save_upload_image(
    session: Session,
    user_id: str,
    upload_file: UploadFile,
) -> ComicUploadImage:
    original_filename = validate_image_filename(upload_file.filename)
    suffix = Path(original_filename).suffix.lower()

    staging_dir = get_user_staging_dir(user_id)
    staging_dir.mkdir(parents=True, exist_ok=True)

    stored_filename = f"{new_id()}{suffix}"
    target_path = staging_dir / stored_filename

    current_size = get_user_staging_size(session, user_id)
    written_size = 0

    try:
        await upload_file.seek(0)

        with target_path.open("wb") as f:
            while True:
                chunk = await upload_file.read(1024 * 1024)

                if not chunk:
                    break

                written_size += len(chunk)

                if written_size > UPLOAD_FILE_LIMIT_BYTES:
                    raise ValueError("单张图片不能超过 20MB")

                if current_size + written_size > STAGING_LIMIT_BYTES:
                    raise ValueError("待传区容量超过 100MB")

                f.write(chunk)

        if written_size <= 0:
            raise ValueError(f"上传文件为空：{original_filename}")

        image = ComicUploadImage(
            user_id=user_id,
            original_filename=original_filename,
            stored_filename=stored_filename,
            storage_path=get_user_staging_relative_path(user_id, stored_filename),
            content_type=upload_file.content_type,
            size_bytes=written_size,
            display_order=get_next_display_order(session, user_id),
        )

        session.add(image)
        session.commit()
        session.refresh(image)

        return image

    except Exception:
        session.rollback()

        if target_path.exists():
            target_path.unlink()

        raise


async def save_upload_images(
    session: Session,
    user_id: str,
    upload_files: Sequence[UploadFile],
) -> dict:
    saved: list[ComicUploadImage] = []
    rejected: list[dict] = []

    for upload_file in upload_files:
        filename = clean_original_filename(upload_file.filename)

        try:
            image = await save_upload_image(
                session=session,
                user_id=user_id,
                upload_file=upload_file,
            )
            saved.append(image)

        except ValueError as exc:
            rejected.append(
                {
                    "filename": filename,
                    "reason": str(exc),
                }
            )

    compact_user_upload_orders(session, user_id)

    return {
        "saved": saved,
        "rejected": rejected,
        "total_size": get_user_staging_size(session, user_id),
    }


def delete_upload_image(
    session: Session,
    user_id: str,
    image_id: str,
) -> list[ComicUploadImage]:
    image = get_upload_image(
        session=session,
        user_id=user_id,
        image_id=image_id,
    )

    file_path = get_upload_image_path(image)

    if file_path.exists():
        file_path.unlink()

    session.delete(image)
    session.flush()

    compact_user_upload_orders(
        session=session,
        user_id=user_id,
        commit=False,
    )

    session.commit()

    return list_user_upload_images(session, user_id)


def delete_upload_images(
    session: Session,
    user_id: str,
    image_ids: Sequence[str],
) -> list[ComicUploadImage]:
    if not image_ids:
        return list_user_upload_images(session, user_id)

    if len(set(image_ids)) != len(image_ids):
        raise ValueError("删除列表中存在重复图片")

    images = [
        get_upload_image(
            session=session,
            user_id=user_id,
            image_id=image_id,
        )
        for image_id in image_ids
    ]

    for image in images:
        file_path = get_upload_image_path(image)

        if file_path.exists():
            file_path.unlink()

        session.delete(image)

    session.flush()

    compact_user_upload_orders(
        session=session,
        user_id=user_id,
        commit=False,
    )

    session.commit()

    return list_user_upload_images(session, user_id)


def clear_user_upload_images(
    session: Session,
    user_id: str,
) -> None:
    images = list_user_upload_images(session, user_id)

    for image in images:
        file_path = get_upload_image_path(image)

        if file_path.exists():
            file_path.unlink()

        session.delete(image)

    session.commit()

    staging_dir = get_user_staging_dir(user_id)

    if staging_dir.exists() and not any(staging_dir.iterdir()):
        staging_dir.rmdir()


def update_upload_image_order(
    session: Session,
    user_id: str,
    ordered_image_ids: Sequence[str],
    append_missing: bool = True,
) -> list[ComicUploadImage]:
    images = list_user_upload_images(session, user_id)
    image_map = {image.id: image for image in images}

    ordered_ids = list(ordered_image_ids)

    if len(set(ordered_ids)) != len(ordered_ids):
        raise ValueError("排序列表中存在重复图片")

    missing_ids = [
        image_id for image_id in ordered_ids
        if image_id not in image_map
    ]

    if missing_ids:
        raise ValueError("排序列表中存在不属于当前用户的图片")

    if append_missing:
        rest_ids = [
            image.id for image in images
            if image.id not in ordered_ids
        ]

        final_ids = ordered_ids + rest_ids
    else:
        if len(ordered_ids) != len(images):
            raise ValueError("排序列表没有包含全部待传图片")

        final_ids = ordered_ids

    now = now_utc()

    for index, image_id in enumerate(final_ids, start=1):
        image = image_map[image_id]
        image.display_order = index
        image.updated_at = now
        session.add(image)

    session.commit()

    return list_user_upload_images(session, user_id)


def get_ordered_stored_file_names(
    session: Session,
    user_id: str,
    ordered_image_ids: Sequence[str] | None = None,
) -> list[str]:
    if ordered_image_ids is None:
        images = list_user_upload_images(session, user_id)
        return [image.stored_filename for image in images]

    images = list_user_upload_images(session, user_id)
    image_map = {image.id: image for image in images}

    ordered_ids = list(ordered_image_ids)

    if not ordered_ids:
        raise ValueError("没有选择要发布的图片")

    if len(set(ordered_ids)) != len(ordered_ids):
        raise ValueError("发布列表中存在重复图片")

    missing_ids = [
        image_id for image_id in ordered_ids
        if image_id not in image_map
    ]

    if missing_ids:
        raise ValueError("发布列表中存在不属于当前用户的图片")

    return [
        image_map[image_id].stored_filename
        for image_id in ordered_ids
    ]


def get_staging_source_dir_for_publish(user_id: str) -> Path:
    source_dir = get_user_staging_dir(user_id)

    if not source_dir.exists():
        raise FileNotFoundError("当前用户没有待传图片区")

    return source_dir