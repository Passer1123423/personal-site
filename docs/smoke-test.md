# Smoke Test

本文档用于部署前后快速确认核心功能没有被改坏。它不是完整自动化测试。

## 准备

后端：

```bash
cd backend
export SECRET_KEY="dev-local-secret-change-before-public-deploy"
uvicorn app.main:app --host 127.0.0.1 --port 18001
```

前端：

```bash
cd frontend
npm run dev -- --port 18000
```

管理员 token：

```bash
TOKEN=$(curl --noproxy "*" -s -X POST "http://127.0.0.1:18001/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"passer","password":"123456"}' \
  | python3 -c "import sys, json; print(json.load(sys.stdin)['accessToken'])")
```

## 后端基础

```bash
curl --noproxy "*" http://127.0.0.1:18001/health
```

预期：

```json
{"status":"ok"}
```

检查当前用户：

```bash
curl --noproxy "*" \
  -H "Authorization: Bearer $TOKEN" \
  http://127.0.0.1:18001/api/auth/me
```

## 公共页面

浏览器检查：

- `/`
- `/projects`
- `/about`
- `/works`
- `/works/comics`
- `/works/novels`
- `/register`
- `/users/:username`

API 检查：

```bash
curl --noproxy "*" http://127.0.0.1:18001/api/comics
curl --noproxy "*" http://127.0.0.1:18001/api/novels
```

重点：

- Navbar 正常显示。
- Footer 正常显示。
- 登录状态下 Navbar 用户菜单正常。
- 公开用户页头像、简介、留言区正常。
- 从长页面底部进入任意普通页面时，注意是否仍保留旧滚动位置；当前项目尚未实现全局滚动复位。

## 漫画公开详情和阅读

浏览器检查：

- `/works/comics/:seriesSlug`
- `/works/comics/:seriesSlug/:partSlug`
- `/works/comics/:seriesSlug/:partSlug/:chapterSlug`

API 检查：

```bash
curl --noproxy "*" http://127.0.0.1:18001/api/comics/SERIES_SLUG
curl --noproxy "*" http://127.0.0.1:18001/api/comics/SERIES_SLUG/PART_SLUG
curl --noproxy "*" http://127.0.0.1:18001/api/comics/SERIES_SLUG/PART_SLUG/CHAPTER_SLUG
```

重点：

- Series 详情仍正常。
- Part 详情使用轻量接口，章节列表正常。
- Reader 三段路由仍正常。
- 未登录和非 owner 不显示作者管理按钮；owner 登录显示并跳转 `/creator/comics/:seriesSlug/:partSlug`。

## 用户资料

浏览器检查：

- `/settings/profile`

重点：

- 未登录时跳转登录。
- 显示名和简介可保存。
- 头像可选择、裁剪、上传、切换、删除。
- 保存后 Navbar 用户头像/名称同步更新。

API 检查：

```bash
curl --noproxy "*" \
  -H "Authorization: Bearer $TOKEN" \
  http://127.0.0.1:18001/api/users/me/avatars
```

## 评论和互动

浏览器检查挂载点：

- `/users/:username`
- `/works/novels/:novelSlug`
- `/works/novels/:novelSlug/:chapterSlug`
- `/works/comics/:seriesSlug/:partSlug`
- `/works/comics/:seriesSlug/:partSlug/:chapterSlug`

重点：

- 未登录时提示登录。
- 登录后可发表评论。
- 可回复评论。
- 父级评论可带图片。
- 当前用户可删除自己的评论。
- 图片预览正常。
- 当前评论接口只校验 target 存在，private visibility 不是强边界；若测试 private 漫画对象，应确认是否需要补规则。

API 检查：

```bash
curl --noproxy "*" \
  "http://127.0.0.1:18001/api/interactions/comments/tree?target_type=user_page&target_id=TARGET_ID"
```

## Admin

浏览器检查：

- `/admin/login`
- `/admin`
- `/admin/users`
- `/admin/comics`
- `/admin/novels`
- `/admin/interactions`

重点：

- 登录成功。
- 非 admin 不能进入 admin 页面。
- 用户列表加载。
- 注册开关可读取和保存。
- 漫画树加载。
- 小说树加载。
- 互动管理能检索评论、查看上下文、软删除和硬删除。

## Author Comics

浏览器检查：

- `/creator`
- `/creator/comics`
- `/creator/comics/:seriesSlug`
- `/creator/comics/:seriesSlug/:partSlug`

API 检查：

```bash
curl --noproxy "*" \
  -H "Authorization: Bearer $TOKEN" \
  http://127.0.0.1:18001/api/author/comics/tree
```

