# Project Current State

本文档是项目事实总览。新会话先读这里，尤其注意“已经存在”的能力，避免重复实现。

## 项目定位

这是一个个人站点，当前核心闭环是漫画内容展示和后台/创作者上传管理。

当前技术栈：

- 前端：Vite、React、React Router、Tailwind CSS。
- 后端：FastAPI、SQLModel、SQLite。
- 上传资源：本地文件系统，FastAPI 挂载 `/uploads`。

## 顶层结构

```txt
frontend/
├── src/
│   ├── api/          # 前端请求封装
│   ├── components/   # 共享组件
│   ├── pages/        # 路由页面
│   ├── data/         # 静态展示数据
│   ├── App.tsx       # 路由表
│   └── main.tsx      # React 入口
├── package.json
└── vite.config.ts

backend/
├── app/
│   ├── main.py       # FastAPI 入口、路由注册、/uploads 挂载
│   ├── database.py   # SQLite engine/session
│   ├── models.py     # 所有 SQLModel 表
│   ├── core/security.py
│   ├── dependencies/auth.py
│   ├── routers/
│   └── services/
├── scripts/
├── data/site.db
├── import_data/
└── uploads/

docs/
```

## 后端入口

入口文件：`backend/app/main.py`。

已经做了：

- 创建 FastAPI app。
- 启动时调用 `create_db_and_tables()`。
- 注册 CORS。
- 挂载 `/uploads` 到 `backend/uploads`。
- 注册所有 routers。
- 提供 `GET /` 和 `GET /health`。

已注册 router：

```py
users_router
comics_router
comic_upload_router
auth_router
comic_admin_router
user_admin_router
```

## 已有数据模型

所有模型都在 `backend/app/models.py`。当前没有拆分模型目录。

已有表：

- `Asset`：上传资源，保存文件名、MIME、大小、URL、用途。
- `User`：用户，含 `username`、`display_name`、`password_hash`、`role`、`is_active`、`bio`。
- `ComicSeries`：漫画系列。
- `ComicPart`：系列下的分部、卷、篇章。
- `ComicChapter`：分部下的章节。
- `ComicPage`：章节下的页面，关联 `Asset`。
- `ComicPartUserLink`：part 和用户的关系，目前用于 owner。
- `ComicUploadImage`：创作者待传区图片。

核心关系：

```txt
ComicSeries
└── ComicPart
    └── ComicChapter
        └── ComicPage
            └── Asset

User
└── ComicPartUserLink(role="owner")
    └── ComicPart
```

## 已有认证能力

