# Deployment Readiness Audit

本次审计目标：在服务器资源较紧张的前提下，检查项目上线前需要补足、优化和调整的地方。

约束：除新增本文档外，本次没有修改项目文件；没有运行构建、测试、服务启动或会写入项目目录的命令。

## 结论

项目已经具备本地最小闭环，但还不适合直接部署到公网。主要阻塞不是业务功能，而是生产配置、认证安全、路径稳定性、依赖声明和仓库卫生。

建议上线前按以下顺序处理：

1. 修复 `.gitignore` 冲突并清理已纳入版本库的数据库、`__pycache__` 等生成物。
2. 把后端密钥、CORS、前端 API Base URL 改成环境变量。
3. 明确后端依赖文件和启动方式。
4. 修复上传目录的相对路径问题，确保 API 进程从任何工作目录启动都写到同一个 `backend/uploads`。
5. 收紧上传限制和静态资源服务策略，避免 2C/2G 服务器被大文件或并发上传拖垮。
6. 梳理 author 与 admin 权限边界。
7. 再补部署文档、备份恢复方案、最小 smoke test。

## P0：部署前必须处理

### 1. `.gitignore` 存在合并冲突标记

证据：`.gitignore` 仍包含 `<<<<<<< HEAD`、`=======`、`>>>>>>> bb8e3cf`。

影响：

- Git 忽略规则实际处于不可信状态。
- 生成物、数据库、虚拟环境、上传文件后续可能继续被误跟踪。
- 这会直接影响部署包体积、备份边界和敏感数据管理。

建议：

- 保留清晰的分区规则。
- 至少忽略：`frontend/node_modules/`、`frontend/dist/`、`backend/.venv/`、`__pycache__/`、`*.pyc`、`backend/data/*.db`、`backend/uploads/`、`backend/import_data/`、`.env*`。
- 如果生产数据库和上传文件要放在项目目录外，文档中也应写明实际路径。

### 2. 生产密钥硬编码

证据：`backend/app/core/security.py` 中 `SECRET_KEY = "dev-secret-key-change-me"`。

影响：

- 任何拿到代码的人都可以伪造 JWT。
- 已签发 token 在换密钥前都不可信。

建议：

- 从环境变量读取 `SECRET_KEY`。
- 启动时如果缺失或仍是开发默认值，直接失败。
- 同时把 token 有效期也做成配置，公网环境建议短于当前 7 天，或者配合刷新机制。

### 3. 前端 API 地址硬编码到本机

证据：

- `frontend/src/api/auth.ts`
- `frontend/src/api/comics.ts`
- `frontend/src/api/users.ts`
- `frontend/src/api/adminComics.ts`
- `frontend/src/api/adminUsers.ts`
- `frontend/src/api/authorComics.ts`
- `frontend/src/api/authorComicUpload.ts`
- `frontend/src/components/creator/CreatorBookCard.tsx`
- `frontend/src/pages/CreatorComicPartPage.tsx`

这些位置直接使用 `http://127.0.0.1:18001`。

影响：

- 构建后的前端在真实用户浏览器里会请求用户自己机器的 `127.0.0.1`，公网部署后 API 不可用。
- 同一配置散落多处，后续容易漏改。

建议：

- 新增统一 API 配置模块，例如 `src/api/config.ts`。
- 使用 `import.meta.env.VITE_API_BASE_URL`，生产环境可设为同源空字符串或真实 API 域名。
- 所有图片 URL 解析统一走同一个 `resolveAssetUrl`。

### 4. CORS 仍是开发白名单

证据：`backend/app/main.py` 只允许 `http://127.0.0.1:18000` 和 `http://localhost:18000`。

影响：

- 真实域名访问会被 CORS 拦截。
- 如果临时改成 `"*"` 且继续带认证头，会引入安全风险。

建议：

- 从环境变量读取允许的 origins。
- 如果前后端同源部署，优先通过 Nginx 反代避免跨域。
- 如果跨域部署，只允许明确的 HTTPS 域名。

### 5. 后端缺少依赖声明

证据：未发现 `backend/requirements.txt`、`pyproject.toml`、`poetry.lock`、`uv.lock` 等文件。

影响：

- 服务器无法稳定复现当前后端环境。
- 依赖版本漂移会导致部署后运行结果与本地不同。

建议：

- 先补最小 `requirements.txt` 或 `pyproject.toml`。
- 至少覆盖：`fastapi`、`uvicorn`、`sqlmodel`、`python-multipart`、`passlib[bcrypt]`、`python-jose`。
- 记录 Python 版本和启动命令。

### 6. 上传目录使用相对路径，部署时容易写错位置

证据：`backend/app/services/comic_admin.py` 中 `UPLOADS_ROOT = Path("uploads/comics")`。

影响：

