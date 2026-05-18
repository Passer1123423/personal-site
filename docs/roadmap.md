# Roadmap Notes

本文档当前只记录与项目现状直接相关的待补齐项，不展开长期产品展望。

## 当前事实

漫画模块已经具备本地前后端闭环：

- 公开列表
- 系列详情
- 章节阅读
- 后台上传章节
- 后台删除内容
- 后台移动章节顺序
- 后台重命名漫画内容
- 后台设置 part owner
- SQLite 数据索引
- `backend/uploads/comics` 静态资源存储

用户模块已经具备注册、登录、公开用户页和管理员用户管理。漫画以外的内容模块当前主要是前端页面或静态数据。

## 待补齐的工程信息

这些项不是功能展望，而是为了让项目更容易被本地运行、维护和交接。

### 后端依赖声明

当前没有看到后端依赖声明文件，例如：

```txt
requirements.txt
pyproject.toml
```

后续补齐时，应至少明确：

```txt
fastapi
uvicorn
sqlmodel
sqlalchemy
python-multipart
```

其中 `python-multipart` 对 FastAPI 接收 `multipart/form-data` 上传是必要的。

### API base URL 配置

前端当前在多个 API 文件中硬编码：

```txt
http://127.0.0.1:18001
```

位置：

```txt
frontend/src/api/comics.ts
frontend/src/api/adminComics.ts
frontend/src/api/auth.ts
frontend/src/api/users.ts
frontend/src/api/adminUsers.ts
```

后续维护时应保证这些文件一致，或改成统一配置。

### 数据库迁移说明

当前数据库表由：

```py
SQLModel.metadata.create_all(engine)
```

在应用启动时创建。

当前没有迁移系统。修改模型字段前，需要明确如何处理已有 `backend/data/site.db`。

本轮新增或涉及的表包括：

```txt
user
comic_part_user_link
```

已有数据库如果缺少这些表，需要确认启动时 `create_all` 是否已经创建，或补充迁移/重建说明。

### Admin 页面组件拆分

`frontend/src/pages/AdminComicsPage.tsx` 当前已经在同文件内拆出局部组件。后续优先把后台页面的共享结构抽出，服务于：

```txt
AdminComicsPage
AdminUsersPage
后续用户上传页面
```

拆分时应优先稳定：

- 页面权限检查模式：`getMe()` + `role === "admin"`。
- API 层函数参数命名：前端 camelCase，multipart 字段 snake_case。
- 消息区、标题编辑、表格/树节点、确认操作等后台交互组件。

### 上传资源清理

当前删除 chapter / part / series 会删除相关上传目录和 Asset 记录。

维护时需要注意：

- 不要手动删除数据库记录后遗留 uploads 文件。
- 不要手动删除 uploads 文件后遗留 Asset / ComicPage。
- 删除逻辑优先复用 `backend/app/services/comic_admin.py`。

### 文档维护边界

文档中应优先写当前事实：

- 文件路径
- router prefix
- 函数签名
- 参数必填/可选
- 数据库字段名
- API 返回字段名

未实现的功能不要写成已经存在。
