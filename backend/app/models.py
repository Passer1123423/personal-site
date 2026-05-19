"""
models.py

这个文件负责定义数据库表结构。

当前阶段只定义漫画模块需要的 5 张表：

1. Asset
   上传资源表。存图片、封面等文件信息。

2. ComicSeries
   漫画系列表。对应一部漫画作品的整体条目。

3. ComicPart
   漫画分部表。对应第一部、第二部、番外篇、短篇集等。

4. ComicChapter
   漫画章节表。对应第 1 话、第 2 话、番外 1 等。

5. ComicPage
   漫画页表。对应章节中的一张张漫画图片。

它们之间的关系是：

ComicSeries
└── ComicPart
    └── ComicChapter
        └── ComicPage
            └── Asset
"""

from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

from sqlalchemy import UniqueConstraint
from sqlmodel import Field, SQLModel


def new_id() -> str:
    """
    生成一个新的唯一 ID。

    这里使用 uuid4。

    例如可能生成：

        "2c61c08b-3954-40fd-9b3a-15c4319e22cd"

    这个 id 主要给数据库内部使用，
    前端路由不要直接依赖这个 id。

    前端路由应该优先使用 slug。
    """

    return str(uuid4())


def now_utc() -> datetime:
    """
    生成当前 UTC 时间。

    created_at 和 updated_at 会用到。

    这里先统一存 UTC 时间，
    后续前端展示时再按需要转成本地时间。
    """

    return datetime.now(timezone.utc)


class Asset(SQLModel, table=True):
    """
    上传资源表。

    Asset 用来统一管理图片文件。

    当前阶段主要用于：

    1. 漫画封面
    2. 漫画页面图片

    后面也可以扩展到：

    1. 随笔插图
    2. 项目截图
    3. 其他上传文件
    """

    # 指定数据库中的表名。
    __tablename__ = "asset"

    # 主键 ID。
    #
    # default_factory=new_id 表示：
    # 每次新增一条数据时，自动调用 new_id() 生成 ID。
    id: str = Field(default_factory=new_id, primary_key=True)

    # 文件存储后的名称。
    #
    # 例如用户上传：
    #   cover.png
    #
    # 后端为了避免重名，可能实际保存成：
    #   2c61c08b-cover.png
    filename: str

    # 用户上传时的原始文件名。
    #
    # 例如：
    #   cover.png
    original_name: str

    # 文件类型。
    #
    # 例如：
    #   image/png
    #   image/jpeg
    mime_type: str

    # 文件大小，单位一般用 byte。
    size: int

    # 前端可以访问到这个文件的地址。
    #
    # 例如：
    #   /uploads/comics/page-001.png
    url: str

    # 文件用途。
    #
    # 目前建议用这些值：
    #
    # comic_cover   漫画封面
    # comic_page    漫画页
    # post_image    文章图片
    # project_image 项目图片
    # other         其他
    usage: str = Field(default="other", index=True)

    # 上传时间。
    created_at: datetime = Field(default_factory=now_utc)

class User(SQLModel, table=True):
    id: str = Field(default_factory=new_id, primary_key=True)

    username: str = Field(index=True, unique=True)
    display_name: str | None = Field(default=None)

    password_hash: str

    role: str = "reader"
    is_active: bool = True

    avatar_asset_id: str | None = Field(default=None, foreign_key="asset.id")
    bio: str = ""

    created_at: datetime = Field(default_factory=now_utc)
    updated_at: datetime = Field(default_factory=now_utc)