- 如果用 systemd、supervisor、Docker 或不同工作目录启动，上传文件可能写到进程工作目录下的 `uploads/comics`，而不是 `backend/uploads/comics`。
- `main.py` 挂载的是 `backend/uploads`，写错位置后前端图片会 404。

建议：

- 所有上传根目录使用绝对路径配置。
- 默认值应从 `backend` 目录推导，或由环境变量 `UPLOADS_DIR` 显式指定。
- `StaticFiles` 挂载目录和写入目录必须来自同一个配置源。

## P1：上线早期应处理

### 7. 上传限制对 2C/2G 服务器偏高

证据：`backend/app/services/comic_upload.py` 中 `STAGING_LIMIT_BYTES = 500 * 1024 * 1024`，保存时按 1MB chunk 写入。

影响：

- 单用户 500MB 待传区过高；多个用户并发会迅速吃满磁盘和带宽。
- 当前只按扩展名判断图片格式，没有做实际内容校验、尺寸限制或像素数限制。

建议：

- 先把单用户待传区降到 50MB 到 100MB。
- 增加单文件大小上限、文件数量上限、允许 MIME 类型校验。
- Nginx 层配置 `client_max_body_size`，应用层保持一致。
- 上传后考虑异步压缩封面和阅读页图片，避免原图直接服务。

### 8. 静态图片由 FastAPI 直接服务，长期不适合大量漫画页

证据：`backend/app/main.py` 使用 `StaticFiles(directory=UPLOADS_DIR)` 挂载 `/uploads`。

影响：

- 少量访问没问题，但漫画阅读页会连续加载多张图片，FastAPI 进程会承担大量静态文件 I/O。
- 低配服务器上，API 和图片共用同一进程会互相影响。

建议：

- 生产环境用 Nginx 直接服务 `/uploads/`。
- FastAPI 只负责 API。
- 为图片加缓存头；封面和章节页 URL 含文件名或 uuid 时可以长缓存。

### 9. SQLite 可用，但需要写入边界和备份策略

证据：`backend/app/database.py` 固定使用 `backend/data/site.db`，启动时 `SQLModel.metadata.create_all(engine)`。

影响：

- SQLite 适合当前个人站和低并发，但上传、发布、删除章节都涉及多次数据库写入和文件操作。
- 现有代码没有迁移系统；模型变化时不能只依赖 `create_all`。

建议：

- 短期继续 SQLite 可以接受。
- 开启明确备份：`site.db` 与 `uploads` 同步快照，且备份前最好暂停写入或使用 SQLite backup API。
- 后续模型变更前引入迁移方案，或至少写一次性迁移脚本。
- API 层避免长事务；文件复制和 DB 写入失败时要有补偿清理。

### 10. author 页面调用 admin API，权限边界不成立

证据：

- `backend/app/routers/comic_admin.py` 整个 router 使用 `dependencies=[Depends(require_admin_user)]`。
- `frontend/src/api/authorComics.ts` 的创作者接口调用 `/api/admin/comics/tree`、rename、move、delete 等 admin 路径。

影响：

- `author` 角色无法正常使用这些创作者页面。
- 如果为了让 author 可用而放宽 admin router，会扩大权限面。

建议：

- 单独提供 `/api/author/comics` router。
- 后端按 `ComicPartUserLink owner` 限制作者只能查看和操作自己拥有的 part。
- 管理员后台继续保留全量权限。

### 11. 注册接口公开开放

证据：`POST /api/auth/register` 无验证码、邀请码、频率限制或管理员开关。

影响：

- 公网后容易被批量注册。
- 即使默认角色是 `reader`，也会占用数据库并增加管理成本。

建议：

- 如果个人站不需要开放注册，先用环境变量关闭注册。
- 如果需要开放，至少增加频率限制和基本反滥用策略。

### 12. token 存在 localStorage

证据：`frontend/src/api/auth.ts` 使用 `localStorage` 保存 `personal_site_access_token`。

影响：

- 一旦前端出现 XSS，token 容易被读取。
- 当前站点主要是个人后台，风险取决于后续是否引入富文本、评论、用户投稿内容。

建议：

- 短期可以接受，但必须避免渲染未净化 HTML。
- 中期改为 HttpOnly Secure Cookie，并配合 CSRF 策略。

## P2：资源与仓库卫生

### 13. 仓库中存在不应跟踪的生成物和本地数据

证据：

- `git ls-files` 显示已跟踪 `backend/data/site.db` 和 `backend/data/site.backup.20260511-020702.db`。
- `git ls-files` 显示多个 `__pycache__/*.pyc`。
- 工作区存在 `frontend/node_modules`、`frontend/dist`、`backend/.venv`、`backend/uploads`、`backend/import_data`。

影响：

