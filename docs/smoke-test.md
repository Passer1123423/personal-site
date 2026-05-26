# Smoke Test

本文档用于记录个人网站每次部署前的最小功能检查。
目标不是完整自动化测试，而是快速确认核心功能没有被改坏。

## 测试前准备

后端启动：

```bash
cd backend
export SECRET_KEY="dev-local-secret-change-before-public-deploy"
uvicorn app.main:app --host 127.0.0.1 --port 18001
```

前端开发环境启动：

```bash
cd frontend
npm run dev -- --port 18000
```

如需测试生产构建：

```bash
cd frontend
npm run build
```

获取管理员 token：

```bash
TOKEN=$(curl --noproxy "*" -s -X POST "http://127.0.0.1:18001/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"passer","password":"123456"}' \
  | python3 -c "import sys, json; print(json.load(sys.stdin)['accessToken'])")

echo "$TOKEN"
```

## 1. 后端健康检查

```bash
curl --noproxy "*" http://127.0.0.1:18001/health
```

预期：

```json
{"status":"ok"}
```

## 2. 登录接口

```bash
curl --noproxy "*" -X POST "http://127.0.0.1:18001/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"passer","password":"123456"}'
```

预期：

1. 返回 `accessToken`
2. `tokenType` 为 `bearer`
3. `user.role` 为 `admin`

## 3. 当前用户接口

```bash
curl --noproxy "*" \
  -H "Authorization: Bearer $TOKEN" \
  http://127.0.0.1:18001/api/auth/me
```

预期：

1. 返回当前登录用户
2. `username` 为 `passer`
3. `role` 为 `admin`

## 4. 公开漫画列表

```bash
curl --noproxy "*" http://127.0.0.1:18001/api/comics
```

预期：

1. 返回漫画 series 列表
2. 不需要登录
3. 已有漫画数据可以正常显示

## 5. 漫画详情与阅读页

浏览器检查：

```txt
http://127.0.0.1:18000/works/comics
```

预期：

1. 漫画入口正常显示
2. series / part / chapter 可以进入
3. 阅读页图片可以加载
4. 图片路径 `/uploads/...` 可访问
5. 阅读页滚动后离开并返回同一章节，应恢复到之前的阅读位置

## 6. Admin 用户管理页

浏览器检查：

```txt
http://127.0.0.1:18000/admin/users
```

预期：

1. 未登录时跳转登录页
2. 管理员登录后可以进入
3. 用户列表正常显示
4. 创建用户、删除用户仍可用

## 7. 注册开关接口

查询注册开关：

```bash
curl --noproxy "*" \
  -H "Authorization: Bearer $TOKEN" \
  http://127.0.0.1:18001/api/admin/users/settings/registration
```

预期：

```json
{"enabled":true}
```

关闭注册：

```bash
curl --noproxy "*" -X PATCH \
  http://127.0.0.1:18001/api/admin/users/settings/registration \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"enabled":false}'
```

预期：

```json
{"enabled":false}
```

重新打开注册：

```bash
curl --noproxy "*" -X PATCH \
  http://127.0.0.1:18001/api/admin/users/settings/registration \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"enabled":true}'
```

预期：

```json
{"enabled":true}
```

## 8. 注册页人类验证

浏览器检查：

```txt
http://127.0.0.1:18000/register
```

预期：

1. 注册页显示“你是人类吗？”
2. 不填写 `是` 时注册失败
3. 填写 `是` 时注册成功
4. 注册成功后可以登录或进入对应页面

测试完成后，应删除测试账号。

## 9. Admin 漫画后台

浏览器检查：

```txt
http://127.0.0.1:18000/admin/comics
```

预期：

1. 管理员可以进入
2. series / part / chapter 树正常显示
3. chapter 重命名、移动、删除等既有功能不报错
4. 不应出现明显布局异常

## 10. 公开小说页面

浏览器检查：

```txt
http://127.0.0.1:18000/works/novels
```

预期：

1. 小说列表正常显示
2. 可以进入小说详情页
3. 章节列表正常显示
4. 可以进入章节阅读页
5. Markdown 正文、标题、列表、引用、表格等基础样式正常
6. 桌面端右侧目录不遮挡正文，移动端布局不溢出

