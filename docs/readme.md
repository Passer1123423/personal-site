# Project Docs

本文档集合描述当前项目的实际状态。文档应优先记录已经存在的代码、接口、字段和工作流；尚未实现的设想不要写成事实。

## 当前技术栈

后端：

- FastAPI
- SQLModel
- SQLite
- 静态文件由 FastAPI `StaticFiles` 挂载

前端：

- Vite
- React
- React Router
- Tailwind CSS

## 当前目录结构

```txt
backend/
├── app/
│   ├── main.py
│   ├── database.py
│   ├── models.py
│   ├── seed.py
│   ├── dependencies/
│   │   └── auth.py
│   ├── routers/
│   │   ├── auth.py
│   │   ├── comics.py
│   │   ├── comic_admin.py
│   │   ├── user_admin.py
│   │   └── users.py
│   └── services/
│       └── comic_admin.py
├── data/
│   └── site.db
├── scripts/
│   ├── create_user.py
│   ├── import_comic_chapter.py
│   └── delete_comic_chapter.py
└── uploads/
    └── comics/

frontend/
├── package.json
├── src/
│   ├── App.tsx
│   ├── api/
│   │   ├── auth.ts
│   │   ├── comics.ts
│   │   ├── adminComics.ts
│   │   ├── adminUsers.ts
│   │   └── users.ts
│   └── pages/
│       ├── AdminHomePage.tsx
│       ├── AdminComicsPage.tsx
│       ├── AdminUsersPage.tsx
│       ├── AdminLoginPage.tsx
│       ├── RegisterPage.tsx
│       ├── UserPage.tsx
│       ├── ComicsPage.tsx
│       ├── ComicSeriesPage.tsx
│       └── ComicReaderPage.tsx
└── dist/

docs/
```

## 后端入口

后端入口是 `backend/app/main.py`。

职责：

- 创建 FastAPI app
- 启动时调用 `create_db_and_tables()`
- 注册 CORS
- 挂载 `/uploads`
- 注册认证 router
- 注册公开用户 router
- 注册公开漫画 router
- 注册漫画 admin router
- 注册用户 admin router
- 提供 `/` 和 `/health`

已注册 router：

```txt
app.include_router(users_router)
app.include_router(comics_router)
app.include_router(auth_router)
app.include_router(comic_admin_router)
app.include_router(user_admin_router)
```

## 数据库与静态资源

数据库配置在 `backend/app/database.py`。

当前 SQLite 文件：

```txt
backend/data/site.db
```

静态资源目录：

```txt
backend/uploads
```

浏览器访问路径：

```txt
/uploads/...
```

实际漫画页图片一般位于：

```txt
backend/uploads/comics/{series_slug}/{part_slug}/{chapter_slug}/{page_no}.{ext}
```

## 模型位置

当前没有 `backend/app/models/` 目录。

所有 SQLModel 表定义集中在：

```txt
backend/app/models.py
```

当前模型：

- `Asset`
- `User`
- `ComicSeries`
- `ComicPart`
- `ComicChapter`
- `ComicPage`
- `ComicPartUserLink`

## 当前可用页面

公开页面：

```txt
/
/projects
/works
/works/comics
/works/comics/:seriesSlug
/works/comics/:seriesSlug/:partSlug/:chapterSlug
/register
/users/:username
/about
```

后台页面：

```txt
/admin
/admin/comics
/admin/users
/admin/login
```

## 当前 API 分组

公开漫画 API：

```txt
/api/comics
```

认证 API：

```txt
/api/auth
```

公开用户 API：

```txt
/api/users
```

漫画后台 API：

```txt
/api/admin/comics
```

用户后台 API：

```txt
/api/admin/users
```

前端当前 API base URL 写在：

```txt
frontend/src/api/comics.ts
frontend/src/api/adminComics.ts
frontend/src/api/auth.ts
frontend/src/api/users.ts
frontend/src/api/adminUsers.ts
```

当前值：

```txt
http://127.0.0.1:18001
```

如果后端实际运行端口变化，需要同步修改这些文件，或后续改成环境变量配置。

## 当前模块状态

漫画模块已经有前后端闭环：

- 公开漫画列表
- 系列详情
- 章节阅读
- 后台漫画树
- 后台上传章节
- 后台创建 series / part
- 后台删除 series / part / chapter
- 后台移动 chapter 顺序
- 后台重命名 series / part / chapter
- 后台设置 part owner
- 上传图片落盘到 `backend/uploads/comics`
- 数据索引保存到 SQLite

用户与认证模块当前具备：

- 注册 reader 用户
- 登录并保存 bearer token
- 获取当前用户
- 公开用户主页
- 管理员创建、编辑、停用、重置密码、删除用户

项目页、首页、Works 页等已存在前端页面，但漫画以外的内容仍主要是静态展示或入口页。

## 文档索引

- `data-model.md`：当前数据库模型和字段命名
- `api-design.md`：当前公开 API 和 admin API
- `service-design.md`：`comic_admin.py` service 函数职责和签名
- `admin-comics-current.md`：漫画后台当前实现链路
- `content-workflow.md`：漫画内容上传、阅读、删除工作流
- `page-design.md`：当前前端路由和页面状态
- `storage-structure.md`：上传资源目录结构
- `roadmap.md`：当前文档不展开长期展望，仅保留事实型待补齐项
