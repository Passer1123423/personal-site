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
- SQLite 数据索引
- `backend/uploads/comics` 静态资源存储

漫画以外的模块当前主要是前端页面或静态数据。

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

前端当前在两个文件中硬编码：

```txt
http://127.0.0.1:18001
```

位置：

```txt
frontend/src/api/comics.ts
frontend/src/api/adminComics.ts
```

后续维护时应保证两个文件一致，或改成统一配置。

### 数据库迁移说明

当前数据库表由：

```py
SQLModel.metadata.create_all(engine)
```

在应用启动时创建。

当前没有迁移系统。修改模型字段前，需要明确如何处理已有 `backend/data/site.db`。

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