class ComicSeries(SQLModel, table=True):
    """
    漫画系列表。

    一个 ComicSeries 对应一部漫画作品的整体条目。

    例如：

    1. 某部长篇漫画
    2. 某个短篇漫画集
    3. 某个世界观下的主线漫画

    一个系列下面可以有多个 ComicPart。
    """

    __tablename__ = "comic_series"

    id: str = Field(default_factory=new_id, primary_key=True)

    # slug 是给 URL 用的可读标识。
    #
    # 例如：
    #   title: 我的漫画
    #   slug: my-comic
    #
    # 那么前端路由可以是：
    #   /comics/my-comic
    #
    # unique=True 表示每个漫画系列的 slug 不能重复。
    slug: str = Field(index=True, unique=True)

    # 漫画系列标题。
    title: str

    # 漫画系列简介。
    #
    # 这里给默认空字符串，
    # 方便一开始只建标题，不急着写简介。
    summary: str = ""

    # 封面图片资源 ID。
    #
    # 它关联 Asset 表中的 id。
    #
    # Optional[str] 表示可以为空。
    # 因为一开始创建漫画条目时，可能还没有上传封面。
    cover_asset_id: Optional[str] = Field(default=None, foreign_key="asset.id")

    # 系列状态。
    #
    # 建议使用文档中约定的英文枚举：
    #
    # draft      草稿
    # planning   筹备中
    # ongoing    连载中
    # finished   已完结
    # paused     暂停更新
    status: str = Field(default="planning", index=True)

    # 可见性。
    #
    # public   公开，前台页面可见
    # private  私有，仅后台可见
    visibility: str = Field(default="private", index=True)

    # 显示顺序。
    #
    # 文档中叫 order。
    #
    # 但 order 在 SQL 里容易和 ORDER BY 关键字混淆，
    # 所以数据库字段这里写成 display_order。
    display_order: int = Field(default=0, index=True)

    # 创建时间。
    created_at: datetime = Field(default_factory=now_utc)

    # 更新时间。
    #
    # 注意：
    # 这里只是创建时给一个默认值。
    # 后面真正写“修改接口”时，需要手动更新这个字段。
    updated_at: datetime = Field(default_factory=now_utc)


class ComicPart(SQLModel, table=True):
    """
    漫画分部表。

    一个 ComicPart 表示某个系列下面的一个“部”“卷”“篇章”或“短篇集”。

    例如：

    1. 第一部
    2. 第二部
    3. 番外篇
    4. 短篇集
    5. 设定集

    一个 ComicSeries 可以包含多个 ComicPart。
    """

    __tablename__ = "comic_part"

    # 联合唯一约束。
    #
    # 含义：
    # 同一个漫画系列下面，part 的 slug 不能重复。
    #
    # 例如：
    #
    # 系列 A 下面不能同时有两个：
    #   slug = "part-1"
    #
    # 但是系列 A 和系列 B 可以各自都有：
    #   slug = "part-1"
    __table_args__ = (
        UniqueConstraint("series_id", "slug", name="uq_comic_part_series_slug"),
    )

    id: str = Field(default_factory=new_id, primary_key=True)

    # 所属漫画系列 ID。
    #
    # foreign_key="comic_series.id" 表示：
    # 这个字段关联 comic_series 表的 id 字段。
    series_id: str = Field(foreign_key="comic_series.id", index=True)

    # 分部 slug。
    #
    # 例如：
    #   part-1
    #   extra
    #   short-stories
    slug: str = Field(index=True)

    # 分部标题。
    title: str

    # 分部简介。
    #
    # Optional[str] 表示可以为空。
    summary: Optional[str] = None

    # 分部封面图片资源 ID。
    #
    # 它关联 Asset 表中的 id。
    #
    # Optional[str] 表示可以为空。
    # 因为有些分部可以暂时没有单独封面。
    cover_asset_id: Optional[str] = Field(default=None, foreign_key="asset.id")

    # 分部状态。
    #
    # 可以和系列状态不同。
    # 例如系列是 ongoing，但第二部仍然是 planning。
    status: str = Field(default="planning", index=True)

    # 分部可见性。
    visibility: str = Field(default="private", index=True)

    # 该分部在所属系列中的显示顺序。
    display_order: int = Field(default=0, index=True)

    created_at: datetime = Field(default_factory=now_utc)
    updated_at: datetime = Field(default_factory=now_utc)


