import json
import os
from collections.abc import Sequence
from concurrent.futures import Future, ThreadPoolExecutor
from pathlib import Path
from shutil import copy2, rmtree
from threading import Lock
from uuid import uuid4
import fitz

from fastapi import UploadFile
from sqlmodel import Session, func, select

from app.database import engine
from app.models import (
    Asset,
    ComicChapter,
    ComicPage,
    ComicUploadImage,
    ComicUploadJob,
    new_id,
    now_utc,
)

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
STAGING_LIMIT_BYTES = 100 * 1024 * 1024
UPLOAD_FILE_LIMIT_BYTES = 20 * 1024 * 1024

PDF_UPLOAD_FILE_LIMIT_BYTES = 100 * 1024 * 1024
PDF_RENDER_ZOOM = 4.0
PDF_MAX_PAGE_COUNT = 300

UPLOAD_MODE_NEW_CHAPTER = "new_chapter"
UPLOAD_MODE_EDIT_CHAPTER = "edit_chapter"
UPLOAD_MODES = {
    UPLOAD_MODE_NEW_CHAPTER,
    UPLOAD_MODE_EDIT_CHAPTER,
}

PDF_JOB_KIND = "pdf_import"

PDF_JOB_STATUS_QUEUED = "queued"
PDF_JOB_STATUS_RUNNING = "running"
PDF_JOB_STATUS_DONE = "done"
PDF_JOB_STATUS_FAILED = "failed"
PDF_JOB_STATUS_CANCELING = "canceling"
PDF_JOB_STATUS_CANCELED = "canceled"

PDF_JOB_ACTIVE_STATUSES = {
    PDF_JOB_STATUS_QUEUED,
    PDF_JOB_STATUS_RUNNING,
    PDF_JOB_STATUS_CANCELING,
}

PDF_JOB_TERMINAL_STATUSES = {
    PDF_JOB_STATUS_DONE,
    PDF_JOB_STATUS_FAILED,
    PDF_JOB_STATUS_CANCELED,
}

PDF_IMPORT_EXECUTOR = ThreadPoolExecutor(max_workers=1)
PDF_IMPORT_WORKER_LOCK = Lock()
PDF_IMPORT_WORKER_FUTURE: Future | None = None

# 当前文件位置：
# backend/app/services/comic_upload.py
# parents[2] = backend/
IMPORT_DATA_ROOT = Path(__file__).resolve().parents[2] / "import_data"
BACKEND_DIR = Path(__file__).resolve().parents[2]
UPLOADS_DIR = Path(os.getenv("UPLOADS_DIR", BACKEND_DIR / "uploads")).resolve()
COMIC_UPLOADS_ROOT = UPLOADS_DIR / "comics"

class PdfImportCanceled(Exception):
    pass


def get_user_staging_dir(user_id: str) -> Path:
    return IMPORT_DATA_ROOT / "users" / user_id / "comic-staging"


def get_user_staging_relative_path(user_id: str, stored_filename: str) -> str:
    return f"users/{user_id}/comic-staging/{stored_filename}"

def get_pdf_job_dir(user_id: str, job_id: str) -> Path:
    return IMPORT_DATA_ROOT / "users" / user_id / "comic-upload-jobs" / job_id


def get_pdf_job_pages_dir(user_id: str, job_id: str) -> Path:
    return get_pdf_job_dir(user_id, job_id) / "pages"


def get_pdf_job_page_relative_path(user_id: str, job_id: str, filename: str) -> str:
    return f"users/{user_id}/comic-upload-jobs/{job_id}/pages/{filename}"


def get_pdf_job_page_path_from_relative(
    *,
    job: ComicUploadJob,
    relative_path: str,
) -> Path:
    path = Path(relative_path)
    expected_prefix = (
        "users",
        job.user_id,
        "comic-upload-jobs",
        job.id,
        "pages",
    )

    if path.is_absolute() or ".." in path.parts:
        raise ValueError("PDF job 页面路径非法")

    if len(path.parts) != len(expected_prefix) + 1:
        raise ValueError("PDF job 页面路径非法")

    if path.parts[:len(expected_prefix)] != expected_prefix:
        raise ValueError("PDF job 页面路径非法")

    filename = path.parts[-1]

    if not filename:
        raise ValueError("PDF job 页面路径非法")

    return IMPORT_DATA_ROOT / path


def get_pdf_job_source_relative_path(user_id: str, job_id: str) -> str:
    return f"users/{user_id}/comic-upload-jobs/{job_id}/source.pdf"


def get_pdf_job_source_path_from_relative(source_path: str) -> Path:
    relative_path = Path(source_path)

    if relative_path.is_absolute() or ".." in relative_path.parts:
        raise ValueError("PDF job 源文件路径非法")

    return IMPORT_DATA_ROOT / relative_path


def cleanup_pdf_job_source_file(job: ComicUploadJob) -> None:
    if not job.source_path:
        return

    source_path = get_pdf_job_source_path_from_relative(job.source_path)

    if source_path.exists():
        source_path.unlink()

    job_dir = source_path.parent

    if job_dir.exists() and not any(job_dir.iterdir()):
        job_dir.rmdir()


def cleanup_pdf_job_pages(job: ComicUploadJob) -> None:
    pages_dir = get_pdf_job_pages_dir(job.user_id, job.id)

    if pages_dir.exists():
        rmtree(pages_dir)

    job_dir = get_pdf_job_dir(job.user_id, job.id)

    if job_dir.exists() and not any(job_dir.iterdir()):
        job_dir.rmdir()


