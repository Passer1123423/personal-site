"""
database.py

负责：
1. 指定 SQLite 数据库文件位置
2. 创建数据库连接 engine
3. 启动时创建数据库表
4. 给后续 API 提供数据库 session
"""

from pathlib import Path

from sqlalchemy import inspect, text
from sqlmodel import SQLModel, Session, create_engine


# 当前文件是：
# backend/app/database.py
#
# parents[1] 指向 backend 目录
BASE_DIR = Path(__file__).resolve().parents[1]

# 数据库文件放在 backend/data/site.db
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)

DATABASE_PATH = DATA_DIR / "site.db"
DATABASE_URL = f"sqlite:///{DATABASE_PATH}"


engine = create_engine(
    DATABASE_URL,
    echo=False,
    connect_args={"check_same_thread": False},
)


def get_existing_columns(table_name: str) -> set[str]:
    inspector = inspect(engine)

    if not inspector.has_table(table_name):
        return set()

    return {
        column["name"]
        for column in inspector.get_columns(table_name)
    }


def add_column_if_missing(
    table_name: str,
    column_name: str,
    column_sql: str,
) -> None:
    existing_columns = get_existing_columns(table_name)

    if column_name in existing_columns:
        return

    with engine.begin() as connection:
        connection.execute(
            text(f"ALTER TABLE {table_name} ADD COLUMN {column_sql}")
        )


def apply_lightweight_schema_patches() -> None:
    """
    轻量 SQLite 表结构补丁。

    只用于给已有表补新增的可空字段或带默认值字段。
    不处理字段改名、删字段、改类型、复杂数据迁移。
    """

    add_column_if_missing(
        table_name="comicuploadimage",
        column_name="target_part_id",
        column_sql="target_part_id VARCHAR",
    )

    add_column_if_missing(
        table_name="comicuploadimage",
        column_name="target_chapter_id",
        column_sql="target_chapter_id VARCHAR",
    )

    add_column_if_missing(
        table_name="comicuploadimage",
        column_name="upload_mode",
        column_sql="upload_mode VARCHAR DEFAULT 'new_chapter' NOT NULL",
    )

    add_column_if_missing(
        table_name="comic_upload_job",
        column_name="output_pages_json",
        column_sql="output_pages_json TEXT",
    )

    add_column_if_missing(
        table_name="comic_upload_job",
        column_name="output_size_bytes",
        column_sql="output_size_bytes INTEGER DEFAULT 0 NOT NULL",
    )

    add_column_if_missing(
        table_name="comic_upload_job",
        column_name="merged_at",
        column_sql="merged_at DATETIME",
    )

    add_column_if_missing(
        table_name="comic_upload_job",
        column_name="merged_image_ids_json",
        column_sql="merged_image_ids_json TEXT",
    )


def create_db_and_tables():
    """
    创建数据库表。

    关键点：
    必须先 import models，再 create_all。

    因为 SQLModel 只有在 models.py 被导入后，
    才知道 Asset、ComicSeries 等表存在。
    """

    # 必须在 create_all 前面
    from . import models

    SQLModel.metadata.create_all(engine)
    apply_lightweight_schema_patches()


def get_session():
    """
    提供数据库会话。

    后面写 API 时会用到。
    """

    with Session(engine) as session:
        yield session
