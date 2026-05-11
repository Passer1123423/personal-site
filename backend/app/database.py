"""
database.py

负责：
1. 指定 SQLite 数据库文件位置
2. 创建数据库连接 engine
3. 启动时创建数据库表
4. 给后续 API 提供数据库 session
"""

from pathlib import Path

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


def get_session():
    """
    提供数据库会话。

    后面写 API 时会用到。
    """

    with Session(engine) as session:
        yield session