不要重复实现认证接口。已经存在：

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`

后端认证相关文件：

- `backend/app/core/security.py`
  - `hash_password`
  - `verify_password`
  - `create_access_token`
  - `decode_access_token`

- `backend/app/dependencies/auth.py`
  - `require_current_user`
  - `require_admin_user`

前端认证封装：

- `frontend/src/api/auth.ts`
  - `login`
  - `register`
  - `getMe`
  - `saveAccessToken`
  - `getAccessToken`
  - `clearAccessToken`

当前 token 存在 `localStorage`，key 是 `personal_site_access_token`。

## 已有页面

路由在 `frontend/src/App.tsx`。

公开页面：

- `/`
- `/projects`
- `/works`
- `/register`
- `/users/:username`
- `/works/comics`
- `/works/comics/:seriesSlug`
- `/works/comics/:seriesSlug/:partSlug/:chapterSlug`
- `/about`

创作者页面：

- `/creator/comics`
- `/creator/comics/:seriesSlug`
- `/creator/comics/:seriesSlug/:partSlug`

管理页面：

- `/admin`
- `/admin/login`
- `/admin/comics`
- `/admin/users`

## 已有视觉风格

视觉规范单独记录在：

```txt
docs/visual-style-guide.md
```

已有样式入口：

```txt
frontend/src/styles/tokens.css
frontend/src/styles/page.css
frontend/src/styles/auth.css
frontend/src/styles/admin.css
```

不要在新页面里重新发明一套颜色。新增 UI 时优先复用 token 和通用 class。

## 已有业务闭环

公开漫画：

- 列出公开漫画系列。
- 查看某个公开系列下的公开 part 和 chapter。
- 阅读某个公开章节的漫画页。
- 图片 URL 存在 `Asset.url`，前端通过 API base URL 拼成完整地址。

认证与用户：

- 注册 reader。
- 登录。
- 获取当前登录用户。
- 用户主页。
- 管理员创建用户、编辑用户、停用用户、重置密码、删除用户。

漫画管理：

- 管理员查看全站漫画树。
- 管理员上传章节图片并创建 series/part/chapter。
- 管理员删除 series/part/chapter。
- 管理员移动 chapter 顺序。
- 管理员重命名 series/part/chapter。
- 管理员设置 series/part 简介。
- 管理员上传 series/part 封面。
- 管理员设置 part owner。

创作者上传：

- 登录用户可以把图片上传到自己的待传区。
- 可以预览待传图片。
- 可以删除单张、批量删除、清空待传区。
- 可以按顺序发布为某个已有 part 的新 chapter。
- 发布前会检查当前用户是否是该 part 的 owner。

## 重要现状和坑

### API Base URL 仍硬编码

多个前端文件仍写着：

```ts
const API_BASE_URL = "http://127.0.0.1:18001";
```

上线前必须统一成环境变量或同源相对路径。

### 后端 SECRET_KEY 仍是开发值

`backend/app/core/security.py` 中仍有：

```py
SECRET_KEY = "dev-secret-key-change-me"
```

公网部署前必须改成环境变量。

### CORS 仍是开发配置

`backend/app/main.py` 当前只允许：

```txt
http://127.0.0.1:18000
http://localhost:18000
```

上线前要配置真实域名，或使用同源反代避免跨域。

### author 页面目前复用 admin API

`frontend/src/api/authorComics.ts` 当前调用 `/api/admin/comics/...`。但后端 `comic_admin` router 使用 `require_admin_user`。

结果：

- 真正的 `author` 角色不一定能使用这些页面。
- 不要为了 author 直接放宽 admin router。

正确方向：

- 新增专门的 `/api/author/comics` router。
- 后端按 `ComicPartUserLink(role="owner")` 限制 author 只能操作自己的 part。

### 上传路径有相对目录风险

`backend/app/services/comic_admin.py` 当前：

```py
UPLOADS_ROOT = Path("uploads/comics")
```

这依赖进程工作目录。生产用 systemd、supervisor 或 Docker 启动时，可能写到错误位置。应统一成绝对路径配置。

### 后端依赖声明缺失

当前没有看到后端 `requirements.txt` 或 `pyproject.toml`。部署前必须补。

### `.gitignore` 有冲突标记

当前 `.gitignore` 仍存在合并冲突标记。部署、提交或清理生成物前应先修。

## 常见任务入口

新增公开 API：

- 后端：`backend/app/routers/`
- 前端封装：`frontend/src/api/`
- 页面：`frontend/src/pages/`
- 同步更新：`docs/api-reference.md`

新增数据字段：

- 模型：`backend/app/models.py`
- 注意当前没有迁移系统，不能只依赖 `create_all` 修改既有表。

修改认证：

- 先看 `backend/app/routers/auth.py`
- 再看 `backend/app/dependencies/auth.py`
- 再看 `frontend/src/api/auth.ts`
- 不要新增重复的 `/me` 或 token 校验接口，已有 `GET /api/auth/me`。

修改漫画导入、删除、排序、封面：

- 先看 `backend/app/services/comic_admin.py`
- router 和 scripts 应复用 service，避免重复写文件/数据库逻辑。

修改创作者待传区：

- 后端 router：`backend/app/routers/comic_upload.py`
- 后端 service：`backend/app/services/comic_upload.py`
- 前端 API：`frontend/src/api/authorComicUpload.ts`