class ComicChapter(SQLModel, table=True):
    """
    漫画章节表。

    一个 ComicChapter 表示某个分部下面的一话、一章或一个短篇。

    例如：

    1. 第 1 话
    2. 第 2 话
    3. 番外 1
    4. 角色设定 01

    一个 ComicPart 可以包含多个 ComicChapter。
    """

    __tablename__ = "comic_chapter"

    # 同一个分部下面，章节 slug 不能重复。
    #
    # 例如同一个分部下不能有两个：
    #   chapter-1
    #
    # 但不同分部可以各自有自己的 chapter-1。
    __table_args__ = (
        UniqueConstraint("part_id", "slug", name="uq_comic_chapter_part_slug"),
    )

    id: str = Field(default_factory=new_id, primary_key=True)

    # 所属分部 ID。
    part_id: str = Field(foreign_key="comic_part.id", index=True)

    # 章节 slug。
    #
    # 例如：
    #   chapter-1
    #   chapter-2
    #   extra-1
    slug: str = Field(index=True)

    # 章节标题。
    title: str

    # 章节简介或备注。
    summary: Optional[str] = None

    # 章节可见性。
    #
    # 公开页面只展示 public 章节。
    visibility: str = Field(default="private", index=True)

    # 该章节在所属分部中的显示顺序。
    display_order: int = Field(default=0, index=True)

    # 发布时间。
    #
    # 可以为空。
    #
    # 如果为空，可以表示：
    # 1. 尚未发布
    # 2. 只是草稿
    # 3. 暂时不需要显示发布时间
    published_at: Optional[datetime] = None

    created_at: datetime = Field(default_factory=now_utc)
    updated_at: datetime = Field(default_factory=now_utc)


class ComicPage(SQLModel, table=True):
    """
    漫画页表。

    一个 ComicPage 对应一个章节中的一张漫画图片。

    一个章节通常有多张 ComicPage。

    阅读页会按照 display_order 从小到大显示这些图片。
    """

    __tablename__ = "comic_page"

    # 同一个章节中，页面顺序不能重复。
    #
    # 例如同一章里不能同时有两张图片都是第 1 页。
    __table_args__ = (
        UniqueConstraint("chapter_id", "display_order", name="uq_comic_page_order"),
    )

    id: str = Field(default_factory=new_id, primary_key=True)

    # 所属章节 ID。
    chapter_id: str = Field(foreign_key="comic_chapter.id", index=True)

    # 关联的图片资源 ID。
    #
    # 真正的图片信息存在 Asset 表中。
    # ComicPage 不直接保存图片路径，而是通过 asset_id 找到 Asset。
    asset_id: str = Field(foreign_key="asset.id", index=True)

    # 页面顺序。
    #
    # 阅读页按照这个字段排序。
    display_order: int = Field(default=0, index=True)

    # 图片宽度。
    #
    # 可以为空。
    # 后面如果上传时能自动读取图片尺寸，就可以填。
    width: Optional[int] = None

    # 图片高度。
    height: Optional[int] = None

    created_at: datetime = Field(default_factory=now_utc)
    updated_at: datetime = Field(default_factory=now_utc)

class ComicPartUserLink(SQLModel, table=True):
    __tablename__ = "comic_part_user_link"

    __table_args__ = (
        UniqueConstraint("part_id", "user_id", name="uq_comic_part_user"),
    )

    id: str = Field(default_factory=new_id, primary_key=True)

    part_id: str = Field(index=True, foreign_key="comic_part.id")
    user_id: str = Field(index=True, foreign_key="user.id")

    role: str = "owner"

    created_at: datetime = Field(default_factory=now_utc)

class ComicUploadImage(SQLModel, table=True):
    id: str = Field(default_factory=new_id, primary_key=True)

    user_id: str = Field(foreign_key="user.id", index=True)

    original_filename: str
    stored_filename: str
    storage_path: str

    content_type: str | None = None
    size_bytes: int

    display_order: int = 0

    created_at: datetime = Field(default_factory=now_utc)
    updated_at: datetime = Field(default_factory=now_utc)