# Admin Comics Current Implementation

本文档记录当前漫画后台管理功能的实际实现状态。

当前 admin comics 是本地内容管理工具，不是完整后台系统。它的目标是让作者能在本地上传漫画章节、查看漫画结构、删除内容、调整章节顺序。

当前后续改进方向：把 `AdminComicsPage.tsx` 中已经存在的局部组件继续拆成独立组件，方便后续用户上传界面复用，以及统一后台页面风格。

## 前后端入口

前端页面：

```txt
/admin/comics
```

前端页面文件：

```txt
frontend/src/pages/AdminComicsPage.tsx
```

前端 API 封装：

```txt
frontend/src/api/adminComics.ts
```

后端 router：

```txt
backend/app/routers/comic_admin.py
```

后端 service：

```txt
backend/app/services/comic_admin.py
```

API prefix：

```txt
/api/admin/comics
```

## 权限依赖

admin router 统一挂载：

```py
dependencies=[Depends(require_admin_user)]
```

当前 `require_admin_user()` 位于：

```txt
backend/app/dependencies/auth.py
```

当前实现要求 bearer token，并校验当前用户是管理员：

```py
def require_admin_user(
    current_user: User = Depends(require_current_user),
) -> User:
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="没有管理员权限",
        )

    return current_user
```

前端 admin comics 请求通过 `frontend/src/api/adminComics.ts` 读取 localStorage 中的 `personal_site_access_token`，并在有 token 时附加：

```txt
Authorization: Bearer ${token}
```

## 当前已实现功能

前端 `/admin/comics` 当前支持：

- 加载漫画结构树。
- 选择已有 series。
- 选择已有 part。
- 新建 series。
- 新建 part。
- 上传多张图片并创建新 chapter。
- 展示待上传图片顺序。
- 删除 chapter。
- 删除 part。
- 删除 series。
- 上移 chapter。
- 下移 chapter。
- 重命名 series。
- 重命名 part。
- 重命名 chapter 的自定义标题后缀。
- 查看并设置 part owner。
- 上传、删除、移动成功后刷新结构树。
- 重命名或设置 owner 成功后刷新结构树。
- 对新建 series / part 的重复 slug 做前端提示和拦截。
- 对 part / series 删除使用输入 slug 的二次确认。

`AdminComicsPage.tsx` 当前同文件内已有组件：

```txt
MessageArea
EditableTitle
UploadChapterForm
ComicTreeView
SeriesBlock
PartBlock
ChapterRow
```

## 当前接口

### 获取后台漫画树

```txt
GET /api/admin/comics/tree
```

后端函数：

```py
def get_admin_comics_tree(session: Session = Depends(get_session)):
```

查询逻辑：

```txt
ComicSeries order by display_order
-> ComicPart where series_id == series.id order by display_order
-> ComicChapter where part_id == part.id order by display_order
-> ComicPage where chapter_id == chapter.id
-> get_part_owner(session, part)
```

返回时 chapter 的 `pageCount` 使用 pages 数量计算。

part 返回 `owner`：

```txt
null
```

或：

```txt
id
username
displayName
role
avatarUrl
```

### 获取 owner 候选人

```txt
GET /api/admin/comics/owner-candidates
```

后端函数：

```py
def get_admin_comic_owner_candidates(
    session: Session = Depends(get_session),
):
```

service：

```py
list_owner_candidates(session)
```

筛选规则：

```txt
User.is_active == True
User.role in ["author", "admin"]
```

前端调用：

```ts
fetchAdminComicOwnerCandidates()
```

### 上传章节

```txt
POST /api/admin/comics/chapters
```

后端函数：

```py
async def create_admin_comic_chapter(
    series_slug: str = Form(...),
    part_slug: str = Form(...),
    chapter_title: str | None = Form(None),
    series_title: str | None = Form(None),
    part_title: str | None = Form(None),
    files: list[UploadFile] = File(...),
    session: Session = Depends(get_session),
):
```

必填：

```txt
series_slug
part_slug
files
```

可选：

```txt
chapter_title
series_title
part_title
```

router 行为：

- 如果 `files` 为空，返回 400。
- 只允许 `.jpg`、`.jpeg`、`.png`、`.webp`、`.gif`。
- 上传文件先写入临时目录。
- 临时文件命名为 `001.ext`、`002.ext` 等。
- 调用 `import_comic_chapter_from_dir(...)`。

service 调用：

```py
import_comic_chapter_from_dir(
    session=session,
    source_dir=temp_path,
    series_slug=series_slug,
    part_slug=part_slug,
    series_title=series_title,
    part_title=part_title,
    chapter_title=chapter_title,
)
```

注意：

- router 当前没有传 `series_summary`、`part_summary`、`series_display_order`、`part_display_order`。
- service 会自动创建不存在的 series / part。
- 已存在的 series / part 不会被上传表单中的 title 覆盖。

### 删除 chapter

```txt
DELETE /api/admin/comics/{series_slug}/{part_slug}/{chapter_slug}
```

后端函数：

```py
def delete_admin_comic_chapter(
    series_slug: str,
    part_slug: str,
    chapter_slug: str,
    session: Session = Depends(get_session),
):
```

service：

```py
delete_chapter(
    session=session,
    series_slug=series_slug,
    part_slug=part_slug,
    chapter_slug=chapter_slug,
)
```

删除内容：

