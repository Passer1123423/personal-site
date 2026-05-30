# Data Model

当前所有 SQLModel 表都定义在：

```txt
backend/app/models.py
```

项目当前没有数据库迁移系统。新增字段或修改既有字段时，不能只依赖 `create_all` 更新已有 SQLite 表，需要单独设计迁移步骤。

## 通用表

### Asset

用途：统一记录上传资源。

关键字段：

- `id`
- `filename`
- `original_name`
- `mime_type`
- `size`
- `url`
- `usage`
- `created_at`

当前用于漫画页面、漫画封面、小说封面等上传资源。

### User

用途：用户账号。

关键字段：

- `id`
- `username`
- `display_name`
- `password_hash`
- `role`
- `is_active`
- `avatar_asset_id`
- `bio`
- `created_at`
- `updated_at`

当前角色使用字符串表示，如 `reader`、`author`、`admin`。

### SiteSetting

用途：站点级配置。

当前用于公开注册开关。

## 漫画表

### ComicSeries

漫画系列。

关键字段：

- `slug`
- `title`
- `summary`
- `cover_asset_id`
- `status`
- `visibility`
- `display_order`

### ComicPart

漫画分部。作者归属发生在 Part 层。

关键字段：

- `series_id`
- `slug`
- `title`
- `summary`
- `cover_asset_id`
- `status`
- `visibility`
- `display_order`

约束：

- 同一 series 下 part slug 唯一。

### ComicChapter

漫画章节。

关键字段：

- `part_id`
- `slug`
- `title`
- `summary`
- `visibility`
- `display_order`
- `published_at`

约束：

- 同一 part 下 chapter slug 唯一。

### ComicPage

漫画页。

关键字段：

- `chapter_id`
- `asset_id`
- `display_order`
- `width`
- `height`

约束：

- 同一 chapter 下 `display_order` 唯一。

### ComicPartUserLink

漫画 Part 与用户的 owner 关系。

关键字段：

- `part_id`
- `user_id`
- `role`

约束：

- 同一 part/user 只能有一条关系。

### ComicUploadImage

漫画待传区图片。

关键字段：

- `user_id`
- `original_filename`
- `stored_filename`
- `storage_path`
- `content_type`
- `size_bytes`
- `display_order`

实际文件位于：

```txt
backend/import_data/users/{user_id}/comic-staging/
```

## 小说表

### Novel

小说。

关键字段：

- `slug`
- `title`
- `summary`
- `cover_asset_id`
- `display_order`

当前小说模型没有 `visibility` / `status` 字段。

### NovelChapter

小说章节。

关键字段：

- `novel_id`
- `slug`
- `title`
- `content`
- `display_order`

约束：

- 同一 novel 下 chapter slug 唯一。

### NovelUserLink

小说与用户的 owner 关系。

关键字段：

- `novel_id`
- `user_id`
- `role`

### NovelTextBuffer

小说正文缓冲区。

用途：

- 作者编辑已有章节时先载入 buffer。
- 作者创建新章节前可先保存 buffer。
- buffer 可发布到已有章节或发布成新章节。

关键字段：

- `user_id`
- `novel_id`
- `chapter_id`
- `content_type`
- `content`
- `created_at`
- `updated_at`
