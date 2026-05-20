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

当前文档中没有可靠的后端依赖声明文件。部署前必须补 `requirements.txt` 或 `pyproject.toml`。

## 当前数据和文件位置

SQLite：

```txt
backend/data/site.db
```

FastAPI 静态挂载：

```txt
URL: /uploads
dir: backend/uploads
```

漫画正式上传目录：

```txt
backend/uploads/comics/{series_slug}/{part_slug}/{chapter_slug}/001.jpg
```

创作者待传区：

```txt
backend/import_data/users/{user_id}/comic-staging/
```

## 部署前必须修

### `.gitignore`

当前 `.gitignore` 有合并冲突标记。先修这个，再谈部署。

至少忽略：

```txt
frontend/node_modules/
frontend/dist/
backend/.venv/
__pycache__/
*.pyc
backend/data/*.db
backend/uploads/
backend/import_data/
.env
.env.*
```

注意：如果需要保留 `.env.example`，忽略规则要排除它。

### 后端依赖

当前缺少后端依赖声明。建议先补最小依赖：

```txt
fastapi
uvicorn
sqlmodel
python-multipart
passlib[bcrypt]
python-jose
```

实际版本应以当前虚拟环境可运行为准。

### SECRET_KEY

当前 `backend/app/core/security.py` 仍硬编码开发密钥。生产必须从环境变量读取，并在缺失时启动失败。

### CORS

当前 `backend/app/main.py` 只允许本地前端。生产要么：

- 前后端同源，由 Nginx 反代 `/api`，尽量避免跨域。
- 或从环境变量读取真实 HTTPS 域名列表。

### API Base URL

当前前端多个文件硬编码 `http://127.0.0.1:18001`。生产构建前必须统一。

推荐：

```txt
VITE_API_BASE_URL=
```

同源部署时可以为空字符串，然后请求 `/api/...` 和 `/uploads/...`。

### 上传目录

`backend/app/services/comic_admin.py` 当前使用相对路径：

```py
UPLOADS_ROOT = Path("uploads/comics")
```

生产必须改成绝对路径或统一配置，否则 systemd/Docker 工作目录变化会导致图片写到错误目录。

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

## 上传限制建议

当前创作者待传区上限是 500MB：

```txt
STAGING_LIMIT_BYTES = 500 * 1024 * 1024
```

对 2GB 内存的小服务器偏高。建议上线前：

- 单用户待传区降到 50MB 到 100MB。
- 增加单文件大小上限。
- 增加一次上传文件数量上限。
- Nginx `client_max_body_size` 与后端限制保持一致。
- 后续考虑图片压缩和尺寸检查。

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

## Smoke Test 清单

部署后至少手工检查：

- `GET /health`
- 登录管理员。
- `GET /api/auth/me`
- 打开 `/works/comics`
- 打开一个漫画系列详情页。
- 打开一个章节阅读页，确认图片加载。
- 打开 `/admin/comics`，确认漫画树加载。
- 打开 `/admin/users`，确认用户列表加载。
- 如果保留创作者上传，测试待传区上传、预览、删除。

## 当前不应做的事

- 不要新增第二套认证系统。
- 不要新增重复的当前用户接口，已有 `GET /api/auth/me`。
- 不要绕过 `backend/app/services/comic_admin.py` 直接散写漫画导入/删除逻辑。
- 不要把生产数据库、上传文件、虚拟环境或 `node_modules` 放进 Git。
- 不要直接放宽 admin router 给 author 使用，应做专门 author router。

