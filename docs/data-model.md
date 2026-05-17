# Data Model

本文档描述当前代码中的真实数据模型。模型定义集中在：

```txt
backend/app/models.py
```

当前没有 `backend/app/models/` 目录。

## 模型层级

```txt
ComicSeries
└── ComicPart
    └── ComicChapter
        └── ComicPage
            └── Asset
```

其中：

- `ComicSeries` 表示一部漫画作品或一个漫画系列。
- `ComicPart` 表示系列下的部、卷、篇章、短篇集等。
- `ComicChapter` 表示分部下的一话、一章或一个短篇。
- `ComicPage` 表示章节中的单张漫画图片。
- `Asset` 表示实际上传资源，漫画页通过 `asset_id` 关联图片。

## 通用约定

内部数据库字段使用 snake_case。

API 返回给前端时，常见字段会转为 camelCase。

| 数据库字段 | API 字段 |
|---|---|
| `display_order` | `displayOrder` |
| `cover_asset_id` | `coverUrl` |
| `created_at` | `createdAt` |
| `updated_at` | `updatedAt` |
| `published_at` | `publishedAt` |

注意：

- 数据库中排序字段叫 `display_order`，不是 `order`。
- 前端路由优先使用 `slug`，不要直接依赖数据库 `id`。
- 公开 API 只返回 `visibility == "public"` 的内容。
- Admin tree 当前返回所有 series / part / chapter，不按 `visibility` 过滤。

## Asset

表名：

```txt
asset
```

模型：

```py
class Asset(SQLModel, table=True):
```

字段：

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | `str` | 主键，默认 `new_id()` |
| `filename` | `str` | 存储后的文件名 |
| `original_name` | `str` | 上传或导入时的原始文件名 |
| `mime_type` | `str` | 文件 MIME 类型 |
| `size` | `int` | 文件大小，单位 byte |
| `url` | `str` | 前端可访问路径 |
| `usage` | `str` | 资源用途，默认 `other` |
| `created_at` | `datetime` | 创建时间，默认 `now_utc()` |

当前漫画页导入时，`usage` 使用：

```txt
comic_page
```

模型注释中约定的 usage 值：

```txt
comic_cover
comic_page
post_image
project_image
other
```

## ComicSeries

表名：

```txt
comic_series
```

模型：

```py
class ComicSeries(SQLModel, table=True):
```

字段：

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | `str` | 主键，默认 `new_id()` |
| `slug` | `str` | 系列 URL 标识，唯一 |
| `title` | `str` | 系列标题 |
| `summary` | `str` | 系列简介，默认空字符串 |
| `cover_asset_id` | `Optional[str]` | 封面 Asset ID，可空 |
| `status` | `str` | 状态，默认 `planning` |
| `visibility` | `str` | 可见性，默认 `private` |
| `display_order` | `int` | 展示顺序，默认 `0` |
| `created_at` | `datetime` | 创建时间 |
| `updated_at` | `datetime` | 更新时间 |

当前 admin 导入创建 series 时，service 会设置：

```txt
status = "ongoing"
visibility = "public"
```

## ComicPart

表名：

```txt
comic_part
```

模型：

```py
class ComicPart(SQLModel, table=True):
```

唯一约束：

```txt
series_id + slug
```

字段：

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | `str` | 主键 |
| `series_id` | `str` | 所属 `comic_series.id` |
| `slug` | `str` | 分部 URL 标识 |
| `title` | `str` | 分部标题 |
| `summary` | `Optional[str]` | 分部简介 |
| `cover_asset_id` | `Optional[str]` | 分部封面 Asset ID，可空 |
| `status` | `str` | 状态，默认 `planning` |
| `visibility` | `str` | 可见性，默认 `private` |
| `display_order` | `int` | 在 series 中的展示顺序 |
| `created_at` | `datetime` | 创建时间 |
| `updated_at` | `datetime` | 更新时间 |

当前 admin 导入创建 part 时，service 会设置：

```txt
status = "ongoing"
visibility = "public"
```

## ComicChapter

表名：

```txt
comic_chapter
```

模型：

```py
class ComicChapter(SQLModel, table=True):
```

唯一约束：

```txt
part_id + slug
```

字段：

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | `str` | 主键 |
| `part_id` | `str` | 所属 `comic_part.id` |
| `slug` | `str` | 章节 URL 标识 |
| `title` | `str` | 章节标题 |
| `summary` | `Optional[str]` | 章节简介或备注 |
| `visibility` | `str` | 可见性，默认 `private` |
| `display_order` | `int` | 在 part 中的展示顺序 |
| `published_at` | `Optional[datetime]` | 发布时间，可空 |
| `created_at` | `datetime` | 创建时间 |
| `updated_at` | `datetime` | 更新时间 |

当前 admin 导入创建 chapter 时：

```txt
slug = chapter-{next_order:03d}
display_order = next_order
visibility = "public"
published_at = None
```

标题生成规则：

```txt
chapter_title 有值：第{next_order}话 {chapter_title}
chapter_title 无值：第{next_order}话
```

## ComicPage

表名：

```txt
comic_page
```

模型：

```py
class ComicPage(SQLModel, table=True):
```

唯一约束：

```txt
chapter_id + display_order
```

字段：

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | `str` | 主键 |
| `chapter_id` | `str` | 所属 `comic_chapter.id` |
| `asset_id` | `str` | 对应图片 `asset.id` |
| `display_order` | `int` | 在 chapter 中的页序 |
| `width` | `Optional[int]` | 图片宽度，当前可空 |
| `height` | `Optional[int]` | 图片高度，当前可空 |
| `created_at` | `datetime` | 创建时间 |
| `updated_at` | `datetime` | 更新时间 |

阅读顺序由 `ComicPage.display_order` 决定。

`Asset` 不承担漫画页序。