接口检查：

```bash
curl --noproxy "*" http://127.0.0.1:18001/api/novels
```

预期：

1. 返回 novel 列表
2. 不需要登录

## 11. Admin 小说后台

浏览器检查：

```txt
http://127.0.0.1:18000/admin/novels
```

预期：

1. 未登录时不能作为管理员使用
2. 管理员登录后可以进入
3. 小说树正常显示
4. 新建 novel 可用
5. 新建 chapter 可用
6. chapter 正文编辑保存可用
7. chapter 重命名、移动、删除可用
8. novel owner 设置可用
9. 不应出现明显布局异常

接口检查：

```bash
curl --noproxy "*" \
  -H "Authorization: Bearer $TOKEN" \
  http://127.0.0.1:18001/api/admin/novels/tree
```

预期：

1. 返回 novel 树
2. 每个 novel 可包含 chapters

## 12. 创作者漫画书架与上传待传区

浏览器检查：

```txt
http://127.0.0.1:18000/creator/comics
```

预期：

1. 创作者漫画书架可以加载 series
2. 新建 series 弹窗可打开，slug 为空时有错误提示
3. 进入 series 后只显示当前用户 owner 的 part
4. 新建 part 成功后进入 part 页面
5. part 页面可以显示 chapter 目录
6. 可以打开右侧待传区
7. 图片上传成功
8. 图片预览正常
9. 删除待传图片后顺序正常重排
10. 清空待传区可用
11. 发布章节后正式章节可见

注意：

当前单用户待传区限制为 100MB。
单张图片限制为 20MB。
当前创作者管理功能仍复用 admin comics API，因此测试账号需要 admin 权限。

## 13. 静态上传资源

任选一张已有图片，检查：

```txt
http://127.0.0.1:18001/uploads/...
```

预期：

1. 本地开发环境下 FastAPI 可以访问图片
2. 生产环境后续由 Nginx 接管 `/uploads/`

## 14. 备份脚本

```bash
cd backend
python scripts/backup_site_data.py
```

预期：

1. 生成 `backend/backups/backup-YYYYMMDD-HHMMSS/`
2. 生成 `backend/backups/backup-YYYYMMDD-HHMMSS.tar.gz`
3. 备份目录内包含 `site.db`
4. 备份目录内包含 `manifest.json`
5. 如果当前 `UPLOADS_DIR` 或 `backend/uploads/` 存在，备份目录内包含 `uploads/`
6. `backend/backups/` 不应被 Git 跟踪

注意：

当前脚本会读取 `UPLOADS_DIR` 环境变量，也可以用 `--uploads-dir` 显式指定生产真实上传目录。

生产示例：

```bash
cd backend
UPLOADS_DIR=/var/www/personal-site/uploads python scripts/backup_site_data.py
```

检查：

```bash
cd ..
git status --short
```

预期：

1. 不应出现 `backend/backups/` 中的真实备份文件
2. 如果 `.gitignore` 正确，备份目录不会进入 Git

## 15. 前端构建

```bash
cd frontend
npm run build
```

预期：

1. TypeScript 检查通过
2. Vite build 通过
3. 不应出现未使用 import 报错

## 16. Git 检查

```bash
git status --short
```

预期：

1. 没有意外改动
2. 没有数据库、上传文件、备份文件、`node_modules`、`.venv`、`__pycache__` 进入 Git

检查已跟踪生成物：

```bash
git ls-files | grep -E "(__pycache__|\.pyc$|backend/data/.*\.db$|backend/uploads|backend/backups|backend/import_data|frontend/dist|frontend/node_modules|backend/.venv)"
```

预期：没有输出。

## 部署前最低通过项

每次部署前至少确认：

1. `/health` 正常
2. 登录正常
3. `/api/auth/me` 正常
4. 公开漫画列表正常
5. 阅读页图片正常
6. admin users 正常
7. admin comics 正常
8. 公开 novels 正常
9. admin novels 正常
10. 注册开关正常
11. 前端 `npm run build` 通过
12. 备份脚本可运行