def cleanup_pdf_job_work_files(job: ComicUploadJob) -> None:
    cleanup_pdf_job_source_file(job)
    cleanup_pdf_job_pages(job)


def pdf_job_has_work_files(job: ComicUploadJob) -> bool:
    if job.source_path:
        source_path = get_pdf_job_source_path_from_relative(job.source_path)

        if source_path.exists():
            return True

    return get_pdf_job_pages_dir(job.user_id, job.id).exists()


def rollback_pdf_import_job_outputs(
    session: Session,
    job: ComicUploadJob,
) -> None:
    image_ids = load_job_created_image_ids(job)

    for image_id in image_ids:
        image = session.get(ComicUploadImage, image_id)

        if image is None:
            continue

        if image.user_id != job.user_id:
            continue

        file_path = get_upload_image_path(image)

        if file_path.exists():
            file_path.unlink()

        session.delete(image)

    session.flush()

    compact_user_upload_orders(
        session=session,
        user_id=job.user_id,
        commit=False,
    )

    job.created_image_ids_json = dump_job_created_image_ids([])
    job.created_size_bytes = 0
    job.processed_pages = 0
    job.progress = 0
    job.updated_at = now_utc()
    session.add(job)

def mark_pdf_import_job_failed(
    session: Session,
    job: ComicUploadJob,
    exc: Exception,
) -> ComicUploadJob:
    session.rollback()

    job = session.get(ComicUploadJob, job.id)

    if job is None:
        raise ValueError("PDF 导入任务不存在")

    try:
        cleanup_pdf_job_work_files(job)

        now = now_utc()
        job.status = PDF_JOB_STATUS_FAILED
        job.message = "导入失败"
        job.error_message = str(exc)[:1000]
        job.finished_at = now
        job.updated_at = now
        job.output_pages_json = None
        job.output_size_bytes = 0
        job.created_image_ids_json = None
        job.created_size_bytes = 0

        session.add(job)
        session.commit()
        session.refresh(job)

        return job

    except Exception:
        session.rollback()
        raise


def mark_pdf_import_job_canceled(
    session: Session,
    job: ComicUploadJob,
) -> ComicUploadJob:
    session.rollback()

    job = session.get(ComicUploadJob, job.id)

    if job is None:
        raise ValueError("PDF 导入任务不存在")

    try:
        cleanup_pdf_job_work_files(job)

        now = now_utc()
        job.status = PDF_JOB_STATUS_CANCELED
        job.message = "已取消"
        job.error_message = None
        job.canceled_at = now
        job.finished_at = now
        job.updated_at = now
        job.output_pages_json = None
        job.output_size_bytes = 0
        job.created_image_ids_json = None
        job.created_size_bytes = 0

        session.add(job)
        session.commit()
        session.refresh(job)

        return job

    except Exception:
        session.rollback()
        raise


def mark_pdf_import_job_done(
    session: Session,
    job: ComicUploadJob,
) -> ComicUploadJob:
    cleanup_pdf_job_source_file(job)

    now = now_utc()
    job.status = PDF_JOB_STATUS_DONE
    job.progress = 100
    job.message = "PDF 已拆分完成，等待加入待传区"
    job.error_message = None
    job.finished_at = now
    job.updated_at = now

    session.add(job)
    session.commit()
    session.refresh(job)

    return job

def get_upload_image_path(image: ComicUploadImage) -> Path:
    relative_path = Path(image.storage_path)

    if relative_path.is_absolute() or ".." in relative_path.parts:
        raise ValueError("缓存图片路径非法")

    return IMPORT_DATA_ROOT / relative_path

def get_comic_asset_upload_path(asset: Asset) -> Path:
    prefix = "/uploads/comics/"

    if not asset.url.startswith(prefix):
        raise ValueError("asset 不是漫画正式图片资源")

    relative_path = Path(asset.url.removeprefix(prefix))

    if relative_path.is_absolute() or ".." in relative_path.parts:
        raise ValueError("asset 文件路径非法")

    return COMIC_UPLOADS_ROOT / relative_path

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

def load_job_created_image_ids(job: ComicUploadJob) -> list[str]:
    if not job.created_image_ids_json:
        return []

    try:
        value = json.loads(job.created_image_ids_json)
    except json.JSONDecodeError:
        return []

    if not isinstance(value, list):
        return []

    return [
        str(item)
        for item in value
        if isinstance(item, str) and item
    ]


def dump_job_created_image_ids(image_ids: Sequence[str]) -> str:
    return json.dumps(
        list(image_ids),
        ensure_ascii=False,
        separators=(",", ":"),
    )


def load_job_output_pages(job: ComicUploadJob) -> list[dict]:
    if not job.output_pages_json:
        return []

    try:
        value = json.loads(job.output_pages_json)
    except json.JSONDecodeError:
        return []

    if not isinstance(value, list):
        return []

    pages: list[dict] = []

    for item in value:
        if not isinstance(item, dict):
            continue

        page = item.get("page")
        filename = item.get("filename")
        relative_path = item.get("relativePath")
        size_bytes = item.get("sizeBytes")

        if not isinstance(page, int) or page <= 0:
            continue

        if not isinstance(filename, str) or not filename:
            continue

        if not isinstance(relative_path, str) or not relative_path:
            continue

        if not isinstance(size_bytes, int) or size_bytes < 0:
            continue

        pages.append(
            {
                "page": page,
                "filename": filename,
                "relativePath": relative_path,
                "sizeBytes": size_bytes,
            }
        )

    pages.sort(key=lambda item: item["page"])
    return pages


