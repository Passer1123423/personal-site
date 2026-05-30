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
- `/works`
- `/works/comics`
- `/works/novels`
- `/register`

API 检查：

```bash
curl --noproxy "*" http://127.0.0.1:18001/api/comics
curl --noproxy "*" http://127.0.0.1:18001/api/novels
```

## Admin

浏览器检查：

- `/admin/login`
- `/admin/users`
- `/admin/comics`
- `/admin/novels`

重点：

- 登录成功。
- 用户列表加载。
- 漫画树加载。
- 小说树加载。
- 注册开关可读取。

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
- 待传区图片可上传、预览、删除、清空。
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
- 正文编辑可保存。
- text buffer 可创建、载入、更新、发布、删除。

## 上传和静态资源

检查：

- `/uploads/...` 资源能通过浏览器访问。
- Nginx `/uploads/` alias 与后端 `UPLOADS_DIR` 一致。
- 漫画图片和小说封面正常显示。

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

## 最低通过项

部署前至少确认：

- `/health` 正常。
- 登录和 `/api/auth/me` 正常。
- public comics / novels API 正常。
- admin users / comics / novels 页面能加载。
- author comics / novels 页面能加载。
- uploads 可访问。
- 备份脚本能完成一次。
