# API Reference

本文档只记录当前代码中已经注册的接口。新会话实现功能前先查这里，避免重复新增已有接口。

后端入口：`backend/app/main.py`。

默认开发 API 地址目前在前端硬编码为：

```txt
http://127.0.0.1:18001
```

## Health

```txt
GET /
GET /health
```

用途：

- `/` 返回后端运行信息。
- `/health` 返回 `{ "status": "ok" }`。

## Auth

Router：`backend/app/routers/auth.py`

Prefix：

```txt
/api/auth
```

已存在接口：

```txt
POST /api/auth/register
POST /api/auth/login
GET  /api/auth/me
```

不要重复实现身份检查接口。`GET /api/auth/me` 已经用于检查当前 token 并返回当前用户。

请求与行为：

- `register`
  - body：`username`、`displayName`、`password`、可选 `bio`。
  - 创建 `reader` 用户。
  - 返回 access token 和 user。

- `login`
  - body：`username`、`password`。
  - 校验用户存在、启用状态、密码。
  - 返回 access token 和 user。

- `me`
  - header：`Authorization: Bearer <token>`。
  - 通过 `require_current_user` 返回当前用户。

相关后端依赖：

```py
require_current_user
require_admin_user
```

位置：

```txt
backend/app/dependencies/auth.py
```

相关前端封装：

```txt
frontend/src/api/auth.ts
```

## Public Users

Router：`backend/app/routers/users.py`

Prefix：

```txt
/api/users
```

已存在接口：

```txt
GET /api/users/{username}
```

用途：

- 获取公开用户主页信息。
- 当前返回用户基础信息和空 `series`。

前端封装：

```txt
frontend/src/api/users.ts
```

## 注册相关接口补充

### 公开注册

```txt
POST /api/auth/register
```
请求体：
```
{
  "username": "string",
  "displayName": "string",
  "password": "string",
  "bio": "string",
  "humanCheck": "是"
}
```
说明：

humanCheck 必须填写为 是。
如果公开注册已关闭，该接口返回 403。
注册成功后返回 access token 和用户信息。
### 获取注册开关
```
GET /api/admin/users/settings/registration
```
权限：管理员。

返回：
```
{
  "enabled": true
}
```
修改注册开关
```
PATCH /api/admin/users/settings/registration
```
权限：管理员。

请求体：
```
{
  "enabled": false
}
```
返回：
```
{
  "enabled": false
}
```
说明：

关闭公开注册后，普通注册入口不能创建新账号。
管理员后台创建用户不受该开关影响。

## Public Comics

Router：`backend/app/routers/comics.py`

Prefix：

```txt
/api/comics
```

已存在接口：

```txt
GET /api/comics
GET /api/comics/{series_slug}
GET /api/comics/{series_slug}/{part_slug}/{chapter_slug}
```

行为：

- `GET /api/comics`
  - 只返回 `visibility == "public"` 的 series。
  - 按 `display_order` 排序。

- `GET /api/comics/{series_slug}`
  - 只查公开 series。
  - 返回公开 parts 和公开 chapters。
  - 不返回漫画页图片。

- `GET /api/comics/{series_slug}/{part_slug}/{chapter_slug}`
  - 返回阅读页所需数据。
  - 返回 pages，每页含 `imageUrl`、`displayOrder`、尺寸字段。

前端封装：

```txt
frontend/src/api/comics.ts
```

使用页面：

```txt
frontend/src/pages/ComicsPage.tsx
frontend/src/pages/ComicSeriesPage.tsx
frontend/src/pages/ComicReaderPage.tsx
```

## Admin Comics

Router：`backend/app/routers/comic_admin.py`

Prefix：

```txt
/api/admin/comics
```

权限：

```py
dependencies=[Depends(require_admin_user)]
```

也就是说：整个 router 都要求 admin。不要让普通 author 直接依赖这些接口。

已存在接口：

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
```

主要能力：

- 获取全站漫画树。
- 上传图片并创建章节。
- 删除 chapter、part、series。
- 移动章节顺序。
- 重命名 series、part、chapter。
- 设置 part owner。
- 修改 series、part 简介。
- 上传 series、part 封面。

后端核心 service：

```txt
backend/app/services/comic_admin.py
```

前端封装：

```txt
frontend/src/api/adminComics.ts
```

使用页面：

```txt
frontend/src/pages/AdminComicsPage.tsx
```

## Admin Users

Router：`backend/app/routers/user_admin.py`

Prefix：

```txt
/api/admin/users
```

权限：

```py
dependencies=[Depends(require_admin_user)]
```

已存在接口：

```txt
GET    /api/admin/users
POST   /api/admin/users
PATCH  /api/admin/users/{username}
PATCH  /api/admin/users/{username}/password
DELETE /api/admin/users/{username}
```

主要能力：

- 列出用户。
- 创建用户。
- 更新显示名、角色、启用状态、bio。
- 重置密码。
- 删除用户，删除时要求确认用户名和当前管理员密码。

前端封装：

```txt
frontend/src/api/adminUsers.ts
```

使用页面：

```txt
frontend/src/pages/AdminUsersPage.tsx
```

## Author Comic Upload

Router：`backend/app/routers/comic_upload.py`

Prefix：

```txt
/api/author/comic-upload
```

权限：

- 使用 `require_current_user`。
- 发布时额外检查当前用户是否是目标 part 的 owner。

已存在接口：

```txt
GET    /api/author/comic-upload/images
POST   /api/author/comic-upload/images
GET    /api/author/comic-upload/images/{image_id}/preview
DELETE /api/author/comic-upload/images/{image_id}
POST   /api/author/comic-upload/images/delete-batch
DELETE /api/author/comic-upload/images
POST   /api/author/comic-upload/publish
```

主要能力：

- 查看当前用户待传区。
- 上传多张图片到待传区。
- 预览待传图片。
- 删除单张图片。
- 批量删除图片。
- 清空待传区。
- 发布待传区图片为某个已有 part 下的新 chapter。

后端核心 service：

```txt
backend/app/services/comic_upload.py
```

前端封装：

```txt
frontend/src/api/authorComicUpload.ts
```

使用页面：

```txt
frontend/src/pages/CreatorComicPartPage.tsx
```

## Frontend API Files

当前前端 API 封装位置：

```txt
frontend/src/api/auth.ts
frontend/src/api/comics.ts
frontend/src/api/users.ts
frontend/src/api/adminComics.ts
frontend/src/api/adminUsers.ts
frontend/src/api/authorComics.ts
frontend/src/api/authorComicUpload.ts
```

注意：

- 多个文件重复硬编码 `API_BASE_URL`。
- 新功能不要继续复制这个常量；应先统一配置。
- `authorComics.ts` 目前复用 admin API，这是现状问题，不是推荐架构。

## Auth Header Pattern

已存在 Bearer token 模式：

```txt
Authorization: Bearer <accessToken>
```

前端 token 读写：

```txt
saveAccessToken
getAccessToken
clearAccessToken
```

位置：

```txt
frontend/src/api/auth.ts
```

后端 token 校验：

```txt
backend/app/dependencies/auth.py
```

如果需要保护新接口，优先使用：

```py
current_user: User = Depends(require_current_user)
```

如果只允许管理员，使用：

```py
current_user: User = Depends(require_admin_user)
```

