# Operations And Deployment

本文档记录本地运行、部署前检查和低配服务器建议。它只描述当前项目现状和近期应做事项。

## 当前运行方式

前端在 `frontend/` 下：

```txt
npm run dev
npm run build
npm run lint
npm run preview
```

开发服务器配置在 `frontend/vite.config.ts`：

```txt
host: 127.0.0.1
port: 18000
strictPort: true
```

后端入口是：

```txt
backend/app/main.py
```

后端依赖文件：

```txt
backend/requirements.txt
```

后端启动前必须设置 `SECRET_KEY`，否则应用会主动启动失败。

## 当前数据和文件位置

SQLite：

```txt
backend/data/site.db
```

FastAPI 静态挂载：

```txt
URL: /uploads
dir: UPLOADS_DIR，未设置时默认 backend/uploads
```

漫画正式上传目录：

```txt
UPLOADS_DIR/comics/{series_slug}/{part_slug}/{chapter_slug}/001.jpg
```

创作者待传区：

```txt
backend/import_data/users/{user_id}/comic-staging/
```

### 上传目录

`backend/app/services/comic_admin.py` 当前使用：

```py
UPLOADS_DIR = Path(os.getenv("UPLOADS_DIR", BACKEND_DIR / "uploads")).resolve()
UPLOADS_ROOT = UPLOADS_DIR / "comics"
```

生产应显式设置 `UPLOADS_DIR`，并让 Nginx `/uploads/` alias 指向同一目录。

## 低配服务器建议

服务器资源：2 CPU、2GB 内存。

推荐部署形态：

```txt
Nginx
├── /          -> frontend/dist
├── /assets/   -> frontend/dist/assets
├── /uploads/  -> backend/uploads，Nginx 直接服务
└── /api/      -> proxy_pass http://127.0.0.1:18001
```

FastAPI：

```txt
uvicorn app.main:app --host 127.0.0.1 --port 18001 --workers 1
```

建议：

- 先用 1 worker，观察内存。
- 前端尽量本地或 CI 构建，只上传 `dist`。
- 服务器不要保留 `frontend/node_modules`。
- 图片静态服务交给 Nginx，不让 FastAPI 扛漫画页图片流量。

## 生产静态资源服务

生产环境建议由 Nginx 直接服务前端构建文件和漫画图片，FastAPI 只处理 API 请求。

推荐请求分工：

```txt
/             -> frontend/dist
/assets/      -> frontend/dist/assets
/uploads/     -> UPLOADS_DIR
/api/         -> FastAPI 127.0.0.1:18001
```
示例 Nginx 结构：
```
server {
    listen 80;
    server_name example.com;

    root /var/www/personal-site/frontend/dist;
    index index.html;

    location / {
        try_files $uri /index.html;
    }

    location /uploads/ {
        alias /var/www/personal-site/uploads/;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:18001/api/;
    }
}
```
注意：

location /uploads/ 的 alias 必须对应后端 UPLOADS_DIR。
如果 UPLOADS_DIR=/var/www/personal-site/uploads，则 Nginx alias 也应指向这个目录。
前端生产构建如果采用同源部署，建议设置：
```
export VITE_API_BASE_URL=""
npm run build
```

## 上传限制建议

当前创作者待传区限制：

```txt
STAGING_LIMIT_BYTES = 100 * 1024 * 1024
UPLOAD_FILE_LIMIT_BYTES = 20 * 1024 * 1024
```

当前规则：

- 单用户待传区上限 100MB。
- 单张图片上限 20MB。
- 支持 `jpg`、`jpeg`、`png`、`webp`。
- 后端会拒绝 `:Zone.Identifier` 附加文件。
- Nginx `client_max_body_size` 当前生产记录为 25M，应高于单文件 20MB。
- 后续考虑图片压缩和尺寸检查。

## 数据备份

当前项目使用 SQLite 数据库和本地上传目录保存主要数据。

需要备份的核心内容：

```txt
backend/data/site.db
backend/uploads/
```
已提供手动备份脚本：
```
cd backend
python scripts/backup_site_data.py
```
脚本会在以下目录生成带时间戳的展开备份和 `.tar.gz` 归档：
```
backend/backups/backup-YYYYMMDD-HHMMSS/
backend/backups/backup-YYYYMMDD-HHMMSS.tar.gz
```
其中包含：
```
site.db
uploads/
manifest.json
```

