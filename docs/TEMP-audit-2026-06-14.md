# Temporary Audit Notes

时间：2026-06-14 03:46:09 CST +0800

状态：临时文档。仅用于保存本次文档更新前的项目审计结论，不应提交到 Git。

## 审计范围

只读通读当前项目，覆盖：

- FastAPI 后端入口、模型、认证依赖和 router。
- React/Vite 前端入口、路由、API 封装和关键页面状态流。
- 用户、认证、公开小说、公开漫画、作者端小说、作者端漫画、漫画上传/PDF 队列、评论、收藏、通知、后台管理、活动日志。

## 模块现状

- 认证/用户：有注册开关、登录、当前用户、头像、资料编辑；`SECRET_KEY` 强制非默认值。
- 小说公开页：列表、详情、阅读、评论、收藏、作者管理入口完整；但没有公开/草稿隔离。
- 漫画公开页：series、part、reader 分层清楚；漫画 part 轻量接口存在，reader 不返回非 public。
- 作者小说：owner 校验存在，正文 buffer、章节编辑、图片、封面、删除都有覆盖。
- 作者漫画：part owner 是核心权限边界；series 更像容器，part 才有 owner。
- 漫画上传/PDF：按用户隔离 staging，发布前校验 part owner；有 100MB staging、20MB 单图、100MB PDF、300 页限制。
- 评论：支持树、回复、图片、软删/硬删、后台管理；目标可见性是主要缺口。
- 收藏：小说和漫画 part 都有；漫画收藏的公开性过滤缺口需要补。
- 通知：用户隔离正确，支持未读数、已读、删除；依赖 outbox processor。
- 后台：用户、小说、漫画、评论、日志管理都存在；删除用户可能受外键历史数据影响，需要用真实数据做删除演练。

## 主要问题

1. 中风险：收藏接口可收藏非公开漫画 part。
   `backend/app/services/favorite_service.py` 通过 slug 查 `ComicSeries` / `ComicPart` 时没有过滤 `visibility == "public"`。登录用户如果猜到 slug，可以收藏 private series/part，并触发通知或暴露标题。

2. 中风险：评论目标只校验存在，不校验可见性。
   `backend/app/services/interactions.py` 对 `novel`、`novel_chapter`、`comic_part`、`comic_chapter` 只检查对象存在，没有检查公开可见性或父级可见性。private part/chapter 的 ID 如果被知道，可被评论接口探测或评论。

3. 中风险：小说公开接口没有 visibility 概念，所有小说默认公开。
   `backend/app/routers/novels.py` 的列表、详情、阅读都不做可见性过滤；`Novel` 模型也没有 visibility/status。如果存在草稿预期，目前发布边界不成立。

4. 中风险：漫画图片上传只按扩展名校验。
   `backend/app/services/comic_upload.py` 的漫画待传区上传主要检查后缀，保存时直接写入用户上传内容，`content_type` 只是记录。头像和评论图片比漫画上传更严格。

5. 中风险：JWT 存在 localStorage，XSS 后 token 可被直接读取。
   `frontend/src/api/auth.ts` 使用 localStorage 保存 access token。当前没看到 `dangerouslySetInnerHTML`，但后续一旦引入 XSS，token 可被窃取。

6. 低到中风险：SPA 路由没有全局滚动复位。
   `BrowserRouter` 包住 `App`，但没有 `ScrollToTop` 或 scroll restoration。从长页面底部进入新页面时，浏览器会沿用旧 scrollY；短 loading 状态容易表现为新页面停在底部。

7. 低风险：`/creator/comics` 路由重复定义。
   `frontend/src/App.tsx` 中同一组 creator comics 路由重复注册。当前不直接破坏匹配，但增加维护噪音。

8. 低风险：Outbox/通知需要外部脚本驱动。
   收藏、评论、章节发布通知依赖 `backend/scripts/process_outbox_events.py`；主应用启动不会自动处理。如果部署时没跑定时任务/worker，通知会积压。

## 优先优化顺序

1. 补收藏和评论的可见性校验，避免 private comic part/chapter 被探测。
2. 给小说增加 visibility/status，或明确小说全站永远公开的产品约束。
3. 加全局路由滚动复位，并排除 reader 的阅读进度恢复。
4. 漫画上传增加真实图片解码校验。
5. 清理重复路由，统一 `react-router` / `react-router-dom` import 风格。
6. 部署层确认 outbox processor、备份脚本、CORS、CSP、静态 uploads 权限。

## 验证说明

本次审计按只读方式进行，没有运行会写 `dist`、`__pycache__` 或数据库的 build/compile/test 命令。
