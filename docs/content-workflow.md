# Content Workflow

本文档描述当前漫画内容从上传到公开阅读、再到后台删除的实际工作流。

## 当前内容来源

漫画内容可以通过两种方式进入系统：

1. 前端 `/admin/comics` 上传章节。
2. 后端脚本 `backend/scripts/import_comic_chapter.py` 调用 service 导入本地目录。

两条路径最终都应调用：

```py
import_comic_chapter_from_dir(...)
```

核心业务逻辑位于：

```txt
backend/app/services/comic_admin.py
```

## 上传章节工作流

前端页面：

```txt
/admin/comics
```

前端 API：

```ts
uploadAdminComicChapter(params)
```

后端 API：

```txt
POST /api/admin/comics/chapters
```

流程：

```txt
用户选择或新建 series
-> 用户选择或新建 part
-> 用户选择多张图片
-> 前端用 FormData 提交
-> 后端校验扩展名
-> 后端写入 TemporaryDirectory
-> 临时文件按 001.ext、002.ext 命名
-> import_comic_chapter_from_dir(...)
-> get_or_create_series(...)
-> get_or_create_part(...)
-> create_next_chapter(...)
-> copy_image_to_uploads(...)
-> create_asset(...)
-> create_comic_page(...)
-> 返回导入结果
-> 前端刷新 admin tree
```

## 当前图片顺序规则

前端选择文件后，会按浏览器提供的 `FileList` 顺序追加到 FormData。

后端 router 写临时文件时按接收到的顺序命名：

```txt
001.ext
002.ext
003.ext
```

service 的 `list_image_files(source_dir)` 会按文件修改时间排序。

由于临时文件是按接收顺序连续写入，当前实际效果通常等同于上传接收顺序。

正式页序保存到：

```txt
ComicPage.display_order
```

不要依赖以下内容作为阅读顺序：

```txt
Asset.id
Asset.created_at
文件原始名称
上传时间
```

## 创建 series / part / chapter

### Series

函数：

```py
get_or_create_series(...)
```

规则：

- `series_slug` 已存在则直接返回。
- 已存在时不更新 title / summary。
- 不存在时创建新 `ComicSeries`。
- 新建默认 `status="ongoing"`、`visibility="public"`。

### Part

函数：

```py
get_or_create_part(...)
```

规则：

- 在指定 series 下查找 `part_slug`。
- 已存在则直接返回。
- 已存在时不更新 title / summary。
- 不存在时创建新 `ComicPart`。
- 新建默认 `status="ongoing"`、`visibility="public"`。

### Chapter

函数：

```py
create_next_chapter(...)
```

规则：

- 每次上传都会创建新 chapter。
- `chapter_slug` 自动生成，如 `chapter-001`。
- `display_order` 使用当前 part 下已有 chapter 数量 + 1。
- `visibility="public"`。

标题：

```txt
第1话
第2话 标题后缀
```

## 正式存储工作流

每张图片会复制到：

```txt
backend/uploads/comics/{series_slug}/{part_slug}/{chapter_slug}/{page_no}.{ext}
```

对外访问 URL：

```txt
/uploads/comics/{series_slug}/{part_slug}/{chapter_slug}/{page_no}.{ext}
```

数据库写入：

```txt
Asset
ComicPage
```

`Asset.url` 保存对外访问 URL。

`ComicPage.asset_id` 关联 `Asset.id`。

`ComicPage.display_order` 保存页序。

## 公开阅读工作流

漫画列表：

```txt
GET /api/comics
-> /works/comics
```

系列详情：

```txt
GET /api/comics/{series_slug}
-> /works/comics/:seriesSlug
```

章节阅读：

```txt
GET /api/comics/{series_slug}/{part_slug}/{chapter_slug}
-> /works/comics/:seriesSlug/:partSlug/:chapterSlug
```

公开 API 会过滤：

```txt
visibility == "public"
```

阅读页返回 `pages[]`，每个 page 包含：