def dump_job_output_pages(pages: Sequence[dict]) -> str:
    clean_pages = []

    for item in pages:
        clean_pages.append(
            {
                "page": int(item["page"]),
                "filename": str(item["filename"]),
                "relativePath": str(item["relativePath"]),
                "sizeBytes": int(item["sizeBytes"]),
            }
        )

    return json.dumps(
        clean_pages,
        ensure_ascii=False,
        separators=(",", ":"),
    )


def append_job_output_page(
    job: ComicUploadJob,
    *,
    page: int,
    filename: str,
    relative_path: str,
    size_bytes: int,
) -> None:
    pages = load_job_output_pages(job)
    pages.append(
        {
            "page": page,
            "filename": filename,
            "relativePath": relative_path,
            "sizeBytes": size_bytes,
        }
    )
    pages.sort(key=lambda item: item["page"])
    job.output_pages_json = dump_job_output_pages(pages)
    job.output_size_bytes = sum(item["sizeBytes"] for item in pages)


def load_job_merged_image_ids(job: ComicUploadJob) -> list[str]:
    if not job.merged_image_ids_json:
        return []

    try:
        value = json.loads(job.merged_image_ids_json)
    except json.JSONDecodeError:
        return []

    if not isinstance(value, list):
        return []

    return [
        str(item)
        for item in value
        if isinstance(item, str) and item
    ]


def dump_job_merged_image_ids(image_ids: Sequence[str]) -> str:
    return json.dumps(
        list(image_ids),
        ensure_ascii=False,
        separators=(",", ":"),
    )


def append_job_created_image_id(
    job: ComicUploadJob,
    image_id: str,
) -> None:
    image_ids = load_job_created_image_ids(job)
    image_ids.append(image_id)
    job.created_image_ids_json = dump_job_created_image_ids(image_ids)

def refresh_job_and_check_cancel(
    session: Session,
    job: ComicUploadJob,
) -> ComicUploadJob:
    session.refresh(job)

    if job.status == PDF_JOB_STATUS_CANCELING:
        raise PdfImportCanceled()

    if job.status == PDF_JOB_STATUS_CANCELED:
        raise PdfImportCanceled()

    return job

def serialize_comic_upload_job(job: ComicUploadJob) -> dict:
    return {
        "id": job.id,
        "kind": job.kind,
        "status": job.status,
        "originalFilename": job.original_filename,
        "totalPages": job.total_pages,
        "processedPages": job.processed_pages,
        "progress": job.progress,
        "message": job.message,
        "errorMessage": job.error_message,
        "targetPartId": job.target_part_id,
        "uploadMode": job.upload_mode,
        "createdImageIds": load_job_created_image_ids(job),
        "createdSizeBytes": job.created_size_bytes,
        "outputPages": load_job_output_pages(job),
        "outputSizeBytes": job.output_size_bytes,
        "mergedAt": job.merged_at,
        "mergedImageIds": load_job_merged_image_ids(job),
        "createdAt": job.created_at,
        "updatedAt": job.updated_at,
        "startedAt": job.started_at,
        "finishedAt": job.finished_at,
        "canceledAt": job.canceled_at,
    }

def validate_upload_mode(upload_mode: str | None) -> str:
    if upload_mode is None:
        return UPLOAD_MODE_NEW_CHAPTER

    upload_mode = upload_mode.strip()

    if upload_mode not in UPLOAD_MODES:
        raise ValueError("upload_mode 必须是 new_chapter 或 edit_chapter")

    return upload_mode

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

def get_comic_upload_job(
    session: Session,
    user_id: str,
    job_id: str,
) -> ComicUploadJob:
    statement = (
        select(ComicUploadJob)
        .where(ComicUploadJob.id == job_id)
        .where(ComicUploadJob.user_id == user_id)
    )

    job = session.exec(statement).first()

    if job is None:
        raise ValueError("PDF 导入任务不存在")

    return job


def list_comic_upload_jobs(
    session: Session,
    user_id: str,
    active_only: bool = False,
    limit: int = 20,
) -> list[ComicUploadJob]:
    page_limit = max(1, min(limit, 100))

    statement = (
        select(ComicUploadJob)
        .where(ComicUploadJob.user_id == user_id)
        .order_by(ComicUploadJob.created_at.desc())
        .limit(page_limit)
    )

    if active_only:
        statement = statement.where(
            ComicUploadJob.status.in_(PDF_JOB_ACTIVE_STATUSES)
        )

    return list(session.exec(statement).all())


def get_next_queued_pdf_import_job(session: Session) -> ComicUploadJob | None:
    statement = (
        select(ComicUploadJob)
        .where(ComicUploadJob.kind == PDF_JOB_KIND)
        .where(ComicUploadJob.status == PDF_JOB_STATUS_QUEUED)
        .order_by(ComicUploadJob.created_at)
    )

    return session.exec(statement).first()


