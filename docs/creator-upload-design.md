# 创作者漫画上传系统设计锚定

本文用于锚定后续“非 admin 用户上传 / 创作者上传”相关设计。后续实现应优先遵守本文边界，不要把 admin 后台逻辑、正式漫画导入逻辑、用户缓存区逻辑混在一起。

## 1. 总体目标

创作者上传系统不是 admin 后台的复制版，而是面向作者的作品发布入口。

第一阶段目标是：

1. 作者进入创作者入口后，可以浏览全站 series。
2. 作者进入某个 series 后，只看到自己拥有 owner 权限的 part。
3. 作者进入某个 part 后，可以管理该 part 下的 chapter。
4. 作者点击“上传新章节”后，右侧拉出缓存区，用于上传、预览、删除、排序图片。
5. 最终发布 chapter 时，才把缓存区图片按用户指定顺序录入正式漫画结构。

## 2. 数据归属规则

### 2.1 Series

series 不归属任何用户。

创作者入口第一层展示全站所有 series。series 更像合集、书架或文件夹，不承担作者归属关系。

### 2.2 Part

part 才是作品归属的核心单位。

part owner 通过 `ComicPartUserLink` 表维护：

- `part_id`
- `user_id`
- `role = "owner"`

owner 的角色规则是“至少是 author”，即：

- author 可以作为 owner
- admin 也可以作为 owner
- reader 不能作为 owner

不要把规则改成“只能 author”。

### 2.3 Chapter

chapter 属于 part。

作者只有在当前用户是目标 part 的 owner 时，才可以管理该 part 下的 chapter，包括：

- 上传新 chapter
- 修改 chapter 名称
- 调整 chapter 顺序
- 删除 chapter

## 3. 权限判断原则

### 3.1 不单独使用 require_author_user 作为核心权限

用户上传系统的核心权限不是简单判断 role 是否为 author，而是判断当前用户是否是目标 part 的 owner。

路由中可以先使用：

```py
current_user: User = Depends(require_current_user)
```

然后在进入 part 或发布 chapter 时判断：

```py
owner = get_part_owner(session=session, part=part)

if owner is None:
    raise HTTPException(status_code=403, detail="该作品分部尚未设置 owner")

if owner.id != current_user.id:
    raise HTTPException(status_code=403, detail="你不是该作品分部的 owner")
```

### 3.2 判断单个 part 权限时不要反向拉全量列表

判断当前用户是否是某个 part 的 owner 时，优先使用已有：

```py
get_part_owner(session, part)
```

不要为了判断一个 part 权限而调用 `get_owner_part` 把用户拥有的所有 part 都查出来。

### 3.3 get_owner_part 的用途

`get_owner_part` 或后续更名为 `get_owner_parts`，适合用于前端列表展示：

- 进入某个 series 后，筛选当前用户在该 series 下拥有的 part。
- 构建“我的 part 书架”。

它不用于单次发布权限判断。

推荐返回类型：

```py
def get_owner_part(
    session: Session,
    user: User,
) -> list[ComicPart]:
    ...
```

无 owner part 时返回空列表 `[]`，不要返回 `None`。

## 4. 前端页面结构

### 4.1 创作者入口：全站 series 书架

建议路由：

```txt
/creator/comics
```

页面内容：

```txt
创作者作品
├── 全站 series 书架
│   ├── series card
│   ├── series card
│   └── + 新建 series
```

设计规则：

1. 展示全站所有 series。
2. 使用经典书架式封面卡片，一本一本排列。
3. 最末尾放一个“加号空书”卡片。
4. 点击加号后弹出单独创建 series 的悬浮页面。
5. series 不按用户归属过滤。

预留功能：

- 创建 series
- series 封面上传
- series summary 编辑

### 4.2 Series 详情页：我的 part 书架

建议路由：

```txt
/creator/comics/:seriesSlug
```

页面内容：

```txt
Series 详情
├── 上方：较大的 series 封面
├── series 名称
├── series summary 简介框
│
└── 下方：我的 part 书架
    ├── part card
    ├── part card
    └── + 新建 part
```

设计规则：

1. 上方展示 series 的封面、名称、summary。
2. 下方只展示当前用户在该 series 下拥有 owner 权限的 part。
3. part 仍使用书架式封面卡片。
4. 末尾放“加号空书”卡片，用于创建 part。
5. part 名称旁可预留小笔图标，用于类似 admin 后台的行内改名。

