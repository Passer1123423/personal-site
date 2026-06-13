# Project Current State

本文档记录当前项目真实状态。新会话实现功能前先读这里。

## 技术栈

- Frontend：Vite 8 + React 19 + TypeScript 6 + Tailwind CSS 4。
- Backend：FastAPI + SQLModel + SQLite。
- Auth：JWT Bearer token，`SECRET_KEY` 必须由环境变量提供。
- Uploads：本地文件系统，FastAPI 挂载 `/uploads`。
- Deployment：Linux + systemd + Nginx + SQLite + uploads + 备份脚本。

## 顶层结构

```txt
frontend/
├─ public/
├─ src/
│  ├─ api/
│  ├─ components/
│  ├─ data/
│  ├─ pages/
│  ├─ styles/
│  ├─ utils/
│  ├─ App.tsx
│  └─ main.tsx
└─ package.json

backend/
├─ app/
│  ├─ main.py
│  ├─ models.py
│  ├─ database.py
│  ├─ core/security.py
│  ├─ dependencies/auth.py
│  ├─ routers/
│  └─ services/
├─ scripts/
├─ data/
├─ import_data/
└─ uploads/

docs/
├─ *.md
└─ docs-archive/
```

## 前端路由

公共侧：

- `/`：Home。
- `/projects`：Projects。
- `/about`：About。
- `/works`：作品入口。
- `/works/comics`：漫画列表。
- `/works/comics/:seriesSlug`：漫画系列详情。
- `/works/comics/:seriesSlug/:partSlug`：漫画 Part 详情。
- `/works/comics/:seriesSlug/:partSlug/:chapterSlug`：漫画阅读器。
- `/works/novels`：小说列表。
- `/works/novels/:novelSlug`：小说详情。
- `/works/novels/:novelSlug/:chapterSlug`：小说阅读器。
- `/users/:username`：公开用户页，带留言面板。
- `/register`：注册页。
- `/settings/profile`：当前登录用户资料/头像设置页。
- `/notifications`：当前登录用户通知页。

后台侧：

- `/admin`：后台入口。
- `/admin/login`：登录页。
- `/admin/users`：用户管理和注册开关。
- `/admin/comics`：漫画管理。
- `/admin/novels`：小说管理。
- `/admin/interactions`：评论/互动管理。
- `/admin/activity-logs`：活动日志管理。

创作者侧：

- `/creator`：创作者入口。
- `/creator/comics`：作者漫画书架。
- `/creator/comics/:seriesSlug`：作者漫画 Series 管理。
- `/creator/comics/:seriesSlug/:partSlug`：作者漫画 Part 管理和 chapter 待传抽屉。
- `/creator/novels`：作者小说书架。
- `/creator/novels/:novelSlug`：作者小说 Novel 管理。
- `/creator/novels/:novelSlug/new-chapter`：新建小说 chapter 编辑器。
- `/creator/novels/:novelSlug/:chapterSlug/edit`：已有小说 chapter 编辑器。

注意：`App.tsx` 中 `/creator/comics`、`/creator/comics/:seriesSlug`、`/creator/comics/:seriesSlug/:partSlug` 目前有重复 Route 声明；React Router 实际匹配不受影响，但后续整理 route config 时应去重。

## App 布局模式

当前 `frontend/src/App.tsx` 使用简化 Navbar 模式：

- `standard`：普通页面，渲染标准 sticky Navbar 和 Footer。
- `auto`：创作工作页，桌面端渲染顶部热区自动展开 Navbar，桌面端隐藏 Footer；移动端仍保留原 sticky Navbar 和 Footer。
- `none`：完全沉浸页，不渲染 App Navbar/Footer；当前用于漫画阅读器。

当前 `auto` 页面：

- `/creator/comics/:seriesSlug/:partSlug`
- `/creator/novels/:novelSlug/new-chapter`
- `/creator/novels/:novelSlug/:chapterSlug/edit`
- `/admin/activity-logs`

## 后端入口和路由

入口：`backend/app/main.py`。

当前注册 router：

- `users_router`
- `user_profile_router`
- `auth_router`
- `user_admin_router`
- `comics_router`
- `comic_upload_router`
- `comic_author_router`
- `comic_admin_router`
- `novels_router`
- `novel_admin_router`
- `novel_author_router`
- `interactions_router`
- `interaction_admin_router`
- `activity_log_admin_router`
- `notifications_router`
- `favorites_router`

基础接口：

- `GET /`
- `GET /health`

## 当前主要业务

用户系统：

- `User` 模型，角色为字符串：`reader`、`author`、`admin`。
- 公开注册可由 admin 开关控制。
- 注册有人类验证字段，当前要求输入“是”。
- `POST /api/auth/register`、`POST /api/auth/login`、`GET /api/auth/me`。
- `/api/users/me/*` 支持资料更新、头像上传、头像列表、头像切换、头像删除。
- 公开用户页 `/users/:username` 展示资料和留言。

