"""
models.py

这个文件负责定义数据库表结构。

其中定义漫画模块需要的 5 张表：

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

from sqlalchemy import Column, Index, Text, UniqueConstraint
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

class SiteSetting(SQLModel, table=True):
    __tablename__ = "site_setting"

    key: str = Field(primary_key=True)
    value: str
    updated_at: datetime = Field(default_factory=now_utc)

class ActivityLog(SQLModel, table=True):
    """
    操作日志表。

    用于记录重要的业务写操作：
    谁在什么时间，对什么对象，做了什么，结果如何。

    注意：
    这不是访问统计表，不记录普通页面访问。
    """

    __tablename__ = "activity_log"

    id: str = Field(default_factory=new_id, primary_key=True)

    actor_user_id: str | None = Field(default=None, foreign_key="user.id", index=True)
    actor_username: str | None = Field(default=None, index=True)
    actor_display_name: str | None = None
    actor_role: str | None = Field(default=None, index=True)

    # 例如：
    # auth.login.success
    # comment.create
    # comment.delete.admin_hard
    action: str = Field(index=True)

    # 例如：
    # auth / user / comment / comic / novel / comic_upload / system
    category: str = Field(index=True)

    target_type: str | None = Field(default=None, index=True)
    target_id: str | None = Field(default=None, index=True)
    target_label: str | None = None

    # success / failed
    status: str = Field(default="success", index=True)

    message: str | None = None
    error_code: str | None = Field(default=None, index=True)

    # JSON 字符串。
    # SQLite 下先用 Text 最稳，避免额外引入复杂 JSON 兼容问题。
    metadata_json: str | None = Field(default=None, sa_column=Column(Text))

    ip_address: str | None = None
    user_agent: str | None = None

    created_at: datetime = Field(default_factory=now_utc, index=True)

class OutboxEvent(SQLModel, table=True):
    """
    业务事件 outbox 表。

    用于记录已经发生的业务事件，再由独立 processor 派生后续副作用。
    第一版不对普通用户暴露 API。
    """

    __tablename__ = "outbox_event"

    __table_args__ = (
        Index("ix_outbox_event_status_available_created", "status", "available_at", "created_at"),
        Index("ix_outbox_event_type_created", "event_type", "created_at"),
        Index("ix_outbox_event_aggregate", "aggregate_type", "aggregate_id"),
    )

    id: str = Field(default_factory=new_id, primary_key=True)

    # 例如：
    # comment.created
    event_type: str = Field(index=True)

    # 例如：
    # comment / novel / comic_chapter
    aggregate_type: str = Field(index=True)

    # 对应业务对象 id。
    aggregate_id: str = Field(index=True)

    actor_user_id: str | None = Field(default=None, foreign_key="user.id", index=True)

    # JSON 字符串。SQLite 下用 Text 最稳。
    payload_json: str = Field(default="{}", sa_column=Column(Text, nullable=False))

    event_version: int = Field(default=1)

    # pending / processing / processed / failed / dead
    status: str = Field(default="pending", index=True)

    retry_count: int = Field(default=0)
    max_retries: int = Field(default=3)

    available_at: datetime = Field(default_factory=now_utc, index=True)

    locked_at: datetime | None = Field(default=None, index=True)
    locked_by: str | None = Field(default=None, index=True)

    created_at: datetime = Field(default_factory=now_utc, index=True)
    processed_at: datetime | None = Field(default=None, index=True)

    last_error: str | None = Field(default=None, sa_column=Column(Text))
    last_error_at: datetime | None = Field(default=None, index=True)

    dedupe_key: str = Field(index=True, unique=True)

class Notification(SQLModel, table=True):
    """
    用户通知表。

    Notification 是由 OutboxEvent 派生出来的用户可见消息。
    普通用户只能访问自己的通知。
    """

    __tablename__ = "notification"

    __table_args__ = (
        Index("ix_notification_recipient_created", "recipient_user_id", "created_at"),
        Index("ix_notification_recipient_read_created", "recipient_user_id", "is_read", "created_at"),
    )

    id: str = Field(default_factory=new_id, primary_key=True)

    recipient_user_id: str = Field(foreign_key="user.id", index=True)

    actor_user_id: str | None = Field(default=None, foreign_key="user.id", index=True)
    actor_username: str | None = Field(default=None, index=True)
    actor_display_name: str | None = None

    # 例如：
    # comment.reply
    # comment.user_page
    type: str = Field(index=True)

    title: str
    body: str = ""

    target_type: str | None = Field(default=None, index=True)
    target_id: str | None = Field(default=None, index=True)
    target_url: str | None = None

    is_read: bool = Field(default=False, index=True)

    created_at: datetime = Field(default_factory=now_utc, index=True)
    read_at: datetime | None = Field(default=None, index=True)

    # JSON 字符串。不要保存完整正文、密码、token。
    metadata_json: str | None = Field(default=None, sa_column=Column(Text))

    dedupe_key: str = Field(index=True, unique=True)

class Comment(SQLModel, table=True):
    """
    通用评论表。

    一条 Comment 可以挂在不同类型的目标对象下面，例如：

    1. user_page      用户个人页留言
    2. novel          小说详情页评论
    3. novel_chapter  小说章节底部小评
    4. comic_part     未来漫画分部评论
    5. comic_chapter  未来漫画章节评论

    具体挂载目标由 target_type + target_id 决定。
    """

    __tablename__ = "comment"

    __table_args__ = (
        Index("ix_comment_target", "target_type", "target_id"),
    )

    id: str = Field(default_factory=new_id, primary_key=True)

    # 评论挂载目标类型。
    #
    # 第一版建议只开放：
    # user_page / novel / novel_chapter
    #
    # 后续可以扩展到：
    # comic_part / comic_chapter
    target_type: str = Field(index=True)

    # 评论挂载目标 ID。
    #
    # 例如：
    # target_type = "user_page" 时，这里存被留言用户的 user.id
    # target_type = "novel" 时，这里存 novel.id
    # target_type = "novel_chapter" 时，这里存 novel_chapter.id
    target_id: str = Field(index=True)

    # 发表评论的用户。
    #
    # 第一版建议要求登录后才能评论，因此这里设为必填。
    user_id: str = Field(foreign_key="user.id", index=True)

    # 评论正文。
    #
    # 长度限制建议放在 service/router 层校验；
    # 数据库层用 Text，避免 SQLite 下字符串长度约束不可靠。
    content: str = Field(sa_column=Column(Text, nullable=False))

    # 回复关系。
    #
    # 第一版前端可以先不用，只显示一级评论。
    # 先加这个字段，后面要做回复时不用再改表。
    parent_id: str | None = Field(default=None, foreign_key="comment.id", index=True)
    # 实际回复目标。
    #
    # parent_id 用来把回复归到同一个一级评论下面；
    # reply_to_id 用来记录用户真正点击回复的是哪一条评论。
    #
    # 例如：
    # A 是一级评论
    # B 回复 A：parent_id=A.id, reply_to_id=A.id
    # C 回复 B：parent_id=A.id, reply_to_id=B.id
    reply_to_id: str | None = Field(default=None, foreign_key="comment.id", index=True)

    # 软删除。
    #
    # 删除评论时不物理删除记录，而是标记为 deleted。
    # 这样以后如果有回复结构，不会因为父评论消失导致结构断裂。
    is_deleted: bool = Field(default=False, index=True)

    created_at: datetime = Field(default_factory=now_utc)
    updated_at: datetime = Field(default_factory=now_utc)

class CommentImage(SQLModel, table=True):
    """
    评论图片关系表。

    图片文件本身仍然存 Asset 表。
    这里仅记录某条评论关联了哪些图片，以及图片显示顺序。

    第一版规则：
    1. 只有父级评论可以带图片；
    2. 一条父级评论最多 9 张图片；
    3. 软删除评论时不删除这里的记录；
    4. 硬删除评论时需要同步删除这里的记录、对应 Asset 和磁盘文件。
    """

    __tablename__ = "comment_image"

    __table_args__ = (
        UniqueConstraint("comment_id", "display_order", name="uq_comment_image_order"),
    )

    id: str = Field(default_factory=new_id, primary_key=True)

    comment_id: str = Field(foreign_key="comment.id", index=True)
    asset_id: str = Field(foreign_key="asset.id", index=True)

    display_order: int = Field(default=0, index=True)

    created_at: datetime = Field(default_factory=now_utc)

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

class ComicPartFavorite(SQLModel, table=True):
    __tablename__ = "comic_part_favorite"

    __table_args__ = (
        UniqueConstraint("part_id", "user_id", name="uq_comic_part_favorite"),
        Index("ix_comic_part_favorite_user_created", "user_id", "created_at"),
        Index("ix_comic_part_favorite_part_created", "part_id", "created_at"),
    )

    id: str = Field(default_factory=new_id, primary_key=True)

    part_id: str = Field(index=True, foreign_key="comic_part.id")
    user_id: str = Field(index=True, foreign_key="user.id")

    created_at: datetime = Field(default_factory=now_utc)

class ComicUploadImage(SQLModel, table=True):
    id: str = Field(default_factory=new_id, primary_key=True)

    user_id: str = Field(foreign_key="user.id", index=True)

    # 当前待传区归属。
    # 仍然只有一个 user 级 uploads，但用这些字段标记它当前属于哪个 part/chapter 操作。
    target_part_id: str | None = Field(default=None, foreign_key="comic_part.id", index=True)
    target_chapter_id: str | None = Field(default=None, foreign_key="comic_chapter.id", index=True)
    upload_mode: str = Field(default="new_chapter", index=True)

    original_filename: str
    stored_filename: str
    storage_path: str

    content_type: str | None = None
    size_bytes: int

    display_order: int = 0

    created_at: datetime = Field(default_factory=now_utc)
    updated_at: datetime = Field(default_factory=now_utc)

class ComicUploadJob(SQLModel, table=True):
    """
    漫画待传区后台任务表。

    第一版用于 PDF 导入任务：
    1. 保存 source.pdf；
    2. 后台逐页拆成 PNG；
    3. 拆出的页面写入 ComicUploadImage；
    4. 前端轮询本表状态；
    5. 取消/失败时只回滚本 job 创建的图片。
    """

    __tablename__ = "comic_upload_job"

    __table_args__ = (
        Index("ix_comic_upload_job_user_status_created", "user_id", "status", "created_at"),
    )

    id: str = Field(default_factory=new_id, primary_key=True)

    user_id: str = Field(foreign_key="user.id", index=True)

    # 第一版固定为 pdf_import，后续如果有压缩包导入、批量处理等任务，可以继续复用。
    kind: str = Field(default="pdf_import", index=True)

    # queued / running / done / failed / canceling / canceled
    status: str = Field(default="queued", index=True)

    original_filename: str

    # 相对 IMPORT_DATA_ROOT 的路径。
    # 例如：users/{user_id}/comic-upload-jobs/{job_id}/source.pdf
    source_path: str

    total_pages: int | None = Field(default=None)
    processed_pages: int = Field(default=0)
    progress: int = Field(default=0)

    message: str | None = None
    error_message: str | None = Field(default=None, sa_column=Column(Text))

    target_part_id: str | None = Field(default=None, foreign_key="comic_part.id", index=True)

    # 第一版固定 new_chapter。PDF 不支持 edit_chapter。
    upload_mode: str = Field(default="new_chapter", index=True)

    # JSON 字符串，记录本 job 已创建的 ComicUploadImage.id。
    # 取消/失败时只删除这些图片，不清空整个待传区。
    created_image_ids_json: str | None = Field(default=None, sa_column=Column(Text))

    created_size_bytes: int = Field(default=0)

    created_at: datetime = Field(default_factory=now_utc, index=True)
    updated_at: datetime = Field(default_factory=now_utc, index=True)

    started_at: datetime | None = Field(default=None, index=True)
    finished_at: datetime | None = Field(default=None, index=True)
    canceled_at: datetime | None = Field(default=None, index=True)

class Novel(SQLModel, table=True):
    __tablename__ = "novel"

    id: str = Field(default_factory=new_id, primary_key=True)

    slug: str = Field(index=True, unique=True)
    title: str
    summary: str = ""

    cover_asset_id: Optional[str] = Field(default=None, foreign_key="asset.id")

    display_order: int = Field(default=0, index=True)

    created_at: datetime = Field(default_factory=now_utc)
    updated_at: datetime = Field(default_factory=now_utc)


class NovelChapter(SQLModel, table=True):
    __tablename__ = "novel_chapter"

    __table_args__ = (
        UniqueConstraint("novel_id", "slug", name="uq_novel_chapter_novel_slug"),
    )

    id: str = Field(default_factory=new_id, primary_key=True)

    novel_id: str = Field(foreign_key="novel.id", index=True)

    slug: str = Field(index=True)
    title: str

    content: str = Field(default="", sa_column=Column(Text, nullable=False))

    display_order: int = Field(default=0, index=True)

    created_at: datetime = Field(default_factory=now_utc)
    updated_at: datetime = Field(default_factory=now_utc)

class NovelChapterImage(SQLModel, table=True):
    """
    小说章节正文图片关系表。

    图片文件本身仍然存 Asset 表。
    这里仅记录某个 novel chapter 关联了哪些正文图片，以及显示顺序。

    第一版规则：
    1. 只支持已有 chapter 上传图片；
    2. 每个 chapter 最多 20 张图片；
    3. 图片通过 Markdown 链接插入正文；
    4. 删除图片时同步删除这里的记录、对应 Asset 和磁盘文件。
    """

    __tablename__ = "novel_chapter_image"

    __table_args__ = (
        UniqueConstraint("chapter_id", "display_order", name="uq_novel_chapter_image_order"),
    )

    id: str = Field(default_factory=new_id, primary_key=True)

    chapter_id: str = Field(foreign_key="novel_chapter.id", index=True)
    asset_id: str = Field(foreign_key="asset.id", index=True)

    display_order: int = Field(default=0, index=True)

    created_at: datetime = Field(default_factory=now_utc)

class NovelUserLink(SQLModel, table=True):
    __tablename__ = "novel_user_link"

    __table_args__ = (
        UniqueConstraint("novel_id", "user_id", name="uq_novel_user"),
    )

    id: str = Field(default_factory=new_id, primary_key=True)

    novel_id: str = Field(index=True, foreign_key="novel.id")
    user_id: str = Field(index=True, foreign_key="user.id")

    role: str = "owner"

    created_at: datetime = Field(default_factory=now_utc)

class NovelFavorite(SQLModel, table=True):
    __tablename__ = "novel_favorite"

    __table_args__ = (
        UniqueConstraint("novel_id", "user_id", name="uq_novel_favorite"),
        Index("ix_novel_favorite_user_created", "user_id", "created_at"),
        Index("ix_novel_favorite_novel_created", "novel_id", "created_at"),
    )

    id: str = Field(default_factory=new_id, primary_key=True)

    novel_id: str = Field(index=True, foreign_key="novel.id")
    user_id: str = Field(index=True, foreign_key="user.id")

    created_at: datetime = Field(default_factory=now_utc)

class NovelTextBuffer(SQLModel, table=True):
    __tablename__ = "novel_text_buffer"

    id: str = Field(default_factory=new_id, primary_key=True)

    user_id: str = Field(foreign_key="user.id", index=True)

    novel_id: str = Field(foreign_key="novel.id", index=True)

    # 编辑已有章节时有 chapter_id
    # 新建章节正文缓冲时可以为空
    chapter_id: str | None = Field(default=None, foreign_key="novel_chapter.id", index=True)

    # markdown / plain_text
    content_type: str = Field(default="markdown", index=True)

    # 缓冲区正文
    content: str = Field(default="", sa_column=Column(Text, nullable=False))

    created_at: datetime = Field(default_factory=now_utc)
    updated_at: datetime = Field(default_factory=now_utc)
