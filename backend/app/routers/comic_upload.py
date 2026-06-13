import json

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile, status
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlmodel import Session, select

from app.database import get_session
from app.dependencies.auth import require_current_user
from app.models import ActivityLog, ComicPart, ComicUploadImage, User
from app.services.activity_logs import build_error_metadata, log_activity
from app.services.comic_admin import (
    UPLOADS_ROOT,
    get_chapter,
    get_part,
    get_part_owner,
    import_comic_chapter_from_dir,
    replace_comic_chapter_pages_from_dir,
)
from app.services.comic_upload import (
    PDF_JOB_STATUS_FAILED,
    STAGING_LIMIT_BYTES,
    UPLOAD_MODE_EDIT_CHAPTER,
    UPLOAD_MODE_NEW_CHAPTER,
    clear_user_upload_images,
    create_pdf_import_job,
    delete_upload_image,
    delete_upload_images,
    ensure_no_active_comic_upload_job,
    get_active_comic_upload_job,
    get_comic_upload_job,
    get_ordered_stored_file_names,
    get_staging_source_dir_for_publish,
    get_upload_image,
    get_upload_image_path,
    get_user_staging_size,
    list_comic_upload_jobs,
    list_user_upload_images,
    load_chapter_pages_to_uploads,
    merge_pdf_import_job_to_uploads,
    request_cancel_pdf_import_job,
    save_upload_images,
    save_pdf_as_upload_images,
    serialize_comic_upload_job,
    submit_pdf_import_job,
    update_upload_image_order,
    validate_upload_mode,
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

class LoadComicChapterUploadPayload(BaseModel):
    series_slug: str
    part_slug: str
    chapter_slug: str


class PublishComicChapterUpdatePayload(BaseModel):
    series_slug: str
    part_slug: str
    chapter_slug: str
    ordered_image_ids: list[str] | None = None


class ReorderUploadImagesPayload(BaseModel):
    ordered_image_ids: list[str]


def upload_image_to_public(image: ComicUploadImage) -> dict:
    return {
        "id": image.id,
        "targetPartId": image.target_part_id,
        "targetChapterId": image.target_chapter_id,
        "uploadMode": image.upload_mode,
        "originalFilename": image.original_filename,
        "storedFilename": image.stored_filename,
        "contentType": image.content_type,
        "sizeBytes": image.size_bytes,
        "displayOrder": image.display_order,
        "createdAt": image.created_at,
        "updatedAt": image.updated_at,
        "previewUrl": f"/api/author/comic-upload/images/{image.id}/preview",
    }

def upload_target_to_public(images: list[ComicUploadImage]) -> dict:
    if not images:
        return {
            "uploadMode": UPLOAD_MODE_NEW_CHAPTER,
            "targetPartId": None,
            "targetChapterId": None,
        }

    first_image = images[0]

    inconsistent = any(
        image.upload_mode != first_image.upload_mode
        or image.target_part_id != first_image.target_part_id
        or image.target_chapter_id != first_image.target_chapter_id
        for image in images
    )

    return {
        "uploadMode": first_image.upload_mode,
        "targetPartId": first_image.target_part_id,
        "targetChapterId": first_image.target_chapter_id,
        "targetInconsistent": inconsistent,
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
        **upload_target_to_public(images),
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

def ensure_upload_staging_is_not_busy(
    session: Session,
    current_user: User,
) -> None:
    try:
        ensure_no_active_comic_upload_job(
            session=session,
            user_id=current_user.id,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
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

def resolve_upload_target(
    session: Session,
    *,
    current_user: User,
    upload_mode: str | None,
    series_slug: str | None,
    part_slug: str | None,
    chapter_slug: str | None,
) -> dict:
    clean_upload_mode = validate_upload_mode(upload_mode)

    if not series_slug and not part_slug and not chapter_slug:
        return {
            "upload_mode": clean_upload_mode,
            "target_part_id": None,
            "target_chapter_id": None,
        }

    if not series_slug or not part_slug:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="指定上传目标时必须同时提供 series_slug 和 part_slug",
        )

    clean_series_slug = normalize_slug(series_slug, "series_slug")
    clean_part_slug = normalize_slug(part_slug, "part_slug")

    part = get_part_for_publish(
        session=session,
        series_slug=clean_series_slug,
        part_slug=clean_part_slug,
    )

    ensure_current_user_is_part_owner(
        session=session,
        part=part,
        current_user=current_user,
    )

    target_chapter_id = None

    if clean_upload_mode == UPLOAD_MODE_EDIT_CHAPTER:
        if not chapter_slug:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="edit_chapter 模式必须提供 chapter_slug",
            )

        clean_chapter_slug = normalize_slug(chapter_slug, "chapter_slug")

        try:
            chapter = get_chapter(
                session=session,
                series_slug=clean_series_slug,
                part=part,
                part_slug=clean_part_slug,
                chapter_slug=clean_chapter_slug,
            )
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=str(exc),
            ) from exc

        target_chapter_id = chapter.id

    return {
        "upload_mode": clean_upload_mode,
        "target_part_id": part.id,
        "target_chapter_id": target_chapter_id,
    }

