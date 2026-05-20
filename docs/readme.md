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

4. `visual-style-guide.md`
   - 当前颜色、圆角、阴影和页面族风格。
   - 新增 UI 时如何复用现有 token。

5. `deployment-readiness-audit.md`
   - 2026-05-21 的详细部署审计记录。
   - 更长，适合做上线前问题清单。

## 最重要的已有事实

- 已有认证接口：`POST /api/auth/login`、`POST /api/auth/register`、`GET /api/auth/me`。
- 已有认证依赖：`require_current_user`、`require_admin_user`。
- 已有公开漫画 API：列表、系列详情、章节阅读。
- 已有管理端漫画 API：树、上传章节、删除、移动、重命名、简介、封面、owner。
- 已有管理端用户 API：列表、创建、更新、重置密码、删除。
- 已有创作者待传区 API：上传图片、预览、删除、清空、发布为章节。
- 数据模型都在 `backend/app/models.py`，当前没有 `backend/app/models/` 目录。
- 数据库当前是 SQLite：`backend/data/site.db`。
- 上传静态资源当前挂载在 `/uploads`，实际目录是 `backend/uploads`。
- 颜色和视觉风格已有统一入口：`frontend/src/styles/tokens.css`，细则见 `visual-style-guide.md`。

## 文档维护规则

- 优先写“当前代码已经有的事实”，不要把设想写成已实现。
- 新增接口、页面、模型字段时，同步更新 `project-current-state.md` 和 `api-reference.md`。
- 如果旧文档和代码冲突，以代码为准，并立刻改文档。
- 文档目标是给下一次会话减少误判，不追求事无巨细。