def get_active_comic_upload_job(
    session: Session,
    user_id: str,
) -> ComicUploadJob | None:
    statement = (
        select(ComicUploadJob)
        .where(ComicUploadJob.user_id == user_id)
        .where(ComicUploadJob.status.in_(PDF_JOB_ACTIVE_STATUSES))
        .order_by(ComicUploadJob.created_at.desc())
    )

    return session.exec(statement).first()


def ensure_no_active_comic_upload_job(
    session: Session,
    user_id: str,
) -> None:
    active_job = get_active_comic_upload_job(
        session=session,
        user_id=user_id,
    )

    if active_job is not None:
        raise ValueError("当前已有 PDF 导入任务正在进行，请完成或取消后再操作")

def ensure_pdf_job_can_use_current_staging(
    session: Session,
    user_id: str,
    target_part_id: str | None,
) -> None:
    images = list_user_upload_images(
        session=session,
        user_id=user_id,
    )

    if not images:
        return

    invalid_edit_images = [
        image.id
        for image in images
        if image.upload_mode != UPLOAD_MODE_NEW_CHAPTER
        or image.target_chapter_id is not None
    ]

    if invalid_edit_images:
        raise ValueError("当前待传区正在编辑已有章节，请先发布、取消编辑或清空后再导入 PDF")

    first_target_part_id = images[0].target_part_id

    inconsistent_target_images = [
        image.id
        for image in images
        if image.target_part_id != first_target_part_id
    ]

    if inconsistent_target_images:
        raise ValueError("当前待传区目标不一致，请先清空待传区后再导入 PDF")

    if first_target_part_id != target_part_id:
        raise ValueError("当前待传区已绑定其它上传目标，请先清空待传区后再导入 PDF")

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
    target_part_id: str | None = None,
    target_chapter_id: str | None = None,
    upload_mode: str | None = None,
) -> ComicUploadImage:
    original_filename = validate_image_filename(upload_file.filename)
    suffix = Path(original_filename).suffix.lower()

    clean_upload_mode = validate_upload_mode(upload_mode)

    if clean_upload_mode == UPLOAD_MODE_EDIT_CHAPTER and not target_chapter_id:
        raise ValueError("edit_chapter 模式必须指定 target_chapter_id")

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
            target_part_id=target_part_id,
            target_chapter_id=target_chapter_id,
            upload_mode=clean_upload_mode,
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
    target_part_id: str | None = None,
    target_chapter_id: str | None = None,
    upload_mode: str | None = None,
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
                target_part_id=target_part_id,
                target_chapter_id=target_chapter_id,
                upload_mode=upload_mode,
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

async def create_pdf_import_job(
    session: Session,
    user_id: str,
    upload_file: UploadFile,
    target_part_id: str | None = None,
) -> ComicUploadJob:
    original_filename = clean_original_filename(upload_file.filename)

    if not original_filename.lower().endswith(".pdf"):
        raise ValueError("只支持 PDF 文件")

    content_type = (upload_file.content_type or "").split(";")[0].strip().lower()
    if content_type and content_type not in {"application/pdf", "application/octet-stream"}:
        raise ValueError("上传文件不是 PDF")

    job_id = new_id()
    job_dir = get_pdf_job_dir(user_id, job_id)
    job_dir.mkdir(parents=True, exist_ok=False)

    source_path = job_dir / "source.pdf"
    source_relative_path = get_pdf_job_source_relative_path(user_id, job_id)

    written_size = 0

    try:
        await upload_file.seek(0)

        with source_path.open("wb") as f:
            while True:
                chunk = await upload_file.read(1024 * 1024)

                if not chunk:
                    break

                written_size += len(chunk)

                if written_size > PDF_UPLOAD_FILE_LIMIT_BYTES:
                    raise ValueError("PDF 文件不能超过 100MB")

                f.write(chunk)

        if written_size <= 0:
            raise ValueError("PDF 文件为空")

        now = now_utc()

        job = ComicUploadJob(
            id=job_id,
            user_id=user_id,
            kind=PDF_JOB_KIND,
            status=PDF_JOB_STATUS_QUEUED,
            original_filename=original_filename,
            source_path=source_relative_path,
            total_pages=None,
            processed_pages=0,
            progress=0,
            message="已加入队列",
            error_message=None,
            target_part_id=target_part_id,
            upload_mode=UPLOAD_MODE_NEW_CHAPTER,
            created_image_ids_json=dump_job_created_image_ids([]),
            created_size_bytes=0,
            created_at=now,
            updated_at=now,
            started_at=None,
            finished_at=None,
            canceled_at=None,
        )

        session.add(job)
        session.commit()
        session.refresh(job)

        return job

    except Exception:
        session.rollback()

        if source_path.exists():
            source_path.unlink()

        if job_dir.exists() and not any(job_dir.iterdir()):
            job_dir.rmdir()

        raise

def request_cancel_pdf_import_job(
    session: Session,
    user_id: str,
    job_id: str,
) -> ComicUploadJob:
    job = get_comic_upload_job(
        session=session,
        user_id=user_id,
        job_id=job_id,
    )

    now = now_utc()

    if job.status == PDF_JOB_STATUS_QUEUED:
        job.status = PDF_JOB_STATUS_CANCELED
        job.progress = 0
        job.message = "已取消"
        job.error_message = None
        job.canceled_at = now
        job.finished_at = now
        job.updated_at = now

        cleanup_pdf_job_source_file(job)

        session.add(job)
        session.commit()
        session.refresh(job)

        return job

    if job.status == PDF_JOB_STATUS_RUNNING:
        job.status = PDF_JOB_STATUS_CANCELING
        job.message = "取消中，正在清理已生成图片..."
        job.updated_at = now

        session.add(job)
        session.commit()
        session.refresh(job)

        return job

    if job.status == PDF_JOB_STATUS_CANCELING:
        return job

    if job.status in PDF_JOB_TERMINAL_STATUSES:
        return job

    raise ValueError("当前任务状态不支持取消")