漫画系统：

- `ComicSeries`、`ComicPart`、`ComicChapter`、`ComicPage`。
- 作者归属在 `ComicPartUserLink`，即 Part 层 owner。
- 公共漫画列表、系列详情、Part 轻量详情、章节阅读。
- `GET /api/comics/{series_slug}/{part_slug}` 专供 Comic Part 详情页使用，只返回 series、part 和 chapters，不返回 pages。
- Admin 漫画后台可建 Series/Part、上传章节、重命名、摘要、封面、owner、删除和移动章节。
- Author 漫画后台使用 `/api/author/comics`，只能操作 owner 为自己的 Part。
- Author Comic staging 上传区使用 `/api/author/comic-upload`。
- 当前漫画 Part 作者页桌面端属于 `auto` 布局；主页面可滚动，右侧上传抽屉独立滚动。

小说系统：

- `Novel`、`NovelChapter`、`NovelChapterImage`、`NovelUserLink`、`NovelTextBuffer`。
- 作者归属在 Novel 层。
- 公共小说列表、详情、Markdown 阅读。
- Admin 小说后台可建 Novel/Chapter、重命名、正文、移动、owner、删除。
- Author 小说后台使用 `/api/author/novels`。
- Novel editor 使用正文 buffer：编辑已有章节先载入 buffer，新建章节可先保存 buffer，发布时写入正式 chapter。
- 已有小说 chapter 支持正文图片上传，返回 Markdown 图片链接用于插入正文。

互动系统：

- 通用评论表：`Comment`。
- 评论图片关系表：`CommentImage`，图片文件仍记录在 `Asset`。
- 当前有效 target type：
  - `user_page`
  - `novel`
  - `novel_chapter`
  - `comic_part`
  - `comic_chapter`
- 前端挂载点：
  - 用户页留言。
  - 小说详情评论。
  - 小说章节评论。
  - 漫画 Part 评论。
  - 漫画章节评论。
- Admin interactions 页面支持评论检索、上下文树、软删除、硬删除和图片预览。

收藏和通知：

- 收藏接口在 `/api/favorites`，支持小说和漫画 Part 的收藏状态、收藏和取消收藏。
- 通知接口在 `/api/notifications`，支持列表、未读数、单条已读、全部已读和删除。
- 通知由 OutboxEvent 派生；评论、收藏、章节发布/更新等事件写入 outbox 后，需要运行 processor 脚本才会生成 Notification。
- 事件处理脚本：`backend/scripts/process_outbox_events.py`。

上传系统：

- 正式上传根目录由 `UPLOADS_DIR` 控制，默认 `backend/uploads`。
- 漫画正式文件在 `UPLOADS_DIR/comics/...`。
- 小说封面和章节图片在 `UPLOADS_DIR/novels/...`。
- 用户头像在 `UPLOADS_DIR/user/{safe_username}/avatars/...`。
- 评论图片在 `UPLOADS_DIR/interactions/comments/{target_type}/{target_id}/{comment_id}/...`。
- 漫画待传区在 `backend/import_data/users/{user_id}/comic-staging/`。
- 漫画 PDF job 工作区在 `backend/import_data/users/{user_id}/comic-upload-jobs/{job_id}/`。
- 小说正文缓冲在数据库 `NovelTextBuffer` 表。

## 当前注意事项

- 所有模型仍集中在 `backend/app/models.py`。
- 当前没有迁移系统；既有 SQLite 表不能只依赖 `create_all` 修改字段。
- `SECRET_KEY` 必须由环境变量提供，否则后端启动失败。
- 前端 API base URL 统一在 `frontend/src/api/config.ts`。
- 生产同源部署时设置 `VITE_API_BASE_URL=""`，前端请求 `/api/...`。
- `UPLOADS_DIR` 必须和 Nginx `/uploads/` alias 指向同一目录。
- `npm run build` 当前可通过；`npm run lint` 当前会因既有 React hooks 规则问题失败，不能作为本轮改动是否正确的唯一判断。
- SQLite 适合当前个人站规模，但需要定时备份和谨慎迁移。
- 普通 SPA 路由当前没有全局滚动复位逻辑；从长页面底部进入新页面时，浏览器可能保留旧 scrollY，表现为新页面初始停在底部。
- 当前已知安全/权限边界缺口：
  - 收藏接口查漫画 Part 时未过滤 public visibility，猜到 slug 时可能收藏 private part。
  - 评论 target 校验只验证对象存在，未统一校验 public visibility，可能探测或评论 private 漫画对象。
  - 小说模型没有 `visibility` / `status`，公开小说接口默认全部可访问。
  - 漫画待传区图片上传主要按扩展名校验，未做真实图片解码校验。
  - access token 存在 localStorage，若将来引入 XSS，token 可被读取。