脚本当前支持环境变量和命令行参数：

```txt
DB_PATH / --db-path
UPLOADS_DIR / --uploads-dir
BACKUPS_DIR / --backups-dir
BACKUP_KEEP_LOCAL / --keep-local
BACKUP_REMOTE_DEST / --remote-dest
BACKUP_REMOTE_PORT / --remote-port
BACKUP_REMOTE_IDENTITY_FILE / --remote-identity-file
BACKUP_REMOTE_PLATFORM / --remote-platform
BACKUP_REMOTE_LATEST_NAME / --remote-latest-name
--remove-expanded
--remote-skip-mkdir
```

生产环境如果 `UPLOADS_DIR=/var/www/personal-site/uploads`，脚本会默认读取该环境变量；也可以显式传：

```bash
python scripts/backup_site_data.py --uploads-dir /var/www/personal-site/uploads
```

## SQLite 运营边界

当前 SQLite 可以支撑个人站低并发，但要明确边界：

- 没有迁移系统，修改模型字段前要写迁移计划。
- 数据库和 uploads 必须一起备份。
- 章节导入、删除涉及数据库和文件系统，失败时可能产生不一致，需要后续补一致性检查。

备份对象：

```txt
backend/data/site.db
backend/uploads/
```

待传区是否备份取决于业务需要：

```txt
backend/import_data/
```

## 注册限制

公开注册已增加轻量限制，目标是防止误操作和低强度滥用，不追求复杂验证码系统。

当前规则：

管理员可以在用户管理页面打开或关闭注册。
注册页有人类验证问题：你是人类吗？
用户需要输入：是
后端有轻量内存频率限制，防止短时间内连续提交注册请求。
管理员后台创建用户不受公开注册开关影响。

注册开关存储在数据库的 site_setting 表中：
```
key = registration_enabled
value = true / false
```
相关接口：
```
GET   /api/admin/users/settings/registration
PATCH /api/admin/users/settings/registration
```
说明：

该机制适合个人小站和朋友使用场景。
不接入第三方验证码。
服务重启后，内存频率限制会清空。
如果需要临时关闭公开注册，可直接在 admin users 页面关闭。

## Smoke Test 清单

部署后至少手工检查：

- `GET /health`
- 登录管理员。
- `GET /api/auth/me`
- 打开 `/works/comics`
- 打开 `/works/novels`
- 打开一个漫画系列详情页。
- 打开一个章节阅读页，确认图片加载。
- 打开 `/admin/comics`，确认漫画树加载。
- 打开 `/admin/novels`，确认小说树加载。
- 打开 `/admin/users`，确认用户列表加载。
- 打开 `/creator/comics`，确认 series 书架加载。
- 在创作者页测试新建 series、新建 part。
- 在 part 页测试右侧待传缓存区上传、预览、删除、清空和发布 chapter。

## Token 存储策略

当前前端使用 localStorage 保存 access token，并在 API 请求中通过 Authorization header 发送。

该方案对个人小站和朋友使用场景暂时可接受，原因是：

1. 当前没有富文本评论、公开 HTML 注入等高风险入口。
2. 注册入口已有开关和简单人类验证。
3. 网站主要用于朋友间使用，不按高强度公网系统设计。

注意事项：

1. 不要渲染未经净化的用户 HTML。
2. 不要把 token、生产 SECRET_KEY 或生产数据库内容贴到公开位置。
3. 如果后续加入评论、富文本、用户投稿说明等内容，再考虑迁移到 HttpOnly Secure Cookie。
4. Cookie 改造应作为单独阶段处理，不和部署前小修混在一起。

## 当前不应做的事

- 不要新增第二套认证系统。
- 不要新增重复的当前用户接口，已有 `GET /api/auth/me`。
- 不要绕过 `backend/app/services/comic_admin.py` 直接散写漫画导入/删除逻辑。
- 不要绕过 `backend/app/services/novel_admin.py` 直接散写小说排序、重命名、正文更新逻辑。
- 不要把生产数据库、上传文件、虚拟环境或 `node_modules` 放进 Git。
- 不要直接放宽 admin router 给 author 使用，应做专门 author router。
