from pathlib import Path
from uuid import uuid4

from app.models import Asset


def new_asset_id() -> str:
    return str(uuid4())


def build_asset_filename(
    *,
    stem: str,
    suffix: str,
    asset_id: str,
) -> str:
    return f"{stem}-{asset_id}{suffix.lower()}"


def build_asset(
    *,
    asset_id: str | None = None,
    filename: str,
    original_name: str,
    mime_type: str,
    size: int,
    url: str,
    usage: str,
) -> Asset:
    return Asset(
        id=asset_id or new_asset_id(),
        filename=filename,
        original_name=original_name,
        mime_type=mime_type,
        size=size,
        url=url,
        usage=usage,
    )


def build_asset_from_file(
    *,
    asset_id: str | None = None,
    asset_url: str,
    source_path: Path,
    mime_type: str,
    usage: str,
) -> Asset:
    return build_asset(
        asset_id=asset_id,
        filename=Path(asset_url).name,
        original_name=source_path.name,
        mime_type=mime_type,
        size=source_path.stat().st_size,
        url=asset_url,
        usage=usage,
    )
