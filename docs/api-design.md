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
```

后端返回上传资源时使用相对路径，例如：

```txt
/uploads/comics/test-series/part-1/chapter-001/001.jpg
```

前端使用 `resolveAssetUrl(url)` 转换为完整 URL。

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

前端调用：

```ts
fetchAdminComicsTree()
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
