# API Design

本文档只描述当前已经实现的 API。公开展示接口和后台管理接口分开记录。

## 基础约定

后端由 FastAPI 提供接口。

前端当前硬编码 API base URL：

```txt
http://127.0.0.1:18001
```

位置：

```txt
frontend/src/api/comics.ts
frontend/src/api/adminComics.ts
frontend/src/api/auth.ts
frontend/src/api/users.ts
frontend/src/api/adminUsers.ts
```

后端返回上传资源时使用相对路径，例如：

```txt
/uploads/comics/test-series/part-1/chapter-001/001.jpg
```

前端使用 `resolveAssetUrl(url)` 转换为完整 URL。

## 认证 API

认证 router 在：

```txt
backend/app/routers/auth.py
```

prefix：

```txt
/api/auth
```

前端封装：

```txt
frontend/src/api/auth.ts
```

token 保存 key：

```txt
personal_site_access_token
```

前端保存或清除 token 后会派发：

```txt
window.dispatchEvent(new Event("auth-changed"))
```

### POST /api/auth/register

用途：

注册 reader 用户，并直接返回登录 token。

请求体：

```txt
username: string
displayName: string
password: string
bio?: string
```

后端校验：

- `username.trim()` 不能为空。
- `displayName.trim()` 不能为空。
- `password` 至少 6 位。
- `username` 不能重复。

创建用户时固定：

```txt
role = "reader"
```

前端调用：

```ts
register({ username, displayName, password })
```

注意：当前前端 `RegisterParams` 没有暴露 `bio`，注册请求不会提交 bio。

### POST /api/auth/login

用途：

用户名密码登录。

请求体：

```txt
username: string
password: string
```

返回：

```txt
accessToken
tokenType
user
```

前端调用：

```ts
login(username, password)
```

### GET /api/auth/me

用途：

用 bearer token 获取当前用户。

请求头：

```txt
Authorization: Bearer {token}
```

前端调用：

```ts
getMe()
```

公开用户字段：

```txt
id
username
displayName
role
isActive
avatarUrl
bio
createdAt
```

当前公开用户字段没有 `updatedAt`，`avatarUrl` 固定为 `null`。

## 公开用户 API

公开用户 API 的 router 在：

```txt
backend/app/routers/users.py
```

prefix：

```txt
/api/users
```

### GET /api/users/{username}

用途：

获取公开用户主页数据，用于 `/users/:username`。

后端函数：

```py
def get_user_profile(
    username: str,
    session: Session = Depends(get_session),
):
```

找不到用户或用户 `is_active == false` 时返回 404，detail 为 `用户不存在`。

返回字段：

```txt
username
displayName
avatarUrl
bio
role
series
```

当前 `series` 固定返回空数组，`avatarUrl` 固定为 `null`。

前端调用：

```ts
getUserProfile(username)
```

## 公开漫画 API

公开漫画 API 的 router 在：

```txt
backend/app/routers/comics.py
```

prefix：

```txt
/api/comics
```

公开接口只返回 `visibility == "public"` 的 series、part、chapter。

### GET /api/comics

用途：

获取公开漫画系列列表，用于 `/works/comics`。

后端函数：

```py
def list_comics(session: Session = Depends(get_session)):
```

返回 item 字段：

```txt
id: string
slug: string
title: string
summary: string
status: string
visibility: string
displayOrder: number
coverUrl: string | null
createdAt: datetime
updatedAt: datetime
```

前端调用：

```ts
getComicSeriesList()
```

前端类型：

```ts
ComicSeriesListItem
```

### GET /api/comics/{series_slug}

用途：

获取某个公开漫画系列详情，用于 `/works/comics/:seriesSlug`。

后端函数：

```py
def get_comic_detail(
    series_slug: str,
    session: Session = Depends(get_session),
):
```

路径参数：

```txt
series_slug: 必填
```

返回结构：

```txt
series
└── parts[]
    └── chapters[]
```

返回 series 字段：

```txt
id
slug
title
summary
status
visibility
displayOrder
coverUrl
createdAt
updatedAt
parts
```

返回 part 字段：

```txt
id
slug
title
summary
status
visibility
displayOrder
coverUrl
createdAt
updatedAt
chapters
```

返回 chapter 字段：

```txt
id
slug
title
summary
visibility
displayOrder
publishedAt
createdAt
updatedAt
```

前端调用：

```ts
getComicSeriesDetail(seriesSlug)
```

前端类型：

```ts
ComicSeriesDetail
```

### GET /api/comics/{series_slug}/{part_slug}/{chapter_slug}

用途：

获取某个公开章节的阅读数据，用于 `/works/comics/:seriesSlug/:partSlug/:chapterSlug`。

后端函数：

```py
def get_comic_chapter_reader(
    series_slug: str,
    part_slug: str,
    chapter_slug: str,
    session: Session = Depends(get_session),
):
```

路径参数：

```txt
series_slug: 必填
part_slug: 必填
chapter_slug: 必填
```

返回结构：

```txt
series
part
chapter
pageCount
pages[]
```

返回 page 字段：