预留功能：

- 创建 part
- part 封面上传
- part summary 编辑
- part 名称行内编辑

### 4.3 Part 管理页：chapter 目录与缓存区

建议路由：

```txt
/creator/comics/:seriesSlug/:partSlug
```

页面内容：

```txt
Part 管理页
├── part 封面
├── part 名称，可编辑
├── part summary，可编辑
│
├── chapter 目录
│   ├── chapter 行：名称编辑 / 上移 / 下移 / 删除
│   ├── chapter 行：名称编辑 / 上移 / 下移 / 删除
│   └── 上传新章节
│
└── 右侧抽屉：缓存区 / 待传图片区
```

设计规则：

1. 进入该页面时，后端必须额外校验当前用户是否是该 part owner。
2. part 名称、封面、summary 在这个页面允许修改。
3. chapter 列表采用目录视图，不使用书架视图。
4. 每个 chapter 行预留：
   - 名称编辑
   - 上移
   - 下移
   - 删除
5. 点击“上传新章节”后，右侧拉出缓存区。
6. 缓存区用于上传图片、显示缩略图、删除、清空、排序、发布 chapter。

## 5. 缓存区设计锚定

缓存区不是正式漫画存储。

### 5.1 缓存区路径

缓存区固定在：

```txt
backend/import_data/users/{user_id}/comic-staging
```

不要放在：

```txt
backend/uploads
```

`uploads` 只用于正式漫画文件。

### 5.2 缓存区数据表

缓存区使用 `ComicUploadImage` 表记录临时图片。

它只表示：

```txt
某个用户待传区中的一张临时图片
```

它不表示正式漫画页，也不表示正式 asset。

### 5.3 缓存区 service 边界

`comic_upload.py` 只操作：

1. `backend/import_data/users/{user_id}/comic-staging` 下的临时图片文件。
2. `ComicUploadImage` 表。

它负责：

- 上传临时图片
- 过滤非法后缀
- 记录原始文件名与后端唯一文件名
- 统计 500MB 上限
- 列出当前用户待传区图片
- 删除单张图片
- 批量删除图片
- 清空待传区
- 删除中间图片后重排 `display_order`
- 根据 `ordered_image_ids` 获取正式发布所需的 `stored_filename` 顺序

它不负责：

- 创建 series
- 创建 part
- 创建 chapter
- 创建 asset
- 创建 comic page
- 写入正式 uploads 目录

### 5.4 删除后的顺序重排

删除位于中间的缓存图片后，后续图片的 `display_order` 必须重排，避免出现空位。

例如原顺序：

```txt
1, 2, 3, 4
```

删除第 2 张后，应变成：

```txt
1, 2, 3
```

不能留下：

```txt
1, 3, 4
```

## 6. 正式发布 chapter 的连接方式

### 6.1 用户排序在前端完成

用户在右侧缓存区通过缩略图排序。

前端维护：

```ts
orderedImageIds: string[]
```

序号不单独存，直接由数组位置决定。

### 6.2 发布路由接收 ordered_image_ids

发布 chapter 时，前端提交：

```json
{
  "series_slug": "test-series",
  "part_slug": "part-1",
  "chapter_title": "第3话",
  "ordered_image_ids": ["img3", "img1", "img2"]
}
```

### 6.3 service 转换为 ordered_file_names

发布路由调用 `comic_upload.py` 中的函数，将：

```txt
ordered_image_ids
```

转换成：

```txt
ordered_file_names
```

即后端实际存储的临时文件名顺序：

```txt
["stored_c.webp", "stored_a.webp", "stored_b.webp"]
```

### 6.4 import_comic_chapter_from_dir 只在最终发布时调用

正式发布时调用：

```py
import_comic_chapter_from_dir(
    session=session,
    source_dir=source_dir,
    series_slug=series_slug,
    part_slug=part_slug,
    chapter_title=chapter_title,
    uploads_root=UPLOADS_ROOT,
    ordered_file_names=ordered_file_names,
)
```

其中：

- `source_dir` 是当前用户缓存区目录。
- `ordered_file_names` 是用户最终排序后的文件名顺序。
- `UPLOADS_ROOT` 从 `app.services.comic_admin` 导入。
- 正式发布后才进入 `backend/uploads`。

## 7. import_comic_chapter_from_dir 锚定