def summarize_upload_images(images: list[ComicUploadImage]) -> dict:
    return {
        "image_count": len(images),
        "total_size_bytes": sum(image.size_bytes for image in images),
        "image_ids": [image.id for image in images],
        "original_filenames": [image.original_filename for image in images],
    }

def ensure_uploads_new_chapter(
    *,
    images: list[ComicUploadImage],
    part: ComicPart,
) -> None:
    if not images:
        raise ValueError("当前待传区没有图片")

    invalid_images = [
        image.id
        for image in images
        if image.upload_mode != UPLOAD_MODE_NEW_CHAPTER
        or image.target_chapter_id is not None
        or image.target_part_id not in {None, part.id}
    ]

    if invalid_images:
        raise ValueError("当前待传区不是新建章节状态，请清空或切换为新建章节后再发布")


def ensure_uploads_target_chapter(
    *,
    images: list[ComicUploadImage],
    part: ComicPart,
    chapter_id: str,
) -> None:
    if not images:
        raise ValueError("当前待传区没有图片")

    invalid_images = [
        image.id
        for image in images
        if image.upload_mode != UPLOAD_MODE_EDIT_CHAPTER
        or image.target_part_id != part.id
        or image.target_chapter_id != chapter_id
    ]

    if invalid_images:
        raise ValueError("当前待传区不属于要覆盖的漫画章节，请重新载入该章节后再发布")

def upload_image_snapshot(image: ComicUploadImage) -> dict:
    return {
        "image_id": image.id,
        "target_part_id": image.target_part_id,
        "target_chapter_id": image.target_chapter_id,
        "upload_mode": image.upload_mode,
        "original_filename": image.original_filename,
        "stored_filename": image.stored_filename,
        "content_type": image.content_type,
        "size_bytes": image.size_bytes,
        "display_order": image.display_order,
        "storage_path": image.storage_path,
    }


def find_upload_batch_log(
    session: Session,
    *,
    actor_user_id: str,
    upload_batch_id: str,
) -> ActivityLog | None:
    return session.exec(
        select(ActivityLog)
        .where(ActivityLog.actor_user_id == actor_user_id)
        .where(ActivityLog.category == "comic_upload")
        .where(ActivityLog.action == "comic_upload.image.upload")
        .where(ActivityLog.target_type == "comic_upload_image")
        .where(ActivityLog.target_id == upload_batch_id)
    ).first()


def merge_upload_batch_log(
    session: Session,
    *,
    request: Request,
    current_user: User,
    upload_batch_id: str | None,
    upload_batch_index: int | None,
    upload_batch_total: int | None,
    saved_images: list[ComicUploadImage],
    rejected_items: list[dict],
    total_size_bytes: int,
) -> None:
    if not saved_images and not rejected_items:
        return

    batch_id = upload_batch_id or (
        saved_images[0].id if saved_images else f"upload-batch-{current_user.id}"
    )

    saved_snapshots = [upload_image_snapshot(image) for image in saved_images]

    existing_log = find_upload_batch_log(
        session,
        actor_user_id=current_user.id,
        upload_batch_id=batch_id,
    )

    if existing_log is None:
        log_activity(
            session,
            actor=current_user,
            action="comic_upload.image.upload",
            category="comic_upload",
            target_type="comic_upload_image",
            target_id=batch_id,
            target_label=(
                saved_images[0].original_filename
                if len(saved_images) == 1 and (upload_batch_total or 1) == 1
                else f"上传待传区图片 {upload_batch_total or len(saved_images)} 张"
            ),
            status="success",
            message=(
                f"上传漫画待传区图片 {upload_batch_total or len(saved_images)} 张"
            ),
            metadata={
                "source": "author",
                "user_id": current_user.id,
                "username": current_user.username,
                "upload_batch_id": batch_id,
                "upload_batch_total": upload_batch_total or len(saved_images),
                "received_indexes": (
                    [upload_batch_index]
                    if upload_batch_index is not None
                    else []
                ),
                "saved_count": len(saved_images),
                "rejected_count": len(rejected_items),
                "total_size_bytes": total_size_bytes,
                "limit_bytes": STAGING_LIMIT_BYTES,
                "saved": saved_snapshots,
                "rejected": rejected_items,
            },
            request=request,
        )
        return

    try:
        metadata = json.loads(existing_log.metadata_json or "{}")
    except json.JSONDecodeError:
        metadata = {}

    saved = list(metadata.get("saved") or [])
    rejected = list(metadata.get("rejected") or [])
    received_indexes = list(metadata.get("received_indexes") or [])

    saved.extend(saved_snapshots)
    rejected.extend(rejected_items)

    if upload_batch_index is not None and upload_batch_index not in received_indexes:
        received_indexes.append(upload_batch_index)
        received_indexes.sort()

    metadata.update(
        {
            "source": "author",
            "user_id": current_user.id,
            "username": current_user.username,
            "upload_batch_id": batch_id,
            "upload_batch_total": upload_batch_total or metadata.get("upload_batch_total") or len(saved),
            "received_indexes": received_indexes,
            "saved_count": len(saved),
            "rejected_count": len(rejected),
            "total_size_bytes": total_size_bytes,
            "limit_bytes": STAGING_LIMIT_BYTES,
            "saved": saved,
            "rejected": rejected,
        }
    )

    existing_log.metadata_json = json.dumps(
        metadata,
        ensure_ascii=False,
        default=str,
        separators=(",", ":"),
    )

    existing_log.target_label = f"上传待传区图片 {len(saved)} 张"
    existing_log.message = f"上传漫画待传区图片 {len(saved)} 张"

    session.add(existing_log)
    session.commit()

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

