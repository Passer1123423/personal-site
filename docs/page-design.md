# Page Design

本文档描述当前前端路由和页面状态。实际路由定义在：

```txt
frontend/src/App.tsx
```

## 路由总览

| 路由 | 页面组件 | 当前状态 |
|---|---|---|
| `/` | `HomePage` | 已实现 |
| `/projects` | `ProjectsPage` | 静态项目列表 |
| `/works` | `WorksPage` | 作品入口页 |
| `/works/comics` | `ComicsPage` | 已接公开漫画 API |
| `/works/comics/:seriesSlug` | `ComicSeriesPage` | 已接公开漫画 API |
| `/works/comics/:seriesSlug/:partSlug/:chapterSlug` | `ComicReaderPage` | 已接公开漫画 API |
| `/register` | `RegisterPage` | 注册 reader 用户 |
| `/users/:username` | `UserPage` | 已接公开用户 API |
| `/about` | `AboutPage` | 已实现 |
| `/admin` | `AdminHomePage` | 后台入口，需要 admin |
| `/admin/login` | `AdminLoginPage` | 登录入口 |
| `/admin/comics` | `AdminComicsPage` | 已接后台漫画 API |
| `/admin/users` | `AdminUsersPage` | 已接后台用户 API |

注意：

- 当前真实路由使用 `/works`，不是 `/work`。
- 漫画阅读路由包含 `seriesSlug`、`partSlug`、`chapterSlug` 三段。
- 当前没有单独的 `/novels`、`/posts` 路由。
- `/admin/login` 当前是通用登录页；普通用户登录成功后进入 `/users/:username`，不是直接进入后台。
- `/admin`、`/admin/comics`、`/admin/users` 页面进入时都会调用 `getMe()` 并要求 `role === "admin"`。

## 首页

路由：

```txt
/
```

组件：

```txt
frontend/src/pages/HomePage.tsx
```

当前内容：

- `Hero`
- 精选项目
- 小说存档入口
- 漫画存档入口

当前首页中的小说和漫画入口都指向 `/works`。

## Projects 页面

路由：

```txt
/projects
```

组件：

```txt
frontend/src/pages/ProjectsPage.tsx
```

当前数据来源：

```txt
frontend/src/data/projects.ts
```

当前是静态项目列表，没有后端项目 API。

## Works 页面

路由：

```txt
/works
```

组件：

```txt
frontend/src/pages/WorksPage.tsx
```

当前内容：

- 小说存档卡片，暂无后端闭环。
- 漫画存档卡片，点击进入 `/works/comics`。

## 漫画列表页

路由：

```txt
/works/comics
```

组件：

```txt
frontend/src/pages/ComicsPage.tsx
```

前端调用：

```ts
getComicSeriesList()
```

后端接口：

```txt
GET /api/comics
```

页面状态：

- loading
- error
- empty
- series card list

每个卡片链接到：

```txt
/works/comics/{series.slug}
```

## 漫画系列详情页

路由：

```txt
/works/comics/:seriesSlug
```

组件：

```txt
frontend/src/pages/ComicSeriesPage.tsx
```

前端调用：

```ts
getComicSeriesDetail(seriesSlug)
```

后端接口：

```txt
GET /api/comics/{series_slug}
```

页面展示：

- series 标题
- series 简介
- series 封面或占位图
- series status
- series visibility
- parts 列表
- 每个 part 下的 chapter 入口

每个 chapter 链接到：

```txt
/works/comics/{series.slug}/{part.slug}/{chapter.slug}
```

## 漫画阅读页

路由：

```txt
/works/comics/:seriesSlug/:partSlug/:chapterSlug
```

组件：

```txt
frontend/src/pages/ComicReaderPage.tsx
```

前端调用：

```ts
getComicReaderData(seriesSlug, partSlug, chapterSlug)
```

后端接口：

```txt
GET /api/comics/{series_slug}/{part_slug}/{chapter_slug}
```

页面展示：

- 返回系列详情页链接
- chapter 标题
- series / part / pageCount
- chapter summary
- 按 `pages[].displayOrder` 渲染图片

图片地址处理：

```ts
resolveAssetUrl(page.imageUrl)
```

## 漫画后台页

