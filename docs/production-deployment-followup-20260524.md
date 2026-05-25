# Production Deployment Follow-up: 2026-05-24

本文档补充 `production-deployment-record-20260524.md` 之后的本地项目变化，用于下一次服务器同步、排查和 smoke test。

## 已补充的项目事实

- 前端 API base URL 已集中到 `frontend/src/api/config.ts`。
- 生产同源构建仍使用 `VITE_API_BASE_URL="" npm run build`，让前端请求 `/api/...`。
- 后端 `SECRET_KEY`、`CORS_ALLOW_ORIGINS`、`UPLOADS_DIR` 已通过环境变量控制。
- `backend/app/services/comic_admin.py` 使用 `UPLOADS_DIR/comics` 作为正式漫画上传根目录，不再依赖进程工作目录。
- 创作者漫画页面已有书架式入口：新建 series、新建 part、编辑标题/简介/封面。
- 创作者 part 页面上传入口是右侧待传缓存区抽屉。
- 创作者待传区限制为单用户 100MB、单文件 20MB。
- 阅读页会用 `sessionStorage` 按 `seriesSlug/partSlug/chapterSlug` 恢复同一章节的滚动位置。

## 服务器同步时要复查

- `/etc/personal-site/backend.env` 必须设置 `SECRET_KEY`、`ACCESS_TOKEN_EXPIRE_MINUTES`、`CORS_ALLOW_ORIGINS`、`UPLOADS_DIR`。
- Nginx `/uploads/` alias 必须和 `UPLOADS_DIR` 指向同一个目录。
- Nginx `client_max_body_size` 应高于后端单文件上传上限 20MB，当前生产记录为 25M。
- 后端服务仍建议 1 worker，监听 `127.0.0.1:18001`。
- 前端 dist 应本地构建后上传，服务器不需要 `frontend/node_modules`。

## 当前备份缺口

`backend/scripts/backup_site_data.py` 当前仍只备份：

```txt
backend/data/site.db
backend/uploads/
```

生产真实上传目录记录为：

```txt
/var/www/personal-site/uploads
```

因此生产正式上传漫画后，必须先修备份脚本读取 `UPLOADS_DIR`，或用额外运维命令单独备份 `/var/www/personal-site/uploads`。

## 追加 Smoke Test

下一次服务器更新后，除原部署记录中的检查项外，还应检查：

- 打开 `/creator/comics`，确认 series 书架加载。
- 新建 series。
- 进入 series 后新建 part。
- 进入 part 页面，打开右侧待传缓存区。
- 上传、预览、删除、清空待传图片。
- 发布 chapter 后确认章节目录和公开阅读页可见。
- 阅读页滚动后离开再返回同一章节，确认恢复之前的阅读位置。
