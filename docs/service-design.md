# Service Design

本文档描述当前 `backend/app/services/comic_admin.py` 的真实职责和函数签名。

`comic_admin.py` 是漫画后台内容管理的核心 service。router 和 scripts 应调用这里的函数，避免重复实现数据库和文件操作。

## 文件级常量

```py
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
UPLOADS_ROOT = Path("uploads/comics")
```

注意：

- service 中的 `UPLOADS_ROOT` 是相对路径。
- API 上传流程最终会复制到 `uploads/comics/...`。
- FastAPI 在 `main.py` 中挂载的是 `backend/uploads` 到 `/uploads`。

## 文件识别函数

### guess_mime_type

```py
def guess_mime_type(path: Path) -> str:
```

根据文件后缀返回 MIME 类型。

支持：

```txt
.jpg / .jpeg -> image/jpeg
.png         -> image/png
.webp        -> image/webp
.gif         -> image/gif
其他         -> application/octet-stream
```

### list_image_files

```py
def list_image_files(source_dir: Path) -> list[Path]:
```

必填参数：

```txt
source_dir
```

行为：

- 检查目录是否存在。
- 只保留文件。
- 跳过名称包含 `:Zone.Identifier` 的文件。
- 只保留 `IMAGE_EXTENSIONS` 中的图片。
- 按 `path.stat().st_mtime` 排序。
- 没有图片时抛 `ValueError`。

## 只查询函数

### get_series

```py
def get_series(
    session: Session,
    series: ComicSeries | None = None,
    series_id: str | None = None,
    series_slug: str | None = None,
) -> ComicSeries:
```

必填：

```txt
session
```

定位方式至少提供一种：

```txt
series
series_id
series_slug
```

优先级：

```txt
series -> series_id -> series_slug
```

未找到时抛 `ValueError`。

### get_part

```py
def get_part(
    session: Session,
    part: ComicPart | None = None,
    part_id: str | None = None,
    series: ComicSeries | None = None,
    series_id: str | None = None,
    series_slug: str | None = None,
    part_slug: str | None = None,
) -> ComicPart:
```

必填：

```txt
session
```

定位方式：

- 如果传入 `part`，直接返回。
- 如果传入 `part_id` 且找到，直接返回。
- 否则必须提供 `part_slug`，并能通过 `series` / `series_id` / `series_slug` 定位所属 series。

未找到时抛 `ValueError`。

### get_chapter

```py
def get_chapter(
    session: Session,
    chapter: ComicChapter | None = None,
    chapter_id: str | None = None,
    series: ComicSeries | None = None,
    series_id: str | None = None,
    series_slug: str | None = None,
    part: ComicPart | None = None,
    part_id: str | None = None,
    part_slug: str | None = None,
    chapter_slug: str | None = None,
) -> ComicChapter:
```

必填：

```txt
session
```

定位方式：

- 如果传入 `chapter_id` 并查到，返回对应 chapter。
- 如果传入 `chapter`，直接返回。
- 否则必须提供 `chapter_slug`，并能定位到 series 和 part。

未找到时抛 `ValueError`。

### get_pages

```py
def get_pages(
    session: Session,
    chapter: ComicChapter,
) -> list[ComicPage]:
```

必填：

```txt
session
chapter
```

返回 chapter 下的 pages。未找到 pages 时抛 `ValueError`。

## 获取或创建函数

### get_or_create_series

```py
def get_or_create_series(
    session: Session,
    series_slug: str,
    series_title: str | None,
    series_summary: str | None,
    display_order: int | None = None,
) -> ComicSeries:
```

必填：

```txt
session
series_slug
```

代码层面 `series_title`、`series_summary` 没有默认值，但可以传 `None`。

行为：

- 如果 `series_slug` 已存在，直接返回已有 series。
- 不会更新已有 series 的 title / summary / display_order。
- 新建时 `series_title` 为空则使用 `"未命名系列"`。
- `display_order` 为空时取当前最大 `ComicSeries.display_order + 1`，没有数据时为 `0`。
- 新建 series 时设置 `status="ongoing"`、`visibility="public"`。

### get_or_create_part

```py
def get_or_create_part(
    session: Session,
    series: ComicSeries,
    part_slug: str,
    part_title: str | None,
    part_summary: str | None,
    display_order: int | None = None,
) -> ComicPart:
```

必填：

```txt
session
series
part_slug
```

代码层面 `part_title`、`part_summary` 没有默认值，但可以传 `None`。

行为：

- 在同一 series 下查找 `part_slug`。
- 已存在则直接返回，不更新已有 part。
- `display_order` 为空时取该 series 下最大 `ComicPart.display_order + 1`，没有数据时为 `0`。
- 新建 title：
  - `part_title` 有值：`第{display_order + 1}章 {part_title}`
  - `part_title` 无值：`第{display_order + 1}章`
- 新建 part 时设置 `status="ongoing"`、`visibility="public"`。

注意当前代码中查询最大 part 顺序的条件写法是：

```py
.where(ComicPart.series_id == series)
```

这与字段类型不完全匹配，后续维护时应先核对实际运行表现。

### create_next_chapter

```py
def create_next_chapter(
    session: Session,
    part: ComicPart,
    chapter_title: str | None,
) -> ComicChapter:
```

必填：

```txt
session
part
```

`chapter_title` 可以传 `None`。

行为：

- 查询当前 part 下已有 chapters。
- `next_order = len(existing_chapters) + 1`
- `chapter_slug = f"chapter-{next_order:03d}"`
- `display_order = next_order`
- `visibility = "public"`
- `published_at = None`