路由：

```txt
/admin/comics
```

组件：

```txt
frontend/src/pages/AdminComicsPage.tsx
```

前端 API：

```txt
frontend/src/api/adminComics.ts
```

后端 API prefix：

```txt
/api/admin/comics
```

当前页面功能：

- 加载后台漫画树。
- 上传新 chapter。
- 选择已有 series / part。
- 新建 series / part。
- 重命名 series / part / chapter。
- 设置 part owner。
- 加载 owner 候选用户。
- 删除 series / part / chapter。
- 上移 / 下移 chapter。
- 显示成功和错误消息。

当前页面不是公开展示页面，不应混入 `/works/comics` 的公开阅读流程。

当前 `AdminComicsPage.tsx` 已经在同文件内拆出了局部组件：

```txt
MessageArea
EditableTitle
UploadChapterForm
ComicTreeView
SeriesBlock
PartBlock
ChapterRow
```

后续改进方向是继续把这些局部组件拆到独立组件文件中，便于后续用户上传界面复用和统一风格调整。拆分时应保留当前 props 命名和 API 层调用，不要把接口字段命名混入 UI 组件。

## 注册页

路由：

```txt
/register
```

组件：

```txt
frontend/src/pages/RegisterPage.tsx
```

前端调用：

```ts
register({ username, displayName, password })
```

后端接口：

```txt
POST /api/auth/register
```

页面状态：

- username
- displayName
- password
- confirmPassword
- errorMessage
- isSubmitting

注册成功后：

```txt
saveAccessToken(result.accessToken)
navigate(`/users/${result.user.username}`)
```

## 登录页

路由：

```txt
/admin/login
```

组件：

```txt
frontend/src/pages/AdminLoginPage.tsx
```

前端调用：

```ts
login(username.trim(), password)
```

当前行为：

- 页面加载时调用 `getMe()`。
- 已登录则跳转 `/users/${user.username}`。
- 未登录或 token 失效则 `clearAccessToken()`。
- 登录成功后保存 token 并跳转 `/users/${result.user.username}`。

## 公开用户页

路由：

```txt
/users/:username
```

组件：

```txt
frontend/src/pages/UserPage.tsx
```

前端调用：

```ts
getUserProfile(username)
```

后端接口：

```txt
GET /api/users/{username}
```

页面状态：

- loading
- error
- profile

当前展示：

- 返回首页链接
- 用户头像占位首字母
- `@username`
- `displayName`
- `bio`
- `role`
- 作品、收藏、动态占位区

## 后台首页

路由：

```txt
/admin
```

组件：

```txt
frontend/src/pages/AdminHomePage.tsx
```

进入页面时：

```txt
getMe()
-> user.role !== "admin" 时 navigate("/admin/login", { replace: true })
-> 失败时 clearAccessToken() 并 navigate("/admin/login", { replace: true })
```

当前入口：

- `/admin/comics`
- `/admin/users`

## 用户后台页

路由：

```txt
/admin/users
```

组件：

```txt
frontend/src/pages/AdminUsersPage.tsx
```

前端 API：

```txt
frontend/src/api/adminUsers.ts
```

后端 API prefix：

```txt
/api/admin/users
```

当前页面功能：

- 加载用户列表。
- 创建用户。
- 修改显示名。
- 修改角色。
- 启用 / 停用用户。
- 重置密码。
- 删除用户。

当前页面会保存 `currentUsername`，并在前端禁止修改当前登录用户角色、停用当前登录用户、删除当前登录用户。后端删除接口也会再次禁止删除当前登录用户。

## 命名对接

前端路由参数：

```txt
seriesSlug
partSlug
chapterSlug
```

后端路径参数：

```txt
series_slug
part_slug
chapter_slug
```

前端 API 层负责在 URL 中拼接 slug。

API 返回字段：

```txt
displayOrder
coverUrl
createdAt
updatedAt
publishedAt
displayName
isActive
avatarUrl
```

请求体字段注意：

```txt
auth/register: displayName
admin/users patch: displayName, isActive
admin/comics chapter rename: customTitle
admin/comics part owner: username
```

数据库字段：

```txt
display_order
cover_asset_id
created_at
updated_at
published_at
```