重点：

- 书架加载。
- series / part 页面可打开。
- 作者只能看到或操作有权限的 part。
- Part 作者页桌面端顶部 Navbar 默认收起，鼠标移到最顶部热区可展开。
- Part 作者页桌面端 Footer 不占据页面尾部；移动端保持原 Navbar/Footer 行为。
- 待传区图片可上传、预览、删除、批量删除、清空。
- 待传区图片可重排。
- PDF job 可创建、轮询、取消、合并到待传区、丢弃。
- 已有章节可载入到待传区并覆盖发布。
- 鼠标位于右侧上传抽屉内时，抽屉滚动正常。
- 发布 chapter 后公开阅读页可打开。

## Author Novels

浏览器检查：

- `/creator/novels`
- `/creator/novels/:novelSlug`
- `/creator/novels/:novelSlug/new-chapter`
- `/creator/novels/:novelSlug/:chapterSlug/edit`

API 检查：

```bash
curl --noproxy "*" \
  -H "Authorization: Bearer $TOKEN" \
  http://127.0.0.1:18001/api/author/novels/tree
```

重点：

- 小说树加载。
- novel / chapter 可创建、重命名、移动、删除。
- 正文编辑器三栏高度对齐。
- 编辑栏 textarea 内部可滚动。
- 预览栏内部可滚动。
- text buffer 可创建、载入、更新、发布、删除。
- 已有 chapter 可上传正文图片并插入 Markdown。
- 桌面端顶部 Navbar 默认收起，鼠标移到最顶部热区可展开；移动端保持原行为。

## 阅读器

浏览器检查：

- `/works/comics/:seriesSlug/:partSlug/:chapterSlug`
- `/works/novels/:novelSlug/:chapterSlug`

重点：

- 漫画阅读页不显示 App Navbar/Footer。
- 漫画阅读页自己的阅读器顶部栏、显示模式、评论区正常。
- 小说阅读页使用普通 App Navbar/Footer，章节目录 sticky 行为正常。
- 阅读内容和评论区滚动互不破坏。

## 收藏和通知

浏览器检查：

- 小说详情页收藏按钮。
- 漫画 Part 详情页收藏按钮。
- `/notifications`
- Navbar 用户菜单中的通知入口和未读 badge。

API 检查：

```bash
curl --noproxy "*" \
  -H "Authorization: Bearer $TOKEN" \
  http://127.0.0.1:18001/api/favorites/novels/NOVEL_SLUG

curl --noproxy "*" \
  -H "Authorization: Bearer $TOKEN" \
  http://127.0.0.1:18001/api/favorites/comics/SERIES_SLUG/PART_SLUG

curl --noproxy "*" \
  -H "Authorization: Bearer $TOKEN" \
  http://127.0.0.1:18001/api/notifications/unread-count
```

Outbox processor：

```bash
cd backend
python scripts/process_outbox_events.py --limit 50 --json
```

重点：

- 收藏和取消收藏状态正确。
- 收藏、评论、章节发布/更新后，运行 outbox processor 能生成通知。
- 通知列表、单条已读、全部已读、删除通知正常。
- 用户不能读取、标记或删除别人的通知。

## 上传和静态资源

检查：

- `/uploads/...` 资源能通过浏览器访问。
- Nginx `/uploads/` alias 与后端 `UPLOADS_DIR` 一致。
- 漫画图片、小说封面、小说章节图片、用户头像、评论图片正常显示。

## 备份

本地可运行：

```bash
cd backend
python scripts/backup_site_data.py
```

生产应确认：

- 数据库已进入归档。
- uploads 已进入归档。
- manifest 生成。
- 远程备份参数按需生效。

## 前端构建

```bash
cd frontend
npm run build
```

生产同源构建：

```bash
VITE_API_BASE_URL="" npm run build
```

当前说明：

- `npm run build` 是主要前端验证命令。
- `npm run lint` 当前存在既有 hooks 规则失败，需单独修复后才能作为强门禁。

## 最低通过项

部署前至少确认：

- `/health` 正常。
- 登录和 `/api/auth/me` 正常。
- public comics / novels API 正常。
- public comic part 轻量 API 正常。
- admin users / comics / novels / interactions 页面能加载。
- admin activity logs 页面能加载。
- author comics / novels 页面能加载。
- favorites / notifications 基础接口正常。
- creator 工作页的桌面自动隐藏 Navbar 不遮挡核心操作。
- uploads 可访问。
- outbox processor 能处理一次 pending events。
- 备份脚本能完成一次。