def discard_pdf_import_job(
    *,
    session: Session,
    user_id: str,
    job_id: str,
) -> ComicUploadJob:
    job = get_comic_upload_job(
        session=session,
        user_id=user_id,
        job_id=job_id,
    )

    if job.status in PDF_JOB_ACTIVE_STATUSES:
        raise ValueError("PDF 导入任务仍在进行中，请先取消任务")

    if job.merged_at is not None:
        raise ValueError("PDF 页面已加入待传区，不能清除任务结果")

    if job.status not in PDF_JOB_TERMINAL_STATUSES:
        raise ValueError("当前任务状态不支持清除")

    now = now_utc()

    cleanup_pdf_job_work_files(job)

    job.status = PDF_JOB_STATUS_CANCELED
    job.output_pages_json = None
    job.output_size_bytes = 0
    job.created_image_ids_json = None
    job.created_size_bytes = 0
    job.message = "PDF 导入结果已清除。"
    job.error_message = None
    job.canceled_at = now
    job.updated_at = now

    session.add(job)
    session.commit()
    session.refresh(job)

    return job


def cancel_user_pdf_import_jobs_for_staging_reset(
    *,
    session: Session,
    user_id: str,
    reason: str,
) -> list[ComicUploadJob]:
    statement = (
        select(ComicUploadJob)
        .where(ComicUploadJob.user_id == user_id)
        .where(ComicUploadJob.kind == PDF_JOB_KIND)
        .where(
            ComicUploadJob.status.in_(
                PDF_JOB_ACTIVE_STATUSES | PDF_JOB_TERMINAL_STATUSES,
            )
        )
        .order_by(ComicUploadJob.created_at)
    )
    jobs = list(session.exec(statement).all())
    changed_jobs: list[ComicUploadJob] = []
    now = now_utc()

    for job in jobs:
        has_work_files = pdf_job_has_work_files(job)
        has_output_metadata = bool(job.output_pages_json) or job.output_size_bytes > 0

        if job.status == PDF_JOB_STATUS_RUNNING:
            job.status = PDF_JOB_STATUS_CANCELING
            job.message = reason
            job.updated_at = now
            session.add(job)
            changed_jobs.append(job)
            continue

        if job.status == PDF_JOB_STATUS_CANCELING:
            job.message = reason
            job.updated_at = now
            session.add(job)
            changed_jobs.append(job)
            continue

        if job.merged_at is not None:
            if not has_work_files:
                continue

            cleanup_pdf_job_work_files(job)
            job.updated_at = now
            session.add(job)
            changed_jobs.append(job)
            continue

        if (
            job.status in {PDF_JOB_STATUS_FAILED, PDF_JOB_STATUS_CANCELED}
            and not has_work_files
            and not has_output_metadata
        ):
            continue

        cleanup_pdf_job_work_files(job)
        job.status = PDF_JOB_STATUS_CANCELED
        job.canceled_at = job.canceled_at or now
        job.output_pages_json = None
        job.output_size_bytes = 0
        job.created_image_ids_json = None
        job.created_size_bytes = 0
        job.message = reason
        job.updated_at = now
        session.add(job)
        changed_jobs.append(job)

    if not changed_jobs:
        return []

    session.commit()

    for job in changed_jobs:
        session.refresh(job)

    return changed_jobs


