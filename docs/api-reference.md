# API Reference

本文档只记录当前后端已经注册的接口。后端入口为 `backend/app/main.py`。

前端 API base URL 来自：

```txt
frontend/src/api/config.ts
```

默认开发地址：

```txt
http://127.0.0.1:18001
```

生产同源部署时使用：

```txt
VITE_API_BASE_URL=""
```

## Health

```txt
GET /
GET /health
```

## Auth

Router：`backend/app/routers/auth.py`

Prefix：

```txt
/api/auth
```

接口：

```txt
POST /api/auth/register
POST /api/auth/login
GET  /api/auth/me
```

说明：

- `register` 创建 reader 用户，受公开注册开关、人类验证和轻量限流约束。
- `login` 返回 access token 和 user。
- `me` 需要 `Authorization: Bearer <token>`。

## Public Users

Router：`backend/app/routers/users.py`

```txt
GET /api/users/{username}
```

用于公开用户页。

## Public Comics

Router：`backend/app/routers/comics.py`

```txt
GET /api/comics
GET /api/comics/{series_slug}
GET /api/comics/{series_slug}/{part_slug}/{chapter_slug}
```

用于漫画列表、系列详情和章节阅读。

## Public Novels

Router：`backend/app/routers/novels.py`

```txt
GET /api/novels
GET /api/novels/{novel_slug}
GET /api/novels/{novel_slug}/{chapter_slug}
```

用于小说列表、详情和章节阅读。章节正文为 Markdown，前端用 React Markdown 渲染。

## Admin Users

Router：`backend/app/routers/user_admin.py`

Prefix：

```txt
/api/admin/users
```

权限：

```txt
require_admin_user
```

接口：

```txt
GET    /api/admin/users
POST   /api/admin/users
PATCH  /api/admin/users/{username}
PATCH  /api/admin/users/{username}/password
DELETE /api/admin/users/{username}
GET    /api/admin/users/settings/registration
PATCH  /api/admin/users/settings/registration
```

能力：

- 列出、创建、更新、删除用户。
- 重置密码。
- 管理公开注册开关。

## Admin Comics

Router：`backend/app/routers/comic_admin.py`

Prefix：

```txt
/api/admin/comics
```

权限：

```txt
require_admin_user
```

接口：

```txt
GET    /api/admin/comics/tree
GET    /api/admin/comics/owner-candidates
POST   /api/admin/comics/chapters
DELETE /api/admin/comics/{series_slug}/{part_slug}/{chapter_slug}
DELETE /api/admin/comics/{series_slug}/{part_slug}
DELETE /api/admin/comics/{series_slug}
PATCH  /api/admin/comics/{series_slug}/{part_slug}/{chapter_slug}/move
PATCH  /api/admin/comics/{series_slug}/rename
PATCH  /api/admin/comics/{series_slug}/{part_slug}/rename
PATCH  /api/admin/comics/{series_slug}/{part_slug}/{chapter_slug}/rename
PATCH  /api/admin/comics/{series_slug}/{part_slug}/owner
PATCH  /api/admin/comics/{series_slug}/summary
PATCH  /api/admin/comics/{series_slug}/{part_slug}/summary
POST   /api/admin/comics/{series_slug}/cover
POST   /api/admin/comics/{series_slug}/{part_slug}/cover
POST   /api/admin/comics/series/create
POST   /api/admin/comics/{series_slug}/part/create
```

## Author Comics

Router：`backend/app/routers/comic_author.py`

Prefix：

```txt
/api/author/comics
```

权限：

- 需要登录。
- 按 `ComicPartUserLink(role="owner")` 限制作者只能操作自己的 part。

接口：