@router.get("/pdf-jobs")
def list_pdf_import_jobs(
    active_only: bool = Query(default=False),
    limit: int = Query(default=20, ge=1, le=100),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_current_user),
):
    jobs = list_comic_upload_jobs(
        session=session,
        user_id=current_user.id,
        active_only=active_only,
        limit=limit,
    )

    active_job = get_active_comic_upload_job(
        session=session,
        user_id=current_user.id,
    )

    return {
        "jobs": [
            serialize_comic_upload_job(job)
            for job in jobs
        ],
        "activeJob": (
            serialize_comic_upload_job(active_job)
            if active_job
            else None
        ),
    }


@router.get("/pdf-jobs/{job_id}")
def get_pdf_import_job(
    job_id: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_current_user),
):
    try:
        job = get_comic_upload_job(
            session=session,
            user_id=current_user.id,
            job_id=job_id,
        )
    except Exception as exc:
        raise_service_error(exc)

    return serialize_comic_upload_job(job)

@router.post("/pdf-jobs")
async def create_pdf_import_job_api(
    request: Request,
    file: UploadFile = File(...),
    series_slug: str | None = Form(default=None),
    part_slug: str | None = Form(default=None),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_current_user),
):
    target_part_id = None
    clean_series_slug = None
    clean_part_slug = None
    part = None
    job = None

    if series_slug or part_slug:
        if not series_slug or not part_slug:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="PDF 上传目标必须同时提供 series_slug 和 part_slug",
            )

        clean_series_slug = normalize_slug(series_slug, "series_slug")
        clean_part_slug = normalize_slug(part_slug, "part_slug")

        part = get_part_for_publish(
            session=session,
            series_slug=clean_series_slug,
            part_slug=clean_part_slug,
        )

        ensure_current_user_is_part_owner(
            session=session,
            part=part,
            current_user=current_user,
        )

        target_part_id = part.id

    try:
        job = await create_pdf_import_job(
            session=session,
            user_id=current_user.id,
            upload_file=file,
            target_part_id=target_part_id,
        )

        try:
            submit_pdf_import_job(job.id)

        except Exception as submit_exc:
            job.status = PDF_JOB_STATUS_FAILED
            job.message = "导入失败"
            job.error_message = f"提交后台任务失败：{submit_exc}"
            session.add(job)
            session.commit()
            session.refresh(job)

            raise submit_exc

    except Exception as exc:
        log_activity(
            session,
            actor=current_user,
            action="comic_upload.pdf_job.create.failed",
            category="comic_upload",
            target_type="comic_upload_job",
            target_id=job.id if job else None,
            target_label=file.filename,
            status="failed",
            message="创建 PDF 导入任务失败",
            error_code="comic_upload_pdf_job_create_failed",
            metadata=build_error_metadata(
                exc,
                {
                    "source": "author",
                    "user_id": current_user.id,
                    "username": current_user.username,
                    "series_slug": clean_series_slug,
                    "part_slug": clean_part_slug,
                    "part_id": part.id if part else None,
                    "part_title": part.title if part else None,
                    "original_filename": file.filename,
                },
            ),
            request=request,
        )

        raise_service_error(exc)

    log_activity(
        session,
        actor=current_user,
        action="comic_upload.pdf_job.create",
        category="comic_upload",
        target_type="comic_upload_job",
        target_id=job.id,
        target_label=job.original_filename,
        status="success",
        message="创建 PDF 导入任务",
        metadata={
            "source": "author",
            "user_id": current_user.id,
            "username": current_user.username,
            "series_slug": clean_series_slug,
            "part_slug": clean_part_slug,
            "part_id": part.id if part else None,
            "part_title": part.title if part else None,
            "job": serialize_comic_upload_job(job),
        },
        request=request,
    )

    return serialize_comic_upload_job(job)

