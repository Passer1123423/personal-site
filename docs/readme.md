# Personal Site Docs

本目录只保留当前项目事实、运行维护说明和仍有参考价值的历史记录。旧规划、临时审计和已经失效的设计说明不再放在主目录。

## 先读顺序

1. `project-current-state.md`
   - 当前技术栈、业务模块、页面和后端能力。
   - 新会话先读这里，避免重复实现已经存在的能力。

2. `api-reference.md`
   - 当前后端已经注册的 API。
   - 包括 public、auth、admin、author、上传和 buffer 接口。

3. `data-model.md`
   - 当前 SQLModel 表结构和关键关系。
   - 新增字段前先看这里，尤其注意 SQLite 迁移限制。

4. `operations-and-deployment.md`
   - 本地运行、生产部署、环境变量、uploads、SQLite、备份和 systemd。

5. `smoke-test.md`
   - 部署或大改前后的最小手工检查清单。

6. `style-guide.md`
   - 当前视觉 token、页面族风格和 UI 改动约束。

## 当前事实源

- 前端：Vite + React + TypeScript + Tailwind。
- 后端：FastAPI + SQLModel + SQLite。
- 公共页面：Home、Works、Comics、Novels、User。
- 用户系统：JWT 登录、`User` 模型、`POST /api/auth/login`、`GET /api/auth/me`。
- 漫画系统：Series、Part、Chapter、Page；作者归属在 Part 层。
- 小说系统：Novel、Chapter、Novel Reader、Author 小说后台。
- 上传系统：Comic staging、Novel text buffer。
- 后台：Admin、Author。
- 部署：Linux + systemd + SQLite + uploads + 定时备份。

## 文档维护规则

- 主目录文档只写当前代码事实和当前操作方式。
- 阶段性审计、临时统计、一次性 follow-up 不放主目录；必要时放 `docs-archive/`。
- 旧文档和代码冲突时，以代码为准。
- 新增 API、模型、页面、部署变量后，同步更新对应文档。
- 不把设想写成已实现。