```txt
GET    /api/author/comics/tree
POST   /api/author/comics/series/create
POST   /api/author/comics/{series_slug}/part/create
PATCH  /api/author/comics/{series_slug}/rename
PATCH  /api/author/comics/{series_slug}/summary
POST   /api/author/comics/{series_slug}/cover
PATCH  /api/author/comics/{series_slug}/{part_slug}/rename
PATCH  /api/author/comics/{series_slug}/{part_slug}/summary
POST   /api/author/comics/{series_slug}/{part_slug}/cover
PATCH  /api/author/comics/{series_slug}/{part_slug}/{chapter_slug}/rename
PATCH  /api/author/comics/{series_slug}/{part_slug}/{chapter_slug}/move
DELETE /api/author/comics/{series_slug}/{part_slug}/{chapter_slug}
```

前端封装：

```txt
frontend/src/api/authorComics.ts
```

## Author Comic Upload

Router：`backend/app/routers/comic_upload.py`

Prefix：

```txt
/api/author/comic-upload
```

接口：

```txt
GET    /api/author/comic-upload/images
POST   /api/author/comic-upload/images
GET    /api/author/comic-upload/images/{image_id}/preview
DELETE /api/author/comic-upload/images/{image_id}
POST   /api/author/comic-upload/images/delete-batch
DELETE /api/author/comic-upload/images
POST   /api/author/comic-upload/publish
```

能力：

- 管理当前登录用户的漫画待传区。
- 发布时检查当前用户是否是目标 part owner。
- 单用户待传区 100MB，单文件 20MB。

## Admin Novels

Router：`backend/app/routers/novel_admin.py`

Prefix：

```txt
/api/admin/novels
```

权限：

```txt
require_admin_user
```

接口：

```txt
GET    /api/admin/novels/tree
GET    /api/admin/novels/owner-candidates
POST   /api/admin/novels/create
POST   /api/admin/novels/{novel_slug}/chapter/create
DELETE /api/admin/novels/{novel_slug}/{chapter_slug}
DELETE /api/admin/novels/{novel_slug}
PATCH  /api/admin/novels/{novel_slug}/rename
PATCH  /api/admin/novels/{novel_slug}/{chapter_slug}/rename
PATCH  /api/admin/novels/{novel_slug}/{chapter_slug}/content
PATCH  /api/admin/novels/{novel_slug}/{chapter_slug}/move
PATCH  /api/admin/novels/{novel_slug}/owner
```

## Author Novels

Router：`backend/app/routers/novel_author.py`

Prefix：

```txt
/api/author/novels
```

权限：

- 需要登录。
- 按 `NovelUserLink(role="owner")` 限制作者只能操作自己的 novel。

接口：

```txt
GET    /api/author/novels/tree
POST   /api/author/novels/create
POST   /api/author/novels/{novel_slug}/chapter/create
PATCH  /api/author/novels/{novel_slug}/rename
PATCH  /api/author/novels/{novel_slug}/summary
POST   /api/author/novels/{novel_slug}/cover
PATCH  /api/author/novels/{novel_slug}/{chapter_slug}/rename
PATCH  /api/author/novels/{novel_slug}/{chapter_slug}/content
PATCH  /api/author/novels/{novel_slug}/{chapter_slug}/move
DELETE /api/author/novels/{novel_slug}/{chapter_slug}
DELETE /api/author/novels/{novel_slug}
```

Novel text buffer：

```txt
GET    /api/author/novels/{novel_slug}/text-buffers
POST   /api/author/novels/{novel_slug}/text-buffer/create
POST   /api/author/novels/{novel_slug}/{chapter_slug}/text-buffer/load
PATCH  /api/author/novels/text-buffer/{buffer_id}
POST   /api/author/novels/{novel_slug}/{chapter_slug}/text-buffer/publish
POST   /api/author/novels/{novel_slug}/text-buffer/publish-new-chapter
DELETE /api/author/novels/text-buffer/{buffer_id}
```

前端封装：

```txt
frontend/src/api/authorNovels.ts
```

## Auth Header Pattern

```txt
Authorization: Bearer <accessToken>
```

前端 token 读写在：

```txt
frontend/src/api/auth.ts
```