@router.post("/pdf-jobs/{job_id}/cancel")
def cancel_pdf_import_job_api(
    request: Request,
    job_id: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_current_user),
):
    job_before = None

    try:
        job_before = get_comic_upload_job(
            session=session,
            user_id=current_user.id,
            job_id=job_id,
        )

        job = request_cancel_pdf_import_job(
            session=session,
            user_id=current_user.id,
            job_id=job_id,
        )

    except Exception as exc:
        log_activity(
            session,
            actor=current_user,
            action="comic_upload.pdf_job.cancel.failed",
            category="comic_upload",
            target_type="comic_upload_job",
            target_id=job_id,
            target_label=job_before.original_filename if job_before else job_id,
            status="failed",
            message="取消 PDF 导入任务失败",
            error_code="comic_upload_pdf_job_cancel_failed",
            metadata=build_error_metadata(
                exc,
                {
                    "source": "author",
                    "user_id": current_user.id,
                    "username": current_user.username,
                    "job_id": job_id,
                    "job_before": (
                        serialize_comic_upload_job(job_before)
                        if job_before
                        else None
                    ),
                },
            ),
            request=request,
        )

        raise_service_error(exc)

    log_activity(
        session,
        actor=current_user,
        action="comic_upload.pdf_job.cancel",
        category="comic_upload",
        target_type="comic_upload_job",
        target_id=job.id,
        target_label=job.original_filename,
        status="success",
        message="请求取消 PDF 导入任务",
        metadata={
            "source": "author",
            "user_id": current_user.id,
            "username": current_user.username,
            "job_before": serialize_comic_upload_job(job_before),
            "job_after": serialize_comic_upload_job(job),
        },
        request=request,
    )

    return serialize_comic_upload_job(job)

@router.post("/pdf-jobs/{job_id}/merge")
def merge_pdf_import_job(
    request: Request,
    job_id: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_current_user),
):
    job_before = None

    try:
        job_before = get_comic_upload_job(
            session=session,
            user_id=current_user.id,
            job_id=job_id,
        )

        job, images = merge_pdf_import_job_to_uploads(
            session=session,
            user_id=current_user.id,
            job_id=job_id,
        )

    except ValueError as exc:
        log_activity(
            session,
            actor=current_user,
            action="comic_upload.pdf_job.merge.failed",
            category="comic_upload",
            target_type="comic_upload_job",
            target_id=job_id,
            target_label=job_before.original_filename if job_before else job_id,
            status="failed",
            message="合并 PDF 页面到待传区失败",
            error_code="comic_upload_pdf_job_merge_failed",
            metadata=build_error_metadata(
                exc,
                {
                    "source": "author",
                    "user_id": current_user.id,
                    "username": current_user.username,
                    "job_id": job_id,
                    "job_before": (
                        serialize_comic_upload_job(job_before)
                        if job_before
                        else None
                    ),
                },
            ),
            request=request,
        )

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc

    log_activity(
        session,
        actor=current_user,
        action="comic_upload.pdf_job.merge",
        category="comic_upload",
        target_type="comic_upload_job",
        target_id=job.id,
        target_label=job.original_filename,
        status="success",
        message="合并 PDF 页面到待传区",
        metadata={
            "source": "author",
            "user_id": current_user.id,
            "username": current_user.username,
            "job": serialize_comic_upload_job(job),
            "original_filename": job.original_filename,
            "output_pages_count": len(serialize_comic_upload_job(job)["outputPages"]),
            "merged_image_count": len(images),
            "target_part_id": job.target_part_id,
            "merged_images": [
                upload_image_snapshot(image)
                for image in images
            ],
        },
        request=request,
    )

    return {
        "job": serialize_comic_upload_job(job),
        "uploadState": upload_state_to_public(
            session=session,
            user_id=current_user.id,
            images=list_user_upload_images(
                session=session,
                user_id=current_user.id,
            ),
        ),
    }

