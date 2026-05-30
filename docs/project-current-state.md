# Project Current State

本文档记录当前项目真实状态。新会话实现功能前先读这里。

## 技术栈

- Frontend：Vite + React + TypeScript + Tailwind。
- Backend：FastAPI + SQLModel + SQLite。
- Auth：JWT Bearer token。
- Uploads：本地文件系统，FastAPI 挂载 `/uploads`。
- Deployment：Linux + systemd + Nginx + SQLite + uploads + 备份脚本。

## 顶层结构

```txt
frontend/
├─ src/
│  ├─ api/
│  ├─ components/
│  ├─ pages/
│  ├─ styles/
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
```

## 前端页面

公共侧：

- `/`：Home。
- `/works`：作品入口。
- `/works/comics`：漫画列表。
- `/works/comics/:seriesSlug`：漫画系列详情。
- `/works/comics/:seriesSlug/:partSlug/:chapterSlug`：漫画阅读器。
- `/works/novels`：小说列表。
- `/works/novels/:novelSlug`：小说详情。
- `/works/novels/:novelSlug/:chapterSlug`：小说阅读器。
- `/users/:username`：用户页。
- `/register`：注册页。

后台侧：

- `/admin`、`/admin/login`。
- `/admin/users`。
- `/admin/comics`。
- `/admin/novels`。

创作者侧：

- `/creator`。
- `/creator/comics`。
- `/creator/comics/:seriesSlug`。
- `/creator/comics/:seriesSlug/:partSlug`。
- `/creator/novels`。
- `/creator/novels/:novelSlug`。
- `/creator/novels/:novelSlug/new-chapter`。
- `/creator/novels/:novelSlug/:chapterSlug/edit`。

## 后端入口和路由

入口：`backend/app/main.py`。

当前注册 router：

- `users_router`
- `auth_router`
- `user_admin_router`
- `comics_router`
- `comic_upload_router`
- `comic_author_router`
- `comic_admin_router`
- `novels_router`
- `novel_admin_router`
- `novel_author_router`

基础接口：

- `GET /`
- `GET /health`

## 当前主要业务

用户系统：

- `User` 模型。
- JWT 登录。
- `POST /api/auth/register`。
- `POST /api/auth/login`。
- `GET /api/auth/me`。
- Admin 用户管理和公开注册开关。

漫画系统：

- `ComicSeries`、`ComicPart`、`ComicChapter`、`ComicPage`。
- 作者归属在 `ComicPartUserLink`，即 Part 层 owner。
- 公共漫画列表、详情、阅读。
- Admin 漫画后台。
- Author 漫画后台，使用 `/api/author/comics`。
- Comic staging 上传区，使用 `/api/author/comic-upload`。

小说系统：

- `Novel`、`NovelChapter`。
- 作者归属在 `NovelUserLink`。
- 公共小说列表、详情、阅读。
- Admin 小说后台。
- Author 小说后台，使用 `/api/author/novels`。
- Novel text buffer，用于作者正文缓冲、载入和发布。

上传系统：

- 正式上传根目录由 `UPLOADS_DIR` 控制。
- 漫画正式文件在 `UPLOADS_DIR/comics/...`。
- 小说封面在 `UPLOADS_DIR/novels/...`。
- 漫画待传区在 `backend/import_data/users/{user_id}/comic-staging/`。
- 小说正文缓冲在数据库 `NovelTextBuffer` 表。

## 当前注意事项

- 所有模型仍集中在 `backend/app/models.py`。
- 当前没有迁移系统；既有 SQLite 表不能只依赖 `create_all` 修改字段。
- `SECRET_KEY` 必须由环境变量提供，否则后端启动失败。
- 前端 API base URL 统一在 `frontend/src/api/config.ts`。
- 生产同源部署时设置 `VITE_API_BASE_URL=""`，前端请求 `/api/...`。
- `UPLOADS_DIR` 必须和 Nginx `/uploads/` alias 指向同一目录。
- SQLite 适合当前个人站规模，但需要定时备份和谨慎迁移。