def merge_pdf_import_job_to_uploads(
    *,
    session: Session,
    user_id: str,
    job_id: str,
) -> tuple[ComicUploadJob, list[ComicUploadImage]]:
    job = get_comic_upload_job(
        session=session,
        user_id=user_id,
        job_id=job_id,
    )

    if job.status != PDF_JOB_STATUS_DONE:
        raise ValueError("PDF 尚未拆分完成，暂时不能加入待传区")

    if job.merged_at is not None:
        raise ValueError("PDF 页面已经加入待传区")

    if job.upload_mode != UPLOAD_MODE_NEW_CHAPTER:
        raise ValueError("PDF 页面只能加入新建章节待传区")

    if not job.target_part_id:
        raise ValueError("PDF 导入任务缺少目标分部，不能加入待传区")

    pages = load_job_output_pages(job)

    if not pages:
        raise ValueError("PDF 拆分结果不存在，不能加入待传区")

    if job.total_pages is not None and len(pages) != job.total_pages:
        raise ValueError("PDF 拆分结果文件缺失或异常，请重新导入")

    page_numbers = [item["page"] for item in pages]

    if len(set(page_numbers)) != len(page_numbers):
        raise ValueError("PDF 拆分结果文件缺失或异常，请重新导入")

    if sorted(page_numbers) != list(range(1, len(pages) + 1)):
        raise ValueError("PDF 拆分结果文件缺失或异常，请重新导入")

    total_output_size = 0
    source_paths: dict[int, Path] = {}

    for item in pages:
        source_path = get_pdf_job_page_path_from_relative(
            job=job,
            relative_path=item["relativePath"],
        )

        if not source_path.exists() or not source_path.is_file():
            raise ValueError("PDF 拆分结果文件缺失或异常，请重新导入")

        actual_size = source_path.stat().st_size

        if (
            actual_size <= 0
            or actual_size > UPLOAD_FILE_LIMIT_BYTES
            or actual_size != item["sizeBytes"]
        ):
            raise ValueError("PDF 拆分结果文件缺失或异常，请重新导入")

        total_output_size += actual_size
        source_paths[item["page"]] = source_path

    images = list_user_upload_images(
        session=session,
        user_id=user_id,
    )

    if images:
        if any(image.upload_mode == UPLOAD_MODE_EDIT_CHAPTER for image in images):
            raise ValueError("当前待传区正在编辑其它内容，请先发布或清空后再加入 PDF 页面。")

        if any(image.target_part_id != job.target_part_id for image in images):
            raise ValueError("当前待传区属于其它漫画分部，请先发布或清空后再加入 PDF 页面。")

    staging_size = get_user_staging_size(
        session=session,
        user_id=user_id,
    )

    if staging_size + total_output_size > STAGING_LIMIT_BYTES:
        raise ValueError("待传区容量不足，请先发布或清空部分图片后再加入 PDF 页面。")

    staging_dir = get_user_staging_dir(user_id)
    staging_dir.mkdir(parents=True, exist_ok=True)

    next_order = get_next_display_order(
        session=session,
        user_id=user_id,
    )

    created_files: list[Path] = []
    created_images: list[ComicUploadImage] = []

    try:
        for item in pages:
            source_path = source_paths[item["page"]]
            stored_filename = f"{uuid4().hex}.png"
            storage_path = f"users/{user_id}/comic-staging/{stored_filename}"
            destination_path = IMPORT_DATA_ROOT / storage_path

            created_files.append(destination_path)
            copy2(source_path, destination_path)

            original_filename = (
                f"{job.original_filename}-p{item['page']:03d}.png"
                if job.original_filename
                else f"page-{item['page']:03d}.png"
            )

            image = ComicUploadImage(
                user_id=user_id,
                target_part_id=job.target_part_id,
                target_chapter_id=None,
                upload_mode=UPLOAD_MODE_NEW_CHAPTER,
                original_filename=original_filename,
                stored_filename=stored_filename,
                storage_path=storage_path,
                content_type="image/png",
                size_bytes=item["sizeBytes"],
                display_order=next_order,
            )
            next_order += 1

            session.add(image)
            created_images.append(image)

        session.flush()

        image_ids = [image.id for image in created_images]
        now = now_utc()

        job.merged_at = now
        job.merged_image_ids_json = dump_job_merged_image_ids(image_ids)
        job.created_image_ids_json = job.merged_image_ids_json
        job.created_size_bytes = total_output_size
        job.message = "PDF 页面已加入待传区。"
        job.updated_at = now

        session.add(job)
        session.commit()
        session.refresh(job)

        for image in created_images:
            session.refresh(image)

    except Exception:
        session.rollback()

        for path in created_files:
            path.unlink(missing_ok=True)

        raise

    try:
        cleanup_pdf_job_pages(job)
    except OSError:
        pass

    return job, created_images


def run_pdf_import_job(job_id: str) -> None:
    with Session(engine) as session:
        job = session.get(ComicUploadJob, job_id)

        if job is None:
            return

        if job.status != PDF_JOB_STATUS_QUEUED:
            return

        source_path = get_pdf_job_source_path_from_relative(job.source_path)

        if not source_path.exists() or not source_path.is_file():
            mark_pdf_import_job_failed(
                session=session,
                job=job,
                exc=FileNotFoundError("PDF 源文件不存在"),
            )
            return

        document = None

        try:
            now = now_utc()
            job.status = PDF_JOB_STATUS_RUNNING
            job.started_at = now
            job.updated_at = now
            job.message = "正在读取 PDF..."
            session.add(job)
            session.commit()
            session.refresh(job)

            refresh_job_and_check_cancel(session, job)

            document = fitz.open(source_path)

            if document.page_count <= 0:
                raise ValueError("PDF 中没有页面")

            if document.page_count > PDF_MAX_PAGE_COUNT:
                raise ValueError(f"PDF 页数不能超过 {PDF_MAX_PAGE_COUNT} 页")

            job.total_pages = document.page_count
            job.processed_pages = 0
            job.progress = 0
            job.message = f"正在拆分第 0 / {document.page_count} 页"
            job.updated_at = now_utc()
            session.add(job)
            session.commit()
            session.refresh(job)

            pages_dir = get_pdf_job_pages_dir(job.user_id, job.id)
            pages_dir.mkdir(parents=True, exist_ok=True)

            matrix = fitz.Matrix(PDF_RENDER_ZOOM, PDF_RENDER_ZOOM)

            for page_index in range(document.page_count):
                refresh_job_and_check_cancel(session, job)

                page_number = page_index + 1
                page = document.load_page(page_index)
                pixmap = page.get_pixmap(matrix=matrix, alpha=False)
                image_bytes = pixmap.tobytes("png")
                image_size = len(image_bytes)

                if image_size <= 0:
                    raise ValueError(f"PDF 第 {page_number} 页转换失败")

                if image_size > UPLOAD_FILE_LIMIT_BYTES:
                    raise ValueError(f"PDF 第 {page_number} 页转换后的图片超过 20MB")

                filename = f"{page_number:03d}.png"
                relative_path = get_pdf_job_page_relative_path(
                    job.user_id,
                    job.id,
                    filename,
                )
                output_path = get_pdf_job_page_path_from_relative(
                    job=job,
                    relative_path=relative_path,
                )

                try:
                    output_path.parent.mkdir(parents=True, exist_ok=True)

                    if output_path.exists():
                        output_path.unlink()

                    pixmap.save(output_path)
                    size_bytes = output_path.stat().st_size

                    if size_bytes <= 0:
                        output_path.unlink(missing_ok=True)
                        raise ValueError(f"PDF 第 {page_number} 页转换失败")

                    if size_bytes > UPLOAD_FILE_LIMIT_BYTES:
                        output_path.unlink(missing_ok=True)
                        raise ValueError(f"PDF 第 {page_number} 页转换后的图片超过 20MB")

                    current_output_size = job.output_size_bytes or 0

                    if current_output_size + size_bytes > STAGING_LIMIT_BYTES:
                        output_path.unlink(missing_ok=True)
                        raise ValueError("PDF 拆分结果超过 100MB，请压缩后重试")

                    now = now_utc()
                    append_job_output_page(
                        job,
                        page=page_number,
                        filename=filename,
                        relative_path=relative_path,
                        size_bytes=size_bytes,
                    )
                    job.processed_pages = page_number
                    job.progress = int(page_number * 100 / document.page_count)
                    job.message = f"正在拆分第 {page_number} / {document.page_count} 页"
                    job.updated_at = now

                    session.add(job)
                    session.commit()
                    session.refresh(job)

                except Exception:
                    session.rollback()

                    if output_path.exists():
                        output_path.unlink()

                    raise

            refresh_job_and_check_cancel(session, job)

            if document is not None:
                document.close()
                document = None

            mark_pdf_import_job_done(
                session=session,
                job=job,
            )

        except PdfImportCanceled:
            if document is not None:
                document.close()
                document = None

            mark_pdf_import_job_canceled(
                session=session,
                job=job,
            )

        except Exception as exc:
            if document is not None:
                document.close()
                document = None

            mark_pdf_import_job_failed(
                session=session,
                job=job,
                exc=exc,
            )