@router.post("/images")
async def upload_images(
    request: Request,
    files: list[UploadFile] = File(...),
    upload_batch_id: str | None = Form(default=None),
    upload_batch_index: int | None = Form(default=None),
    upload_batch_total: int | None = Form(default=None),
    upload_mode: str | None = Form(default=None),
    series_slug: str | None = Form(default=None),
    part_slug: str | None = Form(default=None),
    chapter_slug: str | None = Form(default=None),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_current_user),
):
    if not files:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="没有选择文件",
        )

    target = resolve_upload_target(
        session=session,
        current_user=current_user,
        upload_mode=upload_mode,
        series_slug=series_slug,
        part_slug=part_slug,
        chapter_slug=chapter_slug,
    )

    try:
        result = await save_upload_images(
            session=session,
            user_id=current_user.id,
            upload_files=files,
            target_part_id=target["target_part_id"],
            target_chapter_id=target["target_chapter_id"],
            upload_mode=target["upload_mode"],
        )
    except Exception as exc:
        raise_service_error(exc)

    merge_upload_batch_log(
        session,
        request=request,
        current_user=current_user,
        upload_batch_id=upload_batch_id,
        upload_batch_index=upload_batch_index,
        upload_batch_total=upload_batch_total,
        saved_images=result["saved"],
        rejected_items=result["rejected"],
        total_size_bytes=result["total_size"],
    )

    saved_images = result["saved"]
    rejected_items = result["rejected"]

    return {
        "saved": [
            upload_image_to_public(image)
            for image in saved_images
        ],
        "rejected": rejected_items,
        "totalSizeBytes": result["total_size"],
        "limitBytes": STAGING_LIMIT_BYTES,
        **upload_target_to_public(list_user_upload_images(session, current_user.id)),
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
    request: Request,
    image_id: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_current_user),
):
    image_before_delete = None

    try:
        image = get_upload_image(
            session=session,
            user_id=current_user.id,
            image_id=image_id,
        )
        image_before_delete = upload_image_snapshot(image)

        images = delete_upload_image(
            session=session,
            user_id=current_user.id,
            image_id=image_id,
        )
    except Exception as exc:
        log_activity(
            session,
            actor=current_user,
            action="comic_upload.image.delete.failed",
            category="comic_upload",
            target_type="comic_upload_image",
            target_id=image_id,
            target_label=(
                image_before_delete["original_filename"]
                if image_before_delete
                else image_id
            ),
            status="failed",
            message="删除漫画待传区图片失败",
            error_code="comic_upload_image_delete_failed",
            metadata=build_error_metadata(
                exc,
                {
                    "source": "author",
                    "user_id": current_user.id,
                    "username": current_user.username,
                    "image_id": image_id,
                    "image": image_before_delete,
                },
            ),
            request=request,
        )
        raise_service_error(exc)

    log_activity(
        session,
        actor=current_user,
        action="comic_upload.image.delete",
        category="comic_upload",
        target_type="comic_upload_image",
        target_id=image_id,
        target_label=image_before_delete["original_filename"],
        status="success",
        message="删除漫画待传区图片",
        metadata={
            "source": "author",
            "user_id": current_user.id,
            "username": current_user.username,
            "deleted_count": 1,
            "deleted": [image_before_delete],
            "remaining_count": len(images),
            "remaining_total_size_bytes": get_user_staging_size(session, current_user.id),
        },
        request=request,
    )

    return upload_state_to_public(
        session=session,
        user_id=current_user.id,
        images=images,
    )

@router.post("/images/delete-batch")
def delete_many_upload_images(
    request: Request,
    payload: DeleteUploadImagesPayload,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_current_user),
):
    deleted_snapshots: list[dict] = []

    try:
        images_to_delete = [
            get_upload_image(
                session=session,
                user_id=current_user.id,
                image_id=image_id,
            )
            for image_id in payload.imageIds
        ]
        deleted_snapshots = [
            upload_image_snapshot(image)
            for image in images_to_delete
        ]

        images = delete_upload_images(
            session=session,
            user_id=current_user.id,
            image_ids=payload.imageIds,
        )
    except Exception as exc:
        log_activity(
            session,
            actor=current_user,
            action="comic_upload.image.delete.failed",
            category="comic_upload",
            target_type="comic_upload_image",
            target_id=deleted_snapshots[0]["image_id"] if len(deleted_snapshots) == 1 else None,
            target_label=(
                deleted_snapshots[0]["original_filename"]
                if len(deleted_snapshots) == 1
                else f"批量删除待传区图片失败 {len(payload.imageIds)} 张"
            ),
            status="failed",
            message="批量删除漫画待传区图片失败",
            error_code="comic_upload_image_delete_failed",
            metadata=build_error_metadata(
                exc,
                {
                    "source": "author",
                    "user_id": current_user.id,
                    "username": current_user.username,
                    "requested_image_ids": payload.imageIds,
                    "resolved_count": len(deleted_snapshots),
                    "deleted_candidates": deleted_snapshots,
                },
            ),
            request=request,
        )
        raise_service_error(exc)

    if deleted_snapshots:
        log_activity(
            session,
            actor=current_user,
            action="comic_upload.image.delete",
            category="comic_upload",
            target_type="comic_upload_image",
            target_id=deleted_snapshots[0]["image_id"] if len(deleted_snapshots) == 1 else None,
            target_label=(
                deleted_snapshots[0]["original_filename"]
                if len(deleted_snapshots) == 1
                else f"批量删除待传区图片 {len(deleted_snapshots)} 张"
            ),
            status="success",
            message=f"批量删除漫画待传区图片 {len(deleted_snapshots)} 张",
            metadata={
                "source": "author",
                "user_id": current_user.id,
                "username": current_user.username,
                "deleted_count": len(deleted_snapshots),
                "deleted": deleted_snapshots,
                "remaining_count": len(images),
                "remaining_total_size_bytes": get_user_staging_size(session, current_user.id),
            },
            request=request,
        )

    return upload_state_to_public(
        session=session,
        user_id=current_user.id,
        images=images,
    )