标题规则：

```txt
chapter_title 有值：第{next_order}话 {chapter_title}
chapter_title 无值：第{next_order}话
```

## 导入章节函数

### copy_image_to_uploads

```py
def copy_image_to_uploads(
    source_path: Path,
    series_slug: str,
    part_slug: str,
    chapter_slug: str,
    display_order: int,
    upload_root: Path,
) -> tuple[Path, str]:
```

必填参数全部必填。

复制目标：

```txt
{upload_root}/{series_slug}/{part_slug}/{chapter_slug}/{display_order:03d}{suffix}
```

返回：

```txt
target_path
asset_url
```

`asset_url` 格式：

```txt
/uploads/comics/{series_slug}/{part_slug}/{chapter_slug}/{filename}
```

### create_asset

```py
def create_asset(session: Session, asset_url: str, source_path: Path) -> Asset:
```

必填：

```txt
session
asset_url
source_path
```

创建 `Asset`，其中：

```txt
filename = Path(asset_url).name
original_name = source_path.name
mime_type = guess_mime_type(source_path)
size = source_path.stat().st_size
url = asset_url
usage = "comic_page"
```

### create_comic_page

```py
def create_comic_page(
    session: Session,
    chapter: ComicChapter,
    asset: Asset,
    display_order: int,
) -> ComicPage:
```

必填参数全部必填。

创建 `ComicPage`，其中：

```txt
chapter_id = chapter.id
asset_id = asset.id
display_order = display_order
width = None
height = None
```

### import_comic_chapter_from_dir

```py
def import_comic_chapter_from_dir(
    session: Session,
    source_dir: Path,
    series_slug: str,
    part_slug: str,
    series_title: str | None = None,
    series_summary: str | None = None,
    part_title: str | None = None,
    part_summary: str | None = None,
    chapter_title: str | None = None,
    uploads_root: Path | None = UPLOADS_ROOT,
    series_display_order: int | None = None,
    part_display_order: int | None = None,
):
```

必填：

```txt
session
source_dir
series_slug
part_slug
```

可选：

```txt
series_title
series_summary
part_title
part_summary
chapter_title
uploads_root
series_display_order
part_display_order
```

调用链：

```txt
list_image_files(source_dir)
-> get_or_create_series(...)
-> get_or_create_part(...)
-> create_next_chapter(...)
-> for each image:
     copy_image_to_uploads(...)
     create_asset(...)
     create_comic_page(...)
```

返回 dict：

```txt
series
part
chapter
pages
page_count
```

## 删除函数

### delete_chapter_files

```py
def delete_chapter_files(
    series_slug: str,
    part_slug: str,
    chapter_slug: str,
):
```

删除目录：

```txt
UPLOADS_ROOT / series_slug / part_slug / chapter_slug
```

### reorder_chapters

```py
def reorder_chapters(session: Session, part_id: str):
```

行为：

- 查询同一 part 下所有 chapters，按 `display_order` 排序。
- 从 1 开始重写 `display_order`。
- 用正则把标题中的 `第\d+话` 替换为新的话数。

### delete_chapter

```py
def delete_chapter(
    session: Session,
    series_slug: str,
    part_slug: str,
    chapter_slug: str,
):
```

必填参数全部必填。

调用链：

```txt
get_chapter(...)
-> 查询 ComicPage
-> 收集 asset_id
-> delete_chapter_files(...)
-> 删除 ComicPage
-> 删除 Asset
-> 删除 ComicChapter
-> reorder_chapters(part_id)
```

### delete_part

```py
def delete_part(
    session: Session,
    series_slug: str,
    part_slug: str,
):
```

调用链：

```txt
get_part(...)
-> 查询该 part 下所有 ComicChapter
-> 对每个 chapter 调 delete_chapter(...)
-> 如有 part.cover_asset_id，删除对应 Asset
-> 删除 ComicPart
```

### delete_series

```py
def delete_series(
    session: Session,
    series_slug: str,
):
```

调用链：

```txt
get_series(...)
-> 查询该 series 下所有 ComicPart
-> 对每个 part 调 delete_part(...)
-> 如有 series.cover_asset_id，删除对应 Asset
-> 删除 ComicSeries
```

## 顺序函数

### update_chapter_order_title

```py
def update_chapter_order_title(title: str, new_order: int) -> str:
```

用正则替换标题开头的：

```txt
第 N 话
```

为：

```txt
第{new_order}话
```

### shift_chapter

```py
def shift_chapter(
    session: Session,
    series_slug: str,
    part_slug: str,
    chapter_slug: str,
    direction: str,
):
```

必填参数全部必填。

`direction` 允许：

```txt
up
down
```

行为：

- 通过 slug 定位 chapter。
- `up` 时目标顺序为当前 `display_order - 1`。
- `down` 时目标顺序为当前 `display_order + 1`。
- 查找同一 part 下目标顺序的 chapter。
- 找不到目标时返回 `moved: False`。
- 找到目标时交换两个 chapter 的 `display_order`。
- 同步更新两个 chapter 标题中的话数。

返回成功结构：

```txt
moved
chapterSlug
displayOrder
targetChapterSlug
targetDisplayOrder
```

### shift_chapter_up / shift_chapter_down

```py
def shift_chapter_up(...)
def shift_chapter_down(...)
```

这两个函数只是 `shift_chapter(..., direction="up/down")` 的薄封装。当前 router 直接调用 `shift_chapter()`。
