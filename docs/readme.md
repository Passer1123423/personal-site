# Personal Site Docs

本文档目录用于让新会话快速把握项目现状。读代码前先读这里，避免重复实现已经存在的接口或页面。

## 先读顺序

1. `project-current-state.md`
   - 当前项目结构。
   - 已经实现了什么。
   - 哪些地方不要重复造。
   - 当前明显风险。

2. `api-reference.md`
   - 后端所有已注册 API。
   - 认证与权限依赖。
   - 前端 API 文件如何调用后端。

3. `operations-and-deployment.md`
   - 本地运行、构建、部署前检查。
   - 低配服务器部署建议。
   - 数据库、上传目录、备份边界。

4. `envirment-variables.md`
   - 当前后端和前端实际读取的环境变量。
   - 本地 WSL 和生产同源部署示例。

5. `production-deployment-record-20260524.md`
   - 2026-05-24 首次生产服务器部署记录。
   - systemd、Nginx、目录、权限、smoke test 和当前服务器状态。

6. `production-deployment-followup-20260524.md`
   - 首次部署记录之后的本地项目变化补充。
   - 下一次服务器同步时需要复查的上传目录、创作者页面和备份缺口。

7. `visual-style-guide.md`
   - 当前颜色、字体、圆角、阴影和页面族风格。
   - 覆盖 `frontend/src/styles/` 下的 token、通用页面、认证、后台、小说阅读样式。
   - 新增 UI 时如何复用现有 token 和 class。

8. `deployment-readiness-audit.md`
   - 2026-05-21 的详细部署审计记录。
   - 更长，适合做上线前问题清单。

## 最重要的已有事实

- 已有认证接口：`POST /api/auth/login`、`POST /api/auth/register`、`GET /api/auth/me`。
- 已有认证依赖：`require_current_user`、`require_admin_user`。
- 已有公开漫画 API：列表、系列详情、章节阅读。
- 已有公开小说 API：列表、详情、章节正文阅读。
- 已有管理端漫画 API：树、上传章节、删除、移动、重命名、简介、封面、owner。
- 已有管理端小说 API：树、新建小说/章节、删除、移动、重命名、章节正文、owner。
- 已有管理端新建 API：创建 series、在已有 series 下创建 part。
- 已有管理端用户 API：列表、创建、更新、重置密码、删除。
- 已有公开注册开关：管理员可读取和修改，注册接口会检查 `humanCheck === "是"`。
- 已有创作者待传区 API：上传图片、预览、删除、清空、发布为章节。
- 创作者漫画页面已有书架式入口：新建 series、新建 part、编辑简介/封面/标题、右侧待传缓存区发布 chapter。
- 数据模型都在 `backend/app/models.py`，当前没有 `backend/app/models/` 目录；新增字段不能只依赖 `create_all` 修改既有 SQLite 表。
- 数据库当前是 SQLite：`backend/data/site.db`。
- 上传静态资源当前挂载在 `/uploads`，实际目录由 `UPLOADS_DIR` 控制，默认是 `backend/uploads`。
- 创作者待传区位于 `backend/import_data/users/{user_id}/comic-staging/`。
- 前端 API 地址统一从 `frontend/src/api/config.ts` 读取 `VITE_API_BASE_URL`，默认本地后端 `http://127.0.0.1:18001`。
- 颜色、字体和视觉风格已有统一入口：`frontend/src/styles/tokens.css`、`frontend/src/styles/typography.css`，细则见 `visual-style-guide.md`。
- `frontend/src/api/authorComics.ts` 目前仍调用 `/api/admin/comics/...`，普通 `author` 角色不能直接使用这些 admin 接口。
- `backend/scripts/backup_site_data.py` 已支持 `DB_PATH`、`UPLOADS_DIR`、`BACKUPS_DIR`、远程备份参数和 tar.gz 归档。

## 文档维护规则

- 优先写“当前代码已经有的事实”，不要把设想写成已实现。
- 新增接口、页面、模型字段时，同步更新 `project-current-state.md` 和 `api-reference.md`。
- 新增或调整样式 token、页面族 class、阅读器布局时，同步更新 `visual-style-guide.md`。
- 如果旧文档和代码冲突，以代码为准，并立刻改文档。
- 文档目标是给下一次会话减少误判，不追求事无巨细。