@router.patch("/images/reorder")
def reorder_upload_images(
    request: Request,
    payload: ReorderUploadImagesPayload,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_current_user),
):
    images_before = list_user_upload_images(
        session=session,
        user_id=current_user.id,
    )

    try:
        images = update_upload_image_order(
            session=session,
            user_id=current_user.id,
            ordered_image_ids=payload.ordered_image_ids,
            append_missing=False,
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
    request: Request,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_current_user),
):
    deleted_summary = {
        "image_count": 0,
        "total_size_bytes": 0,
        "image_ids": [],
        "original_filenames": [],
    }
    deleted_snapshots: list[dict] = []

    try:
        images_before_clear = list_user_upload_images(
            session=session,
            user_id=current_user.id,
        )
        deleted_summary = summarize_upload_images(images_before_clear)
        deleted_snapshots = [
            upload_image_snapshot(image)
            for image in images_before_clear
        ]

        clear_user_upload_images(
            session=session,
            user_id=current_user.id,
        )
    except Exception as exc:
        log_activity(
            session,
            actor=current_user,
            action="comic_upload.image.clear.failed",
            category="comic_upload",
            target_type="comic_upload_image",
            target_id=None,
            target_label=f"清空待传区图片失败 {deleted_summary['image_count']} 张",
            status="failed",
            message="清空漫画待传区图片失败",
            error_code="comic_upload_image_clear_failed",
            metadata=build_error_metadata(
                exc,
                {
                    "source": "author",
                    "user_id": current_user.id,
                    "username": current_user.username,
                    **deleted_summary,
                    "deleted_candidates": deleted_snapshots,
                },
            ),
            request=request,
        )
        raise_service_error(exc)

    if deleted_summary["image_count"] > 0:
        log_activity(
            session,
            actor=current_user,
            action="comic_upload.image.clear",
            category="comic_upload",
            target_type="comic_upload_image",
            target_id=None,
            target_label=f"清空待传区图片 {deleted_summary['image_count']} 张",
            status="success",
            message=f"清空漫画待传区图片 {deleted_summary['image_count']} 张",
            metadata={
                "source": "author",
                "user_id": current_user.id,
                "username": current_user.username,
                **deleted_summary,
                "deleted": deleted_snapshots,
            },
            request=request,
        )

    return {
        "images": [],
        "totalSizeBytes": 0,
        "limitBytes": STAGING_LIMIT_BYTES,
        "uploadMode": UPLOAD_MODE_NEW_CHAPTER,
        "targetPartId": None,
        "targetChapterId": None,
    }