def run_pdf_import_worker_loop() -> None:
    global PDF_IMPORT_WORKER_FUTURE

    try:
        while True:
            with Session(engine) as session:
                job = get_next_queued_pdf_import_job(session)

                if job is None:
                    return

                job_id = job.id

            try:
                run_pdf_import_job(job_id)
            except Exception:
                continue
    finally:
        with PDF_IMPORT_WORKER_LOCK:
            PDF_IMPORT_WORKER_FUTURE = None

        with Session(engine) as session:
            has_queued_job = get_next_queued_pdf_import_job(session) is not None

        if has_queued_job:
            ensure_pdf_import_worker_running()


def ensure_pdf_import_worker_running() -> None:
    global PDF_IMPORT_WORKER_FUTURE

    with PDF_IMPORT_WORKER_LOCK:
        if PDF_IMPORT_WORKER_FUTURE is not None and not PDF_IMPORT_WORKER_FUTURE.done():
            return

        PDF_IMPORT_WORKER_FUTURE = PDF_IMPORT_EXECUTOR.submit(
            run_pdf_import_worker_loop,
        )


def submit_pdf_import_job(job_id: str) -> None:
    ensure_pdf_import_worker_running()

def recover_interrupted_pdf_import_jobs() -> None:
    with Session(engine) as session:
        jobs = list(
            session.exec(
                select(ComicUploadJob)
                .where(ComicUploadJob.status.in_({
                    PDF_JOB_STATUS_RUNNING,
                    PDF_JOB_STATUS_CANCELING,
                }))
            ).all()
        )

        for job in jobs:
            try:
                rollback_pdf_import_job_outputs(
                    session=session,
                    job=job,
                )
                cleanup_pdf_job_source_file(job)

                now = now_utc()
                job.status = PDF_JOB_STATUS_FAILED
                job.message = "导入失败"
                job.error_message = "服务器重启，PDF 导入任务已中断，请重新上传。"
                job.finished_at = now
                job.updated_at = now

                session.add(job)
                session.commit()

            except Exception:
                session.rollback()