保留现有正式录入函数：

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
    ordered_file_names: Sequence[str] | None = None,
):
    image_files = list_image_files(
        source_dir=source_dir,
        ordered_file_names=ordered_file_names,
    )
    ...
```

`list_image_files` 规则：

1. 未传入 `ordered_file_names` 时，继续按 `mtime` 排序。
2. 传入 `ordered_file_names` 时，按该顺序校验、筛选、排序。
3. 不通过修改时间戳表达用户排序。
4. 不新增一套功能几乎相同的正式导入函数。

## 8. 后端 API 规划

### 8.1 创作者作品浏览 API

```txt
GET /api/author/comics/series
```

用途：

- 获取全站 series。
- 用于创作者入口的全站 series 书架。

```txt
GET /api/author/comics/series/{series_slug}/my-parts
```

用途：

- 获取当前用户在某个 series 下拥有 owner 权限的 part。
- 用于 series 详情页的“我的 part 书架”。

```txt
GET /api/author/comics/{series_slug}/{part_slug}
```

用途：

- 获取 part 管理页数据。
- 返回 part 信息和 chapter 列表。
- 必须校验当前用户是该 part owner。

### 8.2 缓存区 API

```txt
GET    /api/author/comic-upload/images
POST   /api/author/comic-upload/images
GET    /api/author/comic-upload/images/{image_id}/preview
DELETE /api/author/comic-upload/images/{image_id}
POST   /api/author/comic-upload/images/delete-batch
DELETE /api/author/comic-upload/images
POST   /api/author/comic-upload/publish
```

说明：

1. 图片上传、预览、删除、清空只操作缓存区。
2. `preview` 接口用于读取 `backend/import_data` 中的图片，不直接暴露静态目录。
3. `publish` 接口才调用正式导入函数。
4. `publish` 必须校验当前用户是否是目标 part owner。

### 8.3 后续预留 API

后续再补，不在第一阶段强行实现：

```txt
POST  /api/author/comics/series
PATCH /api/author/comics/series/{series_slug}

POST  /api/author/comics/series/{series_slug}/parts
PATCH /api/author/comics/{series_slug}/{part_slug}

PATCH /api/author/comics/{series_slug}/{part_slug}/chapters/{chapter_slug}/rename
PATCH /api/author/comics/{series_slug}/{part_slug}/chapters/{chapter_slug}/move
DELETE /api/author/comics/{series_slug}/{part_slug}/chapters/{chapter_slug}

POST /api/author/comic-upload/pdf
```

其中 PDF 拆页上传的最终流向仍然是：

```txt
PDF -> 拆成图片 -> 进入缓存区 -> 排序 -> 发布 chapter
```

## 9. 与 admin 后台的边界

admin 后台继续用于全站管理。

作者侧页面可以借鉴 admin 后台中的部分交互，例如：

- chapter 改名
- chapter 上下移动
- chapter 删除

但不要复用同一个页面，也不要把 admin 权限暴露给作者侧。

作者侧不显示：

- owner 选择器
- 全站 part 管理
- 别人的 chapter
- admin 删除 series / part 的高权限操作

## 10. 实现顺序建议

第一阶段建议顺序：

1. 确认 `ComicUploadImage` 表。
2. 确认 `comic_upload.py` 缓存区 service。
3. 编写缓存区 router：
   - list
   - upload
   - preview
   - delete
   - clear
   - publish
4. 编写创作者浏览 router：
   - 全站 series
   - 当前用户在某 series 下的 part
   - part 管理页数据
5. 前端先搭页面骨架：
   - series 书架
   - series 详情
   - part 管理页
   - 右侧缓存区抽屉
6. 再逐步补：
   - 新建 series
   - 新建 part
   - 封面上传
   - summary 编辑
   - PDF 拆页

## 11. 禁止偏离项

后续实现中避免以下偏离：

1. 不要把用户缓存区放进 `uploads`。
2. 不要让缓存区图片提前创建 `Asset`。
3. 不要让缓存区图片提前创建 `ComicPage`。
4. 不要用文件时间戳表达用户排序。
5. 不要新增一套几乎相同的正式导入函数。
6. 不要把 admin 后台 API 混给作者上传页使用。
7. 不要用 `get_owner_part` 判断单个 part 发布权限。
8. 不要把 owner 规则改成“只能 author”。owner 应该是 author 或 admin。
9. 不要让前端权限判断替代后端 owner 校验。
10. 不要在不确认现有函数名、导入路径、字段名时直接大段生成代码。
