from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlmodel import Session

from app.database import get_session
from app.dependencies.auth import require_current_user
from app.models import ComicPart, ComicUploadImage, User
from app.services.comic_admin import (
    UPLOADS_ROOT,
    get_part,
    get_part_owner,
    import_comic_chapter_from_dir,
)
from app.services.comic_upload import (
    STAGING_LIMIT_BYTES,
    clear_user_upload_images,
    delete_upload_image,
    delete_upload_images,
    get_ordered_stored_file_names,
    get_staging_source_dir_for_publish,
    get_upload_image,
    get_upload_image_path,
    get_user_staging_size,
    list_user_upload_images,
    save_upload_images,
)


router = APIRouter(
    prefix="/api/author/comic-upload",
    tags=["author-comic-upload"],
)


class DeleteUploadImagesPayload(BaseModel):
    imageIds: list[str]


class PublishComicChapterPayload(BaseModel):
    series_slug: str
    part_slug: str

    chapter_title: str | None = None

    # 第一版发布到已存在 part。
    # series_title / part_title 暂时不从这里处理，后续新建 series/part 另开接口。
    ordered_image_ids: list[str] | None = None


def upload_image_to_public(image: ComicUploadImage) -> dict:
    return {
        "id": image.id,
        "originalFilename": image.original_filename,
        "storedFilename": image.stored_filename,
        "contentType": image.content_type,
        "sizeBytes": image.size_bytes,
        "displayOrder": image.display_order,
        "createdAt": image.created_at,
        "updatedAt": image.updated_at,
        "previewUrl": f"/api/author/comic-upload/images/{image.id}/preview",
    }


def upload_state_to_public(
    session: Session,
    user_id: str,
    images: list[ComicUploadImage],
) -> dict:
    return {
        "images": [upload_image_to_public(image) for image in images],
        "totalSizeBytes": get_user_staging_size(session, user_id),
        "limitBytes": STAGING_LIMIT_BYTES,
    }


def publish_result_to_public(result: dict) -> dict:
    series = result["series"]
    part = result["part"]
    chapter = result["chapter"]

    return {
        "series": {
            "id": series.id,
            "slug": series.slug,
            "title": series.title,
        },
        "part": {
            "id": part.id,
            "slug": part.slug,
            "title": part.title,
        },
        "chapter": {
            "id": chapter.id,
            "slug": chapter.slug,
            "title": chapter.title,
            "displayOrder": chapter.display_order,
            "visibility": chapter.visibility,
        },
        "pageCount": result["page_count"],
    }


def raise_service_error(exc: Exception) -> None:
    message = str(exc)

    if "500MB" in message:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=message,
        ) from exc

    if isinstance(exc, FileNotFoundError):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=message,
        ) from exc

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=message,
    ) from exc


def normalize_slug(value: str, field_name: str) -> str:
    value = value.strip()

    if not value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{field_name} 不能为空",
        )

    if "/" in value or "\\" in value or ".." in value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{field_name} 不合法",
        )

    return value


def get_part_for_publish(
    session: Session,
    series_slug: str,
    part_slug: str,
) -> ComicPart:
    try:
        return get_part(
            session=session,
            series_slug=series_slug,
            part_slug=part_slug,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc


def ensure_current_user_is_part_owner(
    session: Session,
    part: ComicPart,
    current_user: User,
) -> None:
    owner = get_part_owner(
        session=session,
        part=part,
    )

    if owner is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="该作品分部尚未设置 owner",
        )

    if owner.id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="你不是该作品分部的 owner",
        )


@router.get("/images")
def list_upload_images(
    session: Session = Depends(get_session),
    current_user: User = Depends(require_current_user),
):
    images = list_user_upload_images(
        session=session,
        user_id=current_user.id,
    )

    return upload_state_to_public(
        session=session,
        user_id=current_user.id,
        images=images,
    )