```txt
id
displayOrder
imageUrl
width
height
createdAt
updatedAt
```

前端调用：

```ts
getComicReaderData(seriesSlug, partSlug, chapterSlug)
```

前端类型：

```ts
ComicReaderData
```

## 漫画后台 API

漫画后台 API 的 router 在：

```txt
backend/app/routers/comic_admin.py
```

prefix：

```txt
/api/admin/comics
```

router 统一挂了依赖：

```py
dependencies=[Depends(require_admin_user)]
```

当前 `require_admin_user()` 在 `backend/app/dependencies/auth.py` 中依赖 `require_current_user`，要求请求带有效 bearer token，且当前用户 `role` 必须是 `"admin"`：

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

前端调用 admin API 时应通过 `Authorization: Bearer ${token}` 传递 token；当前 token 保存在 localStorage 的 `personal_site_access_token`。

### GET /api/admin/comics/tree

用途：

获取后台漫画结构树，用于 `/admin/comics`。

后端函数：

```py
def get_admin_comics_tree(session: Session = Depends(get_session)):
```

返回结构：

```txt
series[]
└── parts[]
    └── chapters[]
```

返回 series 字段：

```txt
id
slug
title
visibility
displayOrder
parts
```

返回 part 字段：

```txt
id
slug
title
visibility
displayOrder
owner
chapters
```

返回 chapter 字段：

```txt
id
slug
title
visibility
displayOrder
pageCount
```

返回 owner 字段：

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

前端调用：

```ts
fetchAdminComicsTree()
```

### GET /api/admin/comics/owner-candidates

用途：

获取可设置为 part owner 的用户候选列表。

后端函数：

```py
def get_admin_comic_owner_candidates(
    session: Session = Depends(get_session),
):
```

候选过滤：

```txt
User.is_active == True
User.role in ["author", "admin"]
order by User.username
```

返回 item 字段：

```txt
id
username
displayName
role
avatarUrl
```

前端调用：

```ts
fetchAdminComicOwnerCandidates()
```

### POST /api/admin/comics/chapters

用途：

上传多张图片并创建一个新 chapter。series 和 part 不存在时，service 会创建。

Content-Type：

```txt
multipart/form-data
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

表单字段：

```txt
series_slug: 必填
part_slug: 必填
files: 必填，至少一张图片
chapter_title: 可选
series_title: 可选
part_title: 可选
```

支持的图片扩展名：

```txt
.jpg
.jpeg
.png
.webp
.gif
```

处理流程：

```txt
UploadFile[]
-> 临时目录，命名为 001.ext、002.ext ...
-> import_comic_chapter_from_dir(...)
-> uploads/comics/{series_slug}/{part_slug}/{chapter_slug}/
-> Asset
-> ComicPage
```

前端调用：

```ts
uploadAdminComicChapter(params)
```

前端参数：

```ts
{
  seriesSlug: string;
  partSlug: string;
  seriesTitle?: string;
  partTitle?: string;
  chapterTitle: string;
  files: File[];
}
```

### DELETE /api/admin/comics/{series_slug}/{part_slug}/{chapter_slug}

用途：

删除一个 chapter 及其页面、asset 和上传目录。

后端函数：

```py
def delete_admin_comic_chapter(
    series_slug: str,
    part_slug: str,
    chapter_slug: str,
    session: Session = Depends(get_session),
):
```

调用 service：

```py
delete_chapter(
    session=session,
    series_slug=series_slug,
    part_slug=part_slug,
    chapter_slug=chapter_slug,
)
```

前端调用：

```ts
deleteAdminComicChapter({ seriesSlug, partSlug, chapterSlug })
```

### DELETE /api/admin/comics/{series_slug}/{part_slug}

用途：

删除一个 part，包含其下所有 chapter、page、asset 和上传目录。

后端函数：

```py
def delete_admin_comic_part(
    series_slug: str,
    part_slug: str,
    session: Session = Depends(get_session),
):
```

调用 service：

```py
delete_part(
    session=session,
    series_slug=series_slug,
    part_slug=part_slug,
)
```

前端调用：

```ts
deleteAdminComicPart({ seriesSlug, partSlug })
```

### DELETE /api/admin/comics/{series_slug}

用途：

删除一个 series，包含其下所有 part、chapter、page、asset 和上传目录。

后端函数：

```py
def delete_admin_comic_series(
    series_slug: str,
    session: Session = Depends(get_session),
):
```

调用 service：

```py
delete_series(
    session=session,
    series_slug=series_slug,
)
```

前端调用：

```ts
deleteAdminComicSeries({ seriesSlug })
```

### PATCH /api/admin/comics/{series_slug}/{part_slug}/{chapter_slug}/move

用途：

上移或下移同一个 part 下的 chapter。

后端请求体：

```py
class MoveChapterRequest(BaseModel):
    direction: str
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

`direction` 当前允许值：

```txt
up
down
```

调用 service：

```py
shift_chapter(
    session=session,
    series_slug=series_slug,
    part_slug=part_slug,
    chapter_slug=chapter_slug,
    direction=payload.direction,
)
```

前端调用：

