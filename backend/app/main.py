import os
from fastapi.middleware.cors import CORSMiddleware
"""
main.py

这个文件是 FastAPI 后端入口。

目前它做三件事：

1. 创建 FastAPI 应用 app
2. 程序启动时自动创建数据库表
3. 提供两个最基础的测试接口

后面会继续在这里挂载：

1. 漫画 API
2. 上传 API
3. 后台管理 API
"""

from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from app.database import create_db_and_tables
from app.routers.users import router as users_router
from app.routers.auth import router as auth_router
from app.routers.user_admin import router as user_admin_router

from app.routers.comics import router as comics_router
from app.routers.comic_upload import router as comic_upload_router
from app.routers.comic_author import router as comic_author_router
from app.routers.comic_admin import router as comic_admin_router

from app.routers.novels import router as novels_router
from app.routers.novel_admin import router as novel_admin_router
from app.routers.novel_author import router as novel_author_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    FastAPI 应用生命周期函数。

    可以理解为：

    后端启动时：
        执行 yield 前面的代码

    后端关闭时：
        执行 yield 后面的代码

    现在我们只需要在启动时创建数据库表。
    """

    # 后端启动时，自动创建数据库和数据表。
    #
    # 如果 backend/data/site.db 不存在，会自动生成。
    # 如果表不存在，会自动创建。
    # 如果表已经存在，不会重复创建。
    create_db_and_tables()

    # yield 表示应用正式开始运行。
    yield

    # 这里暂时没有关闭时要做的事。
    # 后面如果有清理任务，可以写在这里。


# 创建 FastAPI 应用。
app = FastAPI(
    title="Personal Site API",

    # 把上面定义的生命周期函数交给 FastAPI。
    lifespan=lifespan,
)

cors_allow_origins = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ALLOW_ORIGINS",
        "http://127.0.0.1:18000,http://localhost:18000",
    ).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = Path(__file__).resolve().parents[1]
UPLOADS_DIR = Path(os.getenv("UPLOADS_DIR", BASE_DIR / "uploads")).resolve()
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)


# 挂载静态文件目录。
#
# 以后浏览器访问：
#   /uploads/demo/demo-cover.jpg
#
# FastAPI 会去读取：
#   backend/uploads/demo/demo-cover.jpg
app.mount(
    "/uploads",
    StaticFiles(directory=UPLOADS_DIR),
    name="uploads",
)


# 挂载漫画 API。
#
# comics_router 里面已经有 prefix="/api/comics"，
# 所以最终接口路径是：
#   GET /api/comics
app.include_router(users_router)
app.include_router(auth_router)
app.include_router(user_admin_router)
app.include_router(comics_router)
app.include_router(comic_upload_router)
app.include_router(comic_author_router)
app.include_router(comic_admin_router)
app.include_router(novels_router)
app.include_router(novel_admin_router)
app.include_router(novel_author_router)

@app.get("/")
def root():
    """
    根路径测试接口。

    浏览器访问：

        http://127.0.0.1:8000/

    如果看到返回信息，就说明后端启动成功。
    """

    return {
        "message": "Personal site backend is running",
    }


@app.get("/health")
def health():
    """
    健康检查接口。

    浏览器访问：

        http://127.0.0.1:8000/health

    如果返回：

        {"status": "ok"}

    就说明后端服务正常。
    """

    return {
        "status": "ok",
    }