@router.post("/pdf")
async def upload_pdf_as_images(
    request: Request,
    file: UploadFile = File(...),
    series_slug: str | None = Form(default=None),
    part_slug: str | None = Form(default=None),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_current_user),
):
    target_part_id = None
    clean_series_slug = None
    clean_part_slug = None
    part = None

    if series_slug or part_slug:
        if not series_slug or not part_slug:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="PDF 上传目标必须同时提供 series_slug 和 part_slug",
            )

        clean_series_slug = normalize_slug(series_slug, "series_slug")
        clean_part_slug = normalize_slug(part_slug, "part_slug")

        part = get_part_for_publish(
            session=session,
            series_slug=clean_series_slug,
            part_slug=clean_part_slug,
        )

        ensure_current_user_is_part_owner(
            session=session,
            part=part,
            current_user=current_user,
        )

        target_part_id = part.id

    try:
        result = await save_pdf_as_upload_images(
            session=session,
            user_id=current_user.id,
            upload_file=file,
            target_part_id=target_part_id,
        )

        images = list_user_upload_images(
            session=session,
            user_id=current_user.id,
        )

    except Exception as exc:
        log_activity(
            session,
            actor=current_user,
            action="comic_upload.pdf.import.failed",
            category="comic_upload",
            target_type="comic_part",
            target_id=part.id if part else None,
            target_label=part.title if part else None,
            status="failed",
            message="导入 PDF 到漫画待传区失败",
            error_code="comic_upload_pdf_import_failed",
            metadata=build_error_metadata(
                exc,
                {
                    "source": "author",
                    "user_id": current_user.id,
                    "username": current_user.username,
                    "series_slug": clean_series_slug,
                    "part_slug": clean_part_slug,
                    "original_filename": file.filename,
                },
            ),
            request=request,
        )

        raise_service_error(exc)

    saved_images = result["saved"]

    log_activity(
        session,
        actor=current_user,
        action="comic_upload.pdf.import",
        category="comic_upload",
        target_type="comic_part",
        target_id=part.id if part else None,
        target_label=part.title if part else None,
        status="success",
        message=f"导入 PDF 到漫画待传区 {len(saved_images)} 页",
        metadata={
            "source": "author",
            "user_id": current_user.id,
            "username": current_user.username,
            "series_slug": clean_series_slug,
            "part_slug": clean_part_slug,
            "original_filename": file.filename,
            "page_count": len(saved_images),
            "saved": [
                upload_image_snapshot(image)
                for image in saved_images
            ],
        },
        request=request,
    )

    return upload_state_to_public(
        session=session,
        user_id=current_user.id,
        images=images,
    )

@router.post("/load-chapter")
def load_chapter_to_uploads(
    request: Request,
    payload: LoadComicChapterUploadPayload,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_current_user),
):
    series_slug = normalize_slug(payload.series_slug, "series_slug")
    part_slug = normalize_slug(payload.part_slug, "part_slug")
    chapter_slug = normalize_slug(payload.chapter_slug, "chapter_slug")

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

    chapter = None

    try:
        chapter = get_chapter(
            session=session,
            series_slug=series_slug,
            part=part,
            part_slug=part_slug,
            chapter_slug=chapter_slug,
        )

        images = load_chapter_pages_to_uploads(
            session=session,
            user_id=current_user.id,
            part_id=part.id,
            chapter=chapter,
        )

    except Exception as exc:
        log_activity(
            session,
            actor=current_user,
            action="comic_upload.chapter.load.failed",
            category="comic_upload",
            target_type="comic_chapter",
            target_id=chapter.id if chapter else None,
            target_label=chapter.title if chapter else chapter_slug,
            status="failed",
            message="载入漫画章节到待传区失败",
            error_code="comic_upload_chapter_load_failed",
            metadata=build_error_metadata(
                exc,
                {
                    "source": "author",
                    "user_id": current_user.id,
                    "username": current_user.username,
                    "series_slug": series_slug,
                    "part_slug": part_slug,
                    "chapter_slug": chapter_slug,
                    "part_id": part.id,
                    "part_title": part.title,
                },
            ),
            request=request,
        )

        raise_service_error(exc)

    state = upload_state_to_public(
        session=session,
        user_id=current_user.id,
        images=images,
    )

    if not images:
        state.update(
            {
                "uploadMode": UPLOAD_MODE_EDIT_CHAPTER,
                "targetPartId": part.id,
                "targetChapterId": chapter.id,
                "targetInconsistent": False,
            }
        )

    return state