- 仓库体积和部署包会膨胀。
- 数据库可能包含真实用户、密码哈希、内容索引，不应作为代码发布。
- pyc 和本地备份会制造无意义变更。

建议：

- 修好 `.gitignore` 后，从版本库移除这些生成物和本地数据。
- 生产数据走备份系统，不走 Git。
- 上传样例如果需要保留，放到明确的 fixture 或 docs asset 目录，避免和生产上传目录混在一起。

### 14. 当前项目体积主要来自本地依赖

只读估算：

- 项目总量约 293MB。
- `frontend` 约 185MB。
- `frontend/node_modules` 约 181MB。
- `frontend/dist` 约 404KB。
- `backend` 约 99MB。

建议：

- 部署前端只需要 `dist`。
- 后端服务器上单独创建虚拟环境，不把本地 `.venv` 打包上传。
- 如果服务器内存只有 2GB，优先本地构建前端后上传 `dist`，服务器只运行 FastAPI 和 Nginx。

### 15. 存在 Windows Zone.Identifier 文件

证据：发现多个 `*:Zone.Identifier` 文件，例如前端 public 图片和后端 uploads/demo 下的文件。

影响：

- 无业务价值。
- 可能干扰静态资源扫描、部署同步和备份。

建议：

- 忽略并清理这类文件。
- 上传处理里已经部分跳过该命名，仓库层面也应避免纳入。

## P2：代码质量与维护

### 16. admin service 提交粒度较碎，失败补偿不足

证据：`backend/app/services/comic_admin.py` 的导入流程中，创建 series、part、chapter、asset、page 都多次 `commit()`；文件复制和数据库写入交织。

影响：

- 中途失败可能留下孤儿文件、孤儿 Asset 或不完整 chapter。
- 删除流程也有多次 commit，异常时可能出现部分删除状态。

建议：

- 将一次章节发布视为一个业务事务。
- 文件先写入临时目录，数据库成功后再原子移动到正式目录。
- 或保留当前实现，但增加失败清理和一致性检查脚本。

### 17. 日志仍使用 print

证据：`backend/app/services/comic_admin.py` 和 scripts 中有多处 `print()`。

影响：

- systemd / uvicorn 下可以看到输出，但缺少级别、上下文和结构化信息。
- 排查生产问题不够稳定。

建议：

- 后端使用 `logging`。
- 至少区分 info、warning、error，并在导入、删除、权限拒绝、上传失败处记录关键信息。

### 18. 当前没有自动化测试或 smoke test

证据：未发现测试文件。

影响：

- 部署前无法快速确认登录、漫画列表、阅读页、上传、删除等核心闭环是否仍可用。

建议：

- 先补最小 smoke test 清单即可，不必一开始做完整测试体系。
- 最小检查：`/health`、登录、`/api/auth/me`、公开漫画列表、单章阅读、admin tree。
- 后续再补 service 层单元测试，尤其是导入、删除、排序、owner 权限。

### 19. 文档已较完整，但部署文档缺失

现有 docs 已记录数据模型、API、上传结构和当前工作流，但缺少真正服务器部署说明。

建议新增部署文档，覆盖：

- 服务器目录规划。
- 环境变量。
- Python 虚拟环境创建。
- 后端启动命令。
- systemd service。
- Nginx 反代与静态资源配置。
- SQLite 和 uploads 备份。
- 回滚方式。
- 日常运维命令。

## 低配服务器部署建议

推荐形态：

```txt
Nginx
├── /              -> frontend/dist 静态文件
├── /assets/       -> frontend/dist/assets 静态文件
├── /uploads/      -> backend/uploads 静态文件，Nginx 直接服务
└── /api/          -> 反代到 FastAPI 127.0.0.1:18001
```

后端：

```txt
uvicorn app.main:app --host 127.0.0.1 --port 18001 --workers 1
```

说明：

- 2C/2G 下先用 1 个 worker，避免内存被复制消耗。
- 如果访问量上来，再考虑 2 workers，但要观察内存。
- 前端构建建议在本地或 CI 完成，不在服务器上长期保留 `node_modules`。
- 图片由 Nginx 服务，FastAPI 不承担漫画页静态文件流量。

## 建议的上线前检查清单

- `.gitignore` 无冲突标记。
- 生产构建不包含 `.env`、SQLite 数据库、上传文件、虚拟环境、`node_modules`。
- 后端有依赖声明文件。
- `SECRET_KEY` 来自环境变量。
- `CORS` 允许真实域名。
- 前端 API base URL 可通过环境变量配置。
- `/uploads` 写入目录和静态服务目录一致。
- 注册策略已确认：关闭、邀请制或开放。
- 上传大小限制符合服务器资源。
- 数据库和 uploads 有备份脚本或明确手工流程。
- 至少完成一次 smoke test。

