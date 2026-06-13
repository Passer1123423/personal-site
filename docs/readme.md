# Personal Site Docs

本目录记录当前项目事实、运行维护说明、数据结构、API 和视觉约束。临时审计、一次性 follow-up 和已失效规划不放主目录；历史部署记录放在 `docs-archive/`。

## 先读顺序

1. `project-current-state.md`
   - 当前技术栈、业务模块、页面、布局模式和后端能力。
   - 新会话先读这里，避免重复实现已经存在的能力。

2. `api-reference.md`
   - 当前后端已经注册的 API。
   - 包括 public、auth、user profile、admin、author、上传、评论和 buffer 接口。

3. `data-model.md`
   - 当前 SQLModel 表结构和关键关系。
   - 新增字段前先看这里，尤其注意 SQLite 没有迁移系统。

4. `operations-and-deployment.md`
   - 本地运行、生产部署、环境变量、uploads、SQLite、备份和当前验证状态。

5. `smoke-test.md`
   - 部署或大改前后的最小手工检查清单。

6. `style-guide.md`
   - 当前视觉 token、页面族风格、Navbar/layout 约定和后续标准化方向。

## 当前事实源

- 前端：Vite + React + TypeScript + Tailwind CSS v4。
- 后端：FastAPI + SQLModel + SQLite。
- 认证：JWT Bearer token，token 存在前端 localStorage。
- 用户系统：注册、登录、个人主页、资料编辑、头像上传/裁剪/切换/删除。
- 漫画系统：Series、Part、Chapter、Page；作者归属在 Part 层。
- 小说系统：Novel、Chapter、Markdown 阅读、作者编辑器、正文 buffer、章节图片。
- 互动系统：通用评论、回复树、评论图片、用户页/小说/小说章节/漫画 Part/漫画章节挂载点。
- 收藏通知：小说/漫画 Part 收藏、OutboxEvent、Notification、通知页和 Navbar 未读 badge。
- 后台：Admin 首页、用户管理、漫画管理、小说管理、互动管理、活动日志。
- 创作者：漫画书架/Series/Part 上传页，小说书架/Novel 管理页/Chapter 编辑页。
- 布局：普通页面使用标准 Navbar/Footer；创作工作页桌面端使用自动隐藏 Navbar；漫画阅读页完全沉浸。
- 部署：Linux + systemd + Nginx + SQLite + uploads + 备份脚本。

## 文档维护规则

- 主目录文档只写当前代码事实、当前操作方式和明确的近期规划。
- 阶段性审计、临时统计、一次性 follow-up 不放主目录；必要时放 `docs-archive/`。
- 旧文档和代码冲突时，以代码为准。
- 新增 API、模型、页面、部署变量、布局模式后，同步更新对应文档。
- 不把设想写成已实现；规划内容必须明确标注为“方向”或“后续”。
- Git diff 中已经被移走的带日期临时文档删除记录可忽略，不视为当前文档缺失。