@router.post("/publish")
def publish_upload_as_chapter(
    request: Request,
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

    images_before_publish: list[dict] = []
    ordered_image_ids: list[str] = []
    ordered_file_names: list[str] = []

    try:
        images = list_user_upload_images(
            session=session,
            user_id=current_user.id,
        )

        if not images:
            raise ValueError("当前待传区没有图片")

        ensure_uploads_new_chapter(
            images=images,
            part=part,
        )

        images_before_publish = [
            upload_image_snapshot(image)
            for image in images
        ]

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
        log_activity(
            session,
            actor=current_user,
            action="comic_upload.chapter.publish.failed",
            category="comic_upload",
            target_type="comic_part",
            target_id=part.id,
            target_label=part.title,
            status="failed",
            message="发布漫画待传区为正式章节失败",
            error_code="comic_upload_chapter_publish_failed",
            metadata=build_error_metadata(
                exc,
                {
                    "source": "author",
                    "user_id": current_user.id,
                    "username": current_user.username,
                    "series_slug": series_slug,
                    "part_slug": part_slug,
                    "part_id": part.id,
                    "part_title": part.title,
                    "chapter_title": payload.chapter_title,
                    "ordered_image_ids": ordered_image_ids,
                    "ordered_file_names": ordered_file_names,
                    "image_count": len(images_before_publish),
                    "published_images": images_before_publish,
                },
            ),
            request=request,
        )

        raise_service_error(exc)

    series = result["series"]
    published_part = result["part"]
    chapter = result["chapter"]
    page_count = result["page_count"]

    log_activity(
        session,
        actor=current_user,
        action="comic_upload.chapter.publish",
        category="comic_upload",
        target_type="comic_chapter",
        target_id=chapter.id,
        target_label=chapter.title,
        status="success",
        message="发布漫画待传区为正式章节",
        metadata={
            "source": "author",
            "user_id": current_user.id,
            "username": current_user.username,
            "series_id": series.id,
            "series_slug": series.slug,
            "series_title": series.title,
            "part_id": published_part.id,
            "part_slug": published_part.slug,
            "part_title": published_part.title,
            "chapter_id": chapter.id,
            "chapter_slug": chapter.slug,
            "chapter_title": chapter.title,
            "chapter_display_order": chapter.display_order,
            "page_count": page_count,
            "image_count": len(images_before_publish),
            "ordered_image_ids": ordered_image_ids,
            "ordered_file_names": ordered_file_names,
            "published_images": images_before_publish,
        },
        request=request,
    )

    return publish_result_to_public(result)

@router.post("/publish-to-chapter")
def publish_upload_to_existing_chapter(
    request: Request,
    payload: PublishComicChapterUpdatePayload,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_current_user),
):
    series_slug = normalize_slug(payload.series_slug, "series_slug")
    part_slug = normalize_slug(payload.part_slug, "part_slug")
    chapter_slug = normalize_slug(payload.chapter_slug, "chapter_slug")

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

    images_before_publish: list[dict] = []
    ordered_image_ids: list[str] = []
    ordered_file_names: list[str] = []
    chapter = None

    try:
        chapter = get_chapter(
            session=session,
            series_slug=series_slug,
            part=part,
            part_slug=part_slug,
            chapter_slug=chapter_slug,
        )

        images = list_user_upload_images(
            session=session,
            user_id=current_user.id,
        )

        ensure_uploads_target_chapter(
            images=images,
            part=part,
            chapter_id=chapter.id,
        )

        images_before_publish = [
            upload_image_snapshot(image)
            for image in images
        ]

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

        result = replace_comic_chapter_pages_from_dir(
            session=session,
            source_dir=source_dir,
            series_slug=series_slug,
            part_slug=part_slug,
            chapter_slug=chapter_slug,
            uploads_root=UPLOADS_ROOT,
            ordered_file_names=ordered_file_names,
            actor_user_id=current_user.id,
        )

        delete_upload_images(
            session=session,
            user_id=current_user.id,
            image_ids=ordered_image_ids,
        )

    except Exception as exc:
        log_activity(
            session,
            actor=current_user,
            action="comic_upload.chapter.update.failed",
            category="comic_upload",
            target_type="comic_chapter",
            target_id=chapter.id if chapter else None,
            target_label=chapter.title if chapter else chapter_slug,
            status="failed",
            message="用待传区覆盖漫画章节失败",
            error_code="comic_upload_chapter_update_failed",
            metadata=build_error_metadata(
                exc,
                {
                    "source": "author",
                    "user_id": current_user.id,
                    "username": current_user.username,
                    "series_slug": series_slug,
                    "part_slug": part_slug,
                    "chapter_slug": chapter_slug,
                    "part_id": part.id,
                    "part_title": part.title,
                    "ordered_image_ids": ordered_image_ids,
                    "ordered_file_names": ordered_file_names,
                    "image_count": len(images_before_publish),
                    "published_images": images_before_publish,
                },
            ),
            request=request,
        )

        raise_service_error(exc)

    series = result["series"]
    published_part = result["part"]
    updated_chapter = result["chapter"]
    page_count = result["page_count"]

    log_activity(
        session,
        actor=current_user,
        action="comic_upload.chapter.update",
        category="comic_upload",
        target_type="comic_chapter",
        target_id=updated_chapter.id,
        target_label=updated_chapter.title,
        status="success",
        message="用待传区覆盖漫画章节",
        metadata={
            "source": "author",
            "user_id": current_user.id,
            "username": current_user.username,
            "series_id": series.id,
            "series_slug": series.slug,
            "series_title": series.title,
            "part_id": published_part.id,
            "part_slug": published_part.slug,
            "part_title": published_part.title,
            "chapter_id": updated_chapter.id,
            "chapter_slug": updated_chapter.slug,
            "chapter_title": updated_chapter.title,
            "chapter_display_order": updated_chapter.display_order,
            "old_page_count": result.get("old_page_count"),
            "page_count": page_count,
            "image_count": len(images_before_publish),
            "ordered_image_ids": ordered_image_ids,
            "ordered_file_names": ordered_file_names,
            "published_images": images_before_publish,
        },
        request=request,
    )

    return publish_result_to_public(result)