```ts
moveAdminComicChapter({
  seriesSlug,
  partSlug,
  chapterSlug,
  direction,
})
```

返回字段：

```txt
moved: boolean
reason?: string
chapterSlug: string
displayOrder: number
targetChapterSlug?: string
targetDisplayOrder?: number
```

### PATCH /api/admin/comics/{series_slug}/rename

用途：

重命名 series 的 `title`，不修改 `slug`。

请求体：

```txt
title: string
```

后端函数：

```py
def rename_admin_comic_series(
    series_slug: str,
    payload: RenameTitleRequest,
    session: Session = Depends(get_session),
):
```

前端调用：

```ts
renameAdminComicSeries({ seriesSlug, title })
```

返回字段：

```txt
id
slug
title
visibility
displayOrder
```

### PATCH /api/admin/comics/{series_slug}/{part_slug}/rename

用途：

重命名 part 的 `title`，不修改 `slug`。

请求体：

```txt
title: string
```

前端调用：

```ts
renameAdminComicPart({ seriesSlug, partSlug, title })
```

返回字段：

```txt
id
slug
title
visibility
displayOrder
```

### PATCH /api/admin/comics/{series_slug}/{part_slug}/{chapter_slug}/rename

用途：

重命名 chapter 的标题后缀。后端会根据当前 `display_order` 生成完整标题。

请求体：

```txt
customTitle: string | null
```

生成规则：

```txt
customTitle 有值：第{display_order}话 {customTitle}
customTitle 为空：第{display_order}话
```

前端调用：

```ts
renameAdminComicChapter({ seriesSlug, partSlug, chapterSlug, customTitle })
```

返回字段：

```txt
id
slug
title
visibility
displayOrder
```

### PATCH /api/admin/comics/{series_slug}/{part_slug}/owner

用途：

设置或清空 part owner。

请求体：

```txt
username: string | null
```

后端规则：

- 先删除该 part 现有 `role == "owner"` 的 `ComicPartUserLink`。
- `username` 为空或 `null` 时清空 owner。
- 非空时用户必须存在、启用，且角色是 `author` 或 `admin`。

前端调用：

```ts
setAdminComicPartOwner({ seriesSlug, partSlug, username })
```

返回字段：

```txt
seriesSlug
partSlug
owner
```

## 用户后台 API

用户后台 API 的 router 在：

```txt
backend/app/routers/user_admin.py
```

prefix：

```txt
/api/admin/users
```

router 统一挂了：

```py
dependencies=[Depends(require_admin_user)]
```

前端封装：

```txt
frontend/src/api/adminUsers.ts
```

### GET /api/admin/users

用途：

获取用户列表，按 `User.created_at` 排序。

前端调用：

```ts
fetchAdminUsers()
```

返回 item 字段：

```txt
id
username
displayName
role
isActive
avatarUrl
bio
createdAt
updatedAt
```

### POST /api/admin/users

用途：

管理员创建用户。

请求体：

```txt
username: string
displayName: string
password: string
role: "reader" | "author" | "admin"
bio?: string
```

校验：

- `username.trim()` 不能为空。
- `displayName.trim()` 不能为空。
- `password` 至少 6 位。
- `role` 必须是 `reader` / `author` / `admin`。
- `username` 不能重复。

前端调用：

```ts
createAdminUser(params)
```

### PATCH /api/admin/users/{username}

用途：

管理员更新用户资料、角色或启用状态。

请求体字段均可选：

```txt
displayName?: string
role?: "reader" | "author" | "admin"
isActive?: boolean
bio?: string
```

前端调用：

```ts
updateAdminUser(username, params)
```

### PATCH /api/admin/users/{username}/password

用途：

管理员重置用户密码。

请求体：

```txt
password: string
```

密码至少 6 位。

前端调用：

```ts
resetAdminUserPassword(username, { password })
```

### DELETE /api/admin/users/{username}

用途：

管理员删除用户。

请求体：

```txt
confirmUsername: string
adminPassword: string
```

规则：

- 不能删除当前登录用户。
- `confirmUsername` 必须等于路径中的 `username`。
- `adminPassword` 必须能通过当前管理员的密码校验。

前端调用：

```ts
deleteAdminUser(username, { confirmUsername, adminPassword })
```

返回：

```txt
deleted: true
username: string
```

## 字段命名映射

数据库模型使用 Python / SQL 风格：

```txt
display_order
cover_asset_id
created_at
updated_at
published_at
```

API 返回给前端时使用 camelCase：

```txt
displayOrder
coverUrl
createdAt
updatedAt
publishedAt
```

路由路径参数使用 snake_case：

```txt
series_slug
part_slug
chapter_slug
```

前端函数参数使用 camelCase：

```txt
seriesSlug
partSlug
chapterSlug
```

请求体也遵循前后端边界：

- 后端 Pydantic 请求体当前使用 camelCase 字段，例如 `displayName`、`isActive`、`customTitle`、`confirmUsername`、`adminPassword`。
- multipart/form-data 字段仍使用 snake_case，例如 `series_slug`、`part_slug`、`chapter_title`。