```txt
uploads/comics/{series_slug}/{part_slug}/{chapter_slug}
ComicPage
Asset
ComicChapter
```

删除后调用 `reorder_chapters(part_id)` 重排同一 part 下剩余 chapter。

### 删除 part

```txt
DELETE /api/admin/comics/{series_slug}/{part_slug}
```

后端函数：

```py
def delete_admin_comic_part(
    series_slug: str,
    part_slug: str,
    session: Session = Depends(get_session),
):
```

service：

```py
delete_part(
    session=session,
    series_slug=series_slug,
    part_slug=part_slug,
)
```

删除内容：

```txt
part 下所有 chapter
part.cover_asset_id 对应 Asset
ComicPart
```

每个 chapter 的删除继续走 `delete_chapter()`。

### 删除 series

```txt
DELETE /api/admin/comics/{series_slug}
```

后端函数：

```py
def delete_admin_comic_series(
    series_slug: str,
    session: Session = Depends(get_session),
):
```

service：

```py
delete_series(
    session=session,
    series_slug=series_slug,
)
```

删除内容：

```txt
series 下所有 part
series.cover_asset_id 对应 Asset
ComicSeries
```

每个 part 的删除继续走 `delete_part()`。

### 移动 chapter

```txt
PATCH /api/admin/comics/{series_slug}/{part_slug}/{chapter_slug}/move
```

请求体：

```json
{
  "direction": "up"
}
```

`direction` 可选值：

```txt
up
down
```

后端函数：

```py
def move_admin_comic_chapter(
    series_slug: str,
    part_slug: str,
    chapter_slug: str,
    payload: MoveChapterRequest,
    session: Session = Depends(get_session),
):
```

service：

```py
shift_chapter(
    session=session,
    series_slug=series_slug,
    part_slug=part_slug,
    chapter_slug=chapter_slug,
    direction=payload.direction,
)
```

移动行为：

- 找到当前 chapter。
- 根据 `direction` 找相邻 `display_order` 的目标 chapter。
- 没有目标时返回 `moved: False`。
- 有目标时交换两个 chapter 的 `display_order`。
- 同步更新标题中的 `第N话`。

### 重命名 series

```txt
PATCH /api/admin/comics/{series_slug}/rename
```

请求体：

```json
{
  "title": "新标题"
}
```

service：

```py
rename_series(
    session=session,
    series_slug=series_slug,
    title=payload.title,
)
```

只修改 `ComicSeries.title`，不修改 `slug`。

### 重命名 part

```txt
PATCH /api/admin/comics/{series_slug}/{part_slug}/rename
```

请求体：

```json
{
  "title": "新标题"
}
```

service：

```py
rename_part(
    session=session,
    series_slug=series_slug,
    part_slug=part_slug,
    title=payload.title,
)
```

只修改 `ComicPart.title`，不修改 `slug`。

### 重命名 chapter

```txt
PATCH /api/admin/comics/{series_slug}/{part_slug}/{chapter_slug}/rename
```

请求体：

```json
{
  "customTitle": "标题后缀"
}
```

service：

```py
rename_chapter(
    session=session,
    series_slug=series_slug,
    part_slug=part_slug,
    chapter_slug=chapter_slug,
    custom_title=payload.customTitle,
)
```

后端会按当前 `display_order` 生成完整标题：

```txt
customTitle 有值：第{display_order}话 {customTitle}
customTitle 为空：第{display_order}话
```

前端展示时使用 `getChapterCustomTitle(chapter)` 去掉 `第{displayOrder}话` 前缀，只编辑自定义后缀。

### 设置 part owner

```txt
PATCH /api/admin/comics/{series_slug}/{part_slug}/owner
```

请求体：

```json
{
  "username": "author01"
}
```

清空 owner 时：

```json
{
  "username": null
}
```

service：

```py
set_part_owner(
    session=session,
    series_slug=series_slug,
    part_slug=part_slug,
    username=payload.username,
)
```

规则：

- 设置前删除该 part 现有 owner link。
- 空 username 表示清空 owner。
- 非空 username 对应用户必须存在、启用，且角色是 `author` 或 `admin`。

## 前端状态与命名

`frontend/src/api/adminComics.ts` 中的前端类型：

```ts
AdminComicSeries
AdminComicPart
AdminComicChapter
```

前端使用 camelCase：

```txt
seriesSlug
partSlug
chapterSlug
displayOrder
pageCount
customTitle
```

后端路径和表单字段使用 snake_case：

```txt
series_slug
part_slug
chapter_slug
display_order
```

后端 JSON 请求体中有些字段也是 camelCase，因为 Pydantic 模型直接定义为前端字段名：

```txt
customTitle
```

上传表单组件内部模式：

```txt
seriesMode: "existing" | "new"
partMode: "existing" | "new"
```

特殊 select 值：

```txt
__new__
```

## 当前限制

- 没有封面上传 UI。
- 上传前没有图片缩略图预览。
- 上传前不能在 UI 中拖拽调整图片顺序。
- `series_title` 和 `part_title` 只在新建时生效。
- `summary`、`status`、`visibility` 没有后台编辑 UI。
- owner 目前只记录在 `ComicPartUserLink`，公开漫画 API 暂未返回 owner。
- 组件虽然已在 `AdminComicsPage.tsx` 内拆分，但还没有拆到独立文件。
- 删除操作会真实删除数据库记录和上传目录，应谨慎使用。