```txt
displayOrder
imageUrl
width
height
```

前端使用：

```ts
resolveAssetUrl(page.imageUrl)
```

得到完整图片地址。

## 删除 chapter 工作流

入口：

```txt
DELETE /api/admin/comics/{series_slug}/{part_slug}/{chapter_slug}
```

service：

```py
delete_chapter(...)
```

流程：

```txt
get_chapter(...)
-> 查询 ComicPage
-> 收集 asset_id
-> 删除 uploads 中 chapter 文件夹
-> 删除 ComicPage
-> 删除 Asset
-> 删除 ComicChapter
-> reorder_chapters(part_id)
```

重排会更新：

```txt
ComicChapter.display_order
ComicChapter.title 中的 第N话
```

`chapter.slug` 不会因为重排而改变。

## 删除 part 工作流

入口：

```txt
DELETE /api/admin/comics/{series_slug}/{part_slug}
```

service：

```py
delete_part(...)
```

流程：

```txt
get_part(...)
-> 查询 part 下所有 chapter
-> 逐个 delete_chapter(...)
-> 删除 part.cover_asset_id 对应 Asset
-> 删除 ComicPart
```

## 删除 series 工作流

入口：

```txt
DELETE /api/admin/comics/{series_slug}
```

service：

```py
delete_series(...)
```

流程：

```txt
get_series(...)
-> 查询 series 下所有 part
-> 逐个 delete_part(...)
-> 删除 series.cover_asset_id 对应 Asset
-> 删除 ComicSeries
```

## 移动 chapter 工作流

入口：

```txt
PATCH /api/admin/comics/{series_slug}/{part_slug}/{chapter_slug}/move
```

service：

```py
shift_chapter(...)
```

流程：

```txt
get_chapter(...)
-> 计算目标 display_order
-> 查找相邻 chapter
-> 边界则返回 moved: false
-> 交换 display_order
-> 更新两个 chapter 标题中的 第N话
-> commit
```

`chapter.slug` 不会因为移动而改变。

## 重命名工作流

series 重命名入口：

```txt
PATCH /api/admin/comics/{series_slug}/rename
```

part 重命名入口：

```txt
PATCH /api/admin/comics/{series_slug}/{part_slug}/rename
```

chapter 重命名入口：

```txt
PATCH /api/admin/comics/{series_slug}/{part_slug}/{chapter_slug}/rename
```

调用链：

```txt
AdminComicsPage EditableTitle
-> frontend/src/api/adminComics.ts
-> backend/app/routers/comic_admin.py
-> backend/app/services/comic_admin.py
-> 更新 title
-> 前端 loadTree(...)
```

命名规则：

- series / part 重命名请求体使用 `title`，只修改标题，不修改 slug。
- chapter 重命名请求体使用 `customTitle`，后端按当前 `display_order` 生成完整标题。
- chapter 标题保存为 `第{display_order}话 {customTitle}` 或 `第{display_order}话`。
- 移动或删除重排时，仍会同步更新标题中的话数前缀。

## Part Owner 工作流

owner 候选入口：

```txt
GET /api/admin/comics/owner-candidates
```

设置 owner 入口：

```txt
PATCH /api/admin/comics/{series_slug}/{part_slug}/owner
```

前端流程：

```txt
AdminComicsPage
-> loadOwnerCandidates()
-> fetchAdminComicOwnerCandidates()
-> PartBlock select 展示候选用户
-> setAdminComicPartOwner({ seriesSlug, partSlug, username })
-> loadTree({ seriesSlug, partSlug })
```

后端设置流程：

```txt
set_part_owner(...)
-> get_part(...)
-> 删除该 part 现有 role == "owner" 的 ComicPartUserLink
-> username 为空则 commit 并返回 None
-> 查询 User.username
-> 校验用户存在、启用、role 是 author/admin
-> 创建 ComicPartUserLink(role="owner")
```

当前 owner 只影响后台漫画树展示，不影响公开漫画列表、系列详情或阅读接口。