@router.post("/images")
async def upload_images(
    files: list[UploadFile] = File(...),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_current_user),
):
    if not files:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="没有选择文件",
        )

    try:
        result = await save_upload_images(
            session=session,
            user_id=current_user.id,
            upload_files=files,
        )
    except Exception as exc:
        raise_service_error(exc)

    return {
        "saved": [
            upload_image_to_public(image)
            for image in result["saved"]
        ],
        "rejected": result["rejected"],
        "totalSizeBytes": result["total_size"],
        "limitBytes": STAGING_LIMIT_BYTES,
    }


@router.get("/images/{image_id}/preview")
def preview_upload_image(
    image_id: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_current_user),
):
    try:
        image = get_upload_image(
            session=session,
            user_id=current_user.id,
            image_id=image_id,
        )
        file_path = get_upload_image_path(image)
    except Exception as exc:
        raise_service_error(exc)

    if not file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="缓存图片文件不存在",
        )

    return FileResponse(
        path=file_path,
        media_type=image.content_type or "application/octet-stream",
        filename=image.original_filename,
    )


@router.delete("/images/{image_id}")
def delete_one_upload_image(
    image_id: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_current_user),
):
    try:
        images = delete_upload_image(
            session=session,
            user_id=current_user.id,
            image_id=image_id,
        )
    except Exception as exc:
        raise_service_error(exc)

    return upload_state_to_public(
        session=session,
        user_id=current_user.id,
        images=images,
    )


@router.post("/images/delete-batch")
def delete_many_upload_images(
    payload: DeleteUploadImagesPayload,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_current_user),
):
    try:
        images = delete_upload_images(
            session=session,
            user_id=current_user.id,
            image_ids=payload.imageIds,
        )
    except Exception as exc:
        raise_service_error(exc)

    return upload_state_to_public(
        session=session,
        user_id=current_user.id,
        images=images,
    )


@router.delete("/images")
def clear_upload_images(
    session: Session = Depends(get_session),
    current_user: User = Depends(require_current_user),
):
    try:
        clear_user_upload_images(
            session=session,
            user_id=current_user.id,
        )
    except Exception as exc:
        raise_service_error(exc)

    return {
        "images": [],
        "totalSizeBytes": 0,
        "limitBytes": STAGING_LIMIT_BYTES,
    }


@router.post("/publish")
def publish_upload_as_chapter(
    payload: PublishComicChapterPayload,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_current_user),
):
    series_slug = normalize_slug(payload.series_slug, "series_slug")
    part_slug = normalize_slug(payload.part_slug, "part_slug")

    part = get_part_for_publish(
        session=session,
        series_slug=series_slug,
        part_slug=part_slug,
    )

    ensure_current_user_is_part_owner(
        session=session,
        part=part,
        current_user=current_user,
    )

    try:
        images = list_user_upload_images(
            session=session,
            user_id=current_user.id,
        )

        if not images:
            raise ValueError("当前待传区没有图片")

        if payload.ordered_image_ids is None:
            ordered_image_ids = [image.id for image in images]
        else:
            ordered_image_ids = payload.ordered_image_ids

        image_ids = {image.id for image in images}

        if (
                len(ordered_image_ids) != len(images)
                or set(ordered_image_ids) != image_ids
        ):
            raise ValueError("发布列表必须包含当前待传区全部图片")

        source_dir = get_staging_source_dir_for_publish(current_user.id)

        ordered_file_names = get_ordered_stored_file_names(
            session=session,
            user_id=current_user.id,
            ordered_image_ids=ordered_image_ids,
        )

        result = import_comic_chapter_from_dir(
            session=session,
            source_dir=source_dir,
            series_slug=series_slug,
            part_slug=part_slug,
            chapter_title=payload.chapter_title,
            uploads_root=UPLOADS_ROOT,
            ordered_file_names=ordered_file_names,
        )

        delete_upload_images(
            session=session,
            user_id=current_user.id,
            image_ids=ordered_image_ids,
        )

    except Exception as exc:
        raise_service_error(exc)

    return publish_result_to_public(result)