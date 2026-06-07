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

当前用途：

- 漫画封面：`comic_cover`。
- 漫画页：`comic_page`。
- 用户头像：`user_avatar`。
- 小说封面和章节正文图片。
- 评论图片。
- 其他上传资源：`other`。

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

当前角色使用字符串表示：

```txt
reader
author
admin
```

`avatar_asset_id` 指向当前头像资源；用户历史头像仍保留为 `Asset(usage="user_avatar")`，由用户设置页管理。

### SiteSetting

用途：站点级配置。

关键字段：

- `key`
- `value`
- `updated_at`

当前用于公开注册开关：

```txt
key = registration_enabled
value = true / false
```

## 互动表

### Comment

用途：通用评论和回复树。

关键字段：

- `id`
- `target_type`
- `target_id`
- `user_id`
- `content`
- `parent_id`
- `reply_to_id`
- `is_deleted`
- `created_at`
- `updated_at`

索引/约束：

- `target_type + target_id` 组合索引。
- `parent_id` 和 `reply_to_id` 均指向 `comment.id`。

当前有效 target type：

```txt
user_page
novel
novel_chapter
comic_part
comic_chapter
```

说明：

- 一级评论的 `parent_id` 为空。
- 回复归属到同一个一级评论下；`reply_to_id` 记录实际回复目标。
- 删除默认是软删除，保留树结构。
- 用户、小说、漫画对象被删除时，相关评论会由服务层做硬删除清理。

### CommentImage

用途：评论图片关系表，文件元数据仍在 `Asset`。

关键字段：

- `id`
- `comment_id`
- `asset_id`
- `display_order`
- `created_at`

约束：

- 同一评论下 `display_order` 唯一。

当前规则：

- 只有父级评论可以带图片。
- 一条父级评论最多 9 张图片。
- 单张图片 10MB，总计 30MB。
- 支持 jpg、jpeg、png、webp、gif。

文件位置：

```txt
UPLOADS_DIR/interactions/comments/{target_type}/{target_id}/{comment_id}/
```

## 漫画表

### ComicSeries

漫画系列。

关键字段：

- `id`
- `slug`
- `title`
- `summary`
- `cover_asset_id`
- `status`
- `visibility`
- `display_order`
- `created_at`
- `updated_at`

约束：

- `slug` 全局唯一。

### ComicPart

漫画分部。作者归属发生在 Part 层。

关键字段：

- `id`
- `series_id`
- `slug`
- `title`
- `summary`
- `cover_asset_id`
- `status`
- `visibility`
- `display_order`
- `created_at`
- `updated_at`

约束：

- 同一 series 下 part slug 唯一。

### ComicChapter

漫画章节。

关键字段：

- `id`
- `part_id`
- `slug`
- `title`
- `summary`
- `visibility`
- `display_order`
- `published_at`
- `created_at`
- `updated_at`

约束：

- 同一 part 下 chapter slug 唯一。

### ComicPage

漫画页。

关键字段：

- `id`
- `chapter_id`
- `asset_id`
- `display_order`
- `width`
- `height`
- `created_at`
- `updated_at`

约束：

- 同一 chapter 下 `display_order` 唯一。

### ComicPartUserLink

漫画 Part 与用户的 owner 关系。

关键字段：

- `id`
- `part_id`
- `user_id`
- `role`
- `created_at`

约束：

- 同一 part/user 只能有一条关系。

当前 author 漫画接口只允许用户操作 `role="owner"` 的 Part。

### ComicUploadImage

漫画待传区图片。

关键字段：

- `id`
- `user_id`
- `original_filename`
- `stored_filename`
- `storage_path`
- `content_type`
- `size_bytes`
- `display_order`
- `created_at`
- `updated_at`

实际文件位于：

```txt
backend/import_data/users/{user_id}/comic-staging/
```

限制：

- 单文件 20MB。
- 单用户待传区 100MB。
- 支持 jpg、jpeg、png、webp。

## 小说表

### Novel

小说。

关键字段：

- `id`
- `slug`
- `title`
- `summary`
- `cover_asset_id`
- `display_order`
- `created_at`
- `updated_at`

当前小说模型没有 `visibility` / `status` 字段。

### NovelChapter

小说章节。

关键字段：

- `id`
- `novel_id`
- `slug`
- `title`
- `content`
- `display_order`
- `created_at`
- `updated_at`

约束：

- 同一 novel 下 chapter slug 唯一。

正文：

- `content` 为 Markdown。
- 新建章节编辑器可用 `plain_text` buffer，发布时转为 Markdown。

### NovelChapterImage

小说章节正文图片关系表，文件元数据仍在 `Asset`。

关键字段：

- `id`
- `chapter_id`
- `asset_id`
- `display_order`
- `created_at`

约束：

- 同一 chapter 下 `display_order` 唯一。

当前规则：

- 只支持已有 chapter 上传图片。
- 每个 chapter 最多 20 张图片。
- 单张图片 10MB。
- 支持 jpg、jpeg、png、webp、gif。
- 后端返回 Markdown 图片链接，编辑器可复制或插入正文。

文件位置：

```txt
UPLOADS_DIR/novels/{novel_slug}/{chapter_slug}/images/
```

### NovelUserLink

小说与用户的 owner 关系。

关键字段：

- `id`
- `novel_id`
- `user_id`
- `role`
- `created_at`

约束：

- 同一 novel/user 只能有一条关系。

当前 author 小说接口只允许用户操作 `role="owner"` 的 Novel。

### NovelTextBuffer

小说正文缓冲区。

用途：

- 作者编辑已有章节时先载入 buffer。
- 作者创建新章节前可先保存 buffer。
- buffer 可发布到已有章节或发布成新章节。

关键字段：

- `id`
- `user_id`
- `novel_id`
- `chapter_id`
- `content_type`
- `content`
- `created_at`
- `updated_at`

`content_type` 当前支持：

```txt
markdown
plain_text
```

发布规则：

- `markdown` 原样写入章节。
- `plain_text` 按非空行转 Markdown 段落。
- 发布到已有章节后删除对应 buffer。
- 发布成新章节后创建 chapter 并删除 buffer。
