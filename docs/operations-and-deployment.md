# Operations And Deployment

本文档记录当前项目的本地运行、环境变量、生产部署、备份方式和验证现状。

## 本地运行

前端：

```bash
cd frontend
npm run dev
npm run build
npm run lint
npm run preview
```

Vite 开发服务器配置来自 `frontend/vite.config.ts`：

```txt
host: 127.0.0.1
port: 18000
strictPort: true
```

后端：

```bash
cd backend
export SECRET_KEY="dev-local-secret-change-before-public-deploy"
uvicorn app.main:app --host 127.0.0.1 --port 18001
```

后端依赖：

```txt
backend/requirements.txt
```

## 当前验证状态

当前已知：

- `npm run build` 可通过。
- `npm run lint` 当前会因既有 React hooks 规则失败，主要是 `react-hooks/set-state-in-effect`、`react-hooks/exhaustive-deps` 和部分函数声明顺序问题；这不是单一页面改动的可靠回归信号。
- `git diff --check` 可用于检查空白问题。

后续如果要恢复 lint 作为强门禁，需要单独安排一次 hooks 规则修复或调整 ESLint 配置。

## 环境变量

### Backend

`SECRET_KEY`

- JWT 签名密钥。
- 必须设置。
- 缺失或等于 `dev-secret-key-change-me` 时后端启动失败。

`ACCESS_TOKEN_EXPIRE_MINUTES`

- token 有效期，单位分钟。
- 默认 7 天。

`CORS_ALLOW_ORIGINS`

- 允许的前端来源，多个值用英文逗号分隔。
- 本地默认包含 `http://127.0.0.1:18000` 和 `http://localhost:18000`。
- 生产同源部署时通常由 Nginx 反代 `/api/`。

`UPLOADS_DIR`

- 上传文件根目录。
- 未设置时默认 `backend/uploads`。
- 生产必须和 Nginx `/uploads/` alias 指向同一个目录。

备份脚本变量：

- `DB_PATH`
- `UPLOADS_DIR`
- `BACKUPS_DIR`
- `BACKUP_KEEP_LOCAL`
- `BACKUP_REMOTE_DEST`
- `BACKUP_REMOTE_PORT`
- `BACKUP_REMOTE_IDENTITY_FILE`
- `BACKUP_REMOTE_PLATFORM`
- `BACKUP_REMOTE_LATEST_NAME`
- `BACKUP_REMOTE_SKIP_MKDIR`

### Frontend

`VITE_API_BASE_URL`

- 默认 `http://127.0.0.1:18001`。
- 生产同源构建设置为空字符串：

```bash
VITE_API_BASE_URL="" npm run build
```

这样前端会请求 `/api/...`。

## 当前数据和文件位置

SQLite 默认路径：

```txt
backend/data/site.db
```

FastAPI 静态挂载：

```txt
URL: /uploads
dir: UPLOADS_DIR
```

正式上传目录：

```txt
UPLOADS_DIR/comics/
UPLOADS_DIR/novels/
UPLOADS_DIR/user/
UPLOADS_DIR/interactions/comments/
```

漫画待传区：

```txt
backend/import_data/users/{user_id}/comic-staging/
```

小说正文 buffer：

```txt
SQLite: novel_text_buffer
```

## 生产部署形态

推荐形态：

```txt
Nginx /         -> frontend/dist
Nginx /api/     -> FastAPI 127.0.0.1:18001
Nginx /health   -> FastAPI /health
Nginx /uploads/ -> UPLOADS_DIR
FastAPI         -> systemd service
SQLite          -> backend/data/site.db 或生产指定路径
```

低配服务器建议：

- FastAPI 1 worker。
- SQLite 继续使用。
- 前端本地构建 dist 后上传。
- uploads 放在项目代码目录外更便于备份和迁移。
- `client_max_body_size` 应高于后端最大单文件上传上限。

当前上传限制参考：

- 漫画待传区单文件 20MB，单用户待传区 100MB。
- 用户头像单文件 5MB。
- 评论图片单张 10MB，单评论总计 30MB。
- 小说章节图片单张 10MB。

## systemd 要点

后端服务需要提供：

- 工作目录：`backend`。
- 虚拟环境中的 `uvicorn`。
- `SECRET_KEY`。
- `CORS_ALLOW_ORIGINS`。
- `UPLOADS_DIR`。

服务应监听：

```txt
127.0.0.1:18001
```

## 备份

脚本：

```txt
backend/scripts/backup_site_data.py
```

备份对象：

- SQLite 数据库。
- uploads 目录。

脚本支持：

- SQLite online backup。
- uploads 复制。
- manifest。
- tar.gz 归档。
- 本地保留数量。
- 可选远程复制。
- 远程 latest 文件名。
- POSIX / Windows OpenSSH 远端路径处理。

生产建议：

- 用 cron 或 systemd timer 定时运行。
- 定期做恢复演练。
- 备份目录不要只放在同一块盘的同一个项目目录下。
- 注意 uploads 里包含用户头像、评论图、小说图和漫画图，不应只备份 `comics/`。

## SQLite 运营边界

当前个人站可以继续使用 SQLite。

注意：

- 避免长事务。
- 避免高并发写入。
- 上线前后备份数据库。
- 改模型字段前先设计迁移。
- `create_all` 只创建不存在的表，不会自动迁移已有表结构。

## 辅助脚本

```txt
backend/scripts/create_user.py
backend/scripts/import_comic_chapter.py
backend/scripts/delete_comic_chapter.py
backend/scripts/backup_site_data.py
backend/app/seed.py
```

说明：

- `create_user.py` 可创建 reader/author/admin 用户。
- `import_comic_chapter.py` 和 `delete_comic_chapter.py` 是开发期漫画数据脚本，默认参数写在脚本里，生产使用前必须确认目标。
- `seed.py` 是开发期 demo 数据脚本。

## 当前不应做的事

- 不引入复杂部署平台。
- 不把 uploads 纳入 Git。
- 不把 `.env`、数据库、虚拟环境、构建产物纳入 Git。
- 不在业务代码里硬编码生产域名或上传绝对路径。
- 不直接在生产库上试验模型字段变更。