async def save_pdf_as_upload_images(
    session: Session,
    user_id: str,
    upload_file: UploadFile,
    target_part_id: str | None = None,
) -> dict:
    original_filename = clean_original_filename(upload_file.filename)

    if not original_filename.lower().endswith(".pdf"):
        raise ValueError("只支持 PDF 文件")

    content_type = (upload_file.content_type or "").split(";")[0].strip().lower()
    if content_type and content_type not in {"application/pdf", "application/octet-stream"}:
        raise ValueError("上传文件不是 PDF")

    clean_upload_mode = UPLOAD_MODE_NEW_CHAPTER

    staging_dir = get_user_staging_dir(user_id)
    staging_dir.mkdir(parents=True, exist_ok=True)

    current_size = get_user_staging_size(session, user_id)
    written_pdf_size = 0
    pdf_bytes = bytearray()

    await upload_file.seek(0)

    while True:
      chunk = await upload_file.read(1024 * 1024)

      if not chunk:
          break

      written_pdf_size += len(chunk)

      if written_pdf_size > PDF_UPLOAD_FILE_LIMIT_BYTES:
          raise ValueError("PDF 文件不能超过 100MB")

      pdf_bytes.extend(chunk)

    if written_pdf_size <= 0:
        raise ValueError("PDF 文件为空")

    saved: list[ComicUploadImage] = []
    created_paths: list[Path] = []

    try:
        document = fitz.open(stream=bytes(pdf_bytes), filetype="pdf")

        if document.page_count <= 0:
            raise ValueError("PDF 中没有页面")

        if document.page_count > PDF_MAX_PAGE_COUNT:
            raise ValueError(f"PDF 页数不能超过 {PDF_MAX_PAGE_COUNT} 页")

        next_order = get_next_display_order(session, user_id)
        now = now_utc()
        matrix = fitz.Matrix(PDF_RENDER_ZOOM, PDF_RENDER_ZOOM)

        for page_index in range(document.page_count):
            page = document.load_page(page_index)
            pixmap = page.get_pixmap(matrix=matrix, alpha=False)
            image_bytes = pixmap.tobytes("png")
            image_size = len(image_bytes)

            if image_size <= 0:
                raise ValueError(f"PDF 第 {page_index + 1} 页转换失败")

            if image_size > UPLOAD_FILE_LIMIT_BYTES:
                raise ValueError(f"PDF 第 {page_index + 1} 页转换后的图片超过 20MB")

            if current_size + sum(image.size_bytes for image in saved) + image_size > STAGING_LIMIT_BYTES:
                raise ValueError("待传区容量超过 100MB")

            stored_filename = f"{new_id()}.png"
            target_path = staging_dir / stored_filename
            target_path.write_bytes(image_bytes)
            created_paths.append(target_path)

            original_page_name = f"{Path(original_filename).stem}-p{page_index + 1:03d}.png"

            image = ComicUploadImage(
                user_id=user_id,
                target_part_id=target_part_id,
                target_chapter_id=None,
                upload_mode=clean_upload_mode,
                original_filename=original_page_name,
                stored_filename=stored_filename,
                storage_path=get_user_staging_relative_path(user_id, stored_filename),
                content_type="image/png",
                size_bytes=image_size,
                display_order=next_order + page_index,
                created_at=now,
                updated_at=now,
            )

            session.add(image)
            saved.append(image)

        document.close()

        session.commit()

        for image in saved:
            session.refresh(image)

        compact_user_upload_orders(session, user_id)

        return {
            "saved": saved,
            "rejected": [],
            "total_size": get_user_staging_size(session, user_id),
            "page_count": len(saved),
        }

    except Exception:
        session.rollback()

        for path in created_paths:
            if path.exists():
                path.unlink()

        if staging_dir.exists() and not any(staging_dir.iterdir()):
            staging_dir.rmdir()

        raise


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

def load_chapter_pages_to_uploads(
    session: Session,
    user_id: str,
    *,
    part_id: str,
    chapter: ComicChapter,
) -> list[ComicUploadImage]:
    """
    将已有正式漫画章节 pages 复制到当前用户待传区。

    注意：
    1. 这是复制正式文件到 staging，不直接复用正式文件。
    2. 调用前端应已弹窗确认，因为这里会清空当前用户 uploads。
    3. 清空 uploads 后，如果正式文件异常，会抛错，前端需要提示用户重新进入。
    """

    page_statement = (
        select(ComicPage)
        .where(ComicPage.chapter_id == chapter.id)
        .order_by(ComicPage.display_order)
    )
    pages = list(session.exec(page_statement).all())

    if not pages:
        clear_user_upload_images(
            session=session,
            user_id=user_id,
        )
        return []

    page_sources: list[tuple[ComicPage, Asset, Path]] = []

    for page in pages:
        asset = session.get(Asset, page.asset_id)

        if not asset:
            raise ValueError("章节页面关联的 asset 不存在")

        source_path = get_comic_asset_upload_path(asset)

        if not source_path.exists() or not source_path.is_file():
            raise FileNotFoundError(f"正式漫画图片文件不存在：{asset.url}")

        page_sources.append((page, asset, source_path))

    clear_user_upload_images(
        session=session,
        user_id=user_id,
    )

    staging_dir = get_user_staging_dir(user_id)
    staging_dir.mkdir(parents=True, exist_ok=True)

    created_paths: list[Path] = []

    try:
        now = now_utc()

        for index, (_, asset, source_path) in enumerate(page_sources, start=1):
            suffix = source_path.suffix.lower()
            stored_filename = f"{new_id()}{suffix}"
            target_path = staging_dir / stored_filename

            copy2(source_path, target_path)
            created_paths.append(target_path)

            image = ComicUploadImage(
                user_id=user_id,
                target_part_id=part_id,
                target_chapter_id=chapter.id,
                upload_mode=UPLOAD_MODE_EDIT_CHAPTER,
                original_filename=asset.original_name or asset.filename,
                stored_filename=stored_filename,
                storage_path=get_user_staging_relative_path(user_id, stored_filename),
                content_type=asset.mime_type,
                size_bytes=target_path.stat().st_size,
                display_order=index,
                created_at=now,
                updated_at=now,
            )

            session.add(image)

        session.commit()

        return list_user_upload_images(
            session=session,
            user_id=user_id,
        )

    except Exception:
        session.rollback()

        for path in created_paths:
            if path.exists():
                path.unlink()

        if staging_dir.exists() and not any(staging_dir.iterdir()):
            staging_dir.rmdir()

        raise

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
