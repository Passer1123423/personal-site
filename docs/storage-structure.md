# Storage Structure

本文档描述当前上传资源的目录结构。

## 后端静态资源根目录

FastAPI 在 `backend/app/main.py` 中挂载：

```py
app.mount(
    "/uploads",
    StaticFiles(directory=UPLOADS_DIR),
    name="uploads",
)
```

其中：

```txt
UPLOADS_DIR = backend/uploads
```

因此：

```txt
浏览器 URL: /uploads/...
实际文件: backend/uploads/...
```

## 漫画上传目录

当前漫画页图片保存在：

```txt
backend/uploads/comics/
```

目录结构：

```txt
backend/uploads/
└── comics/
    └── {series_slug}/
        └── {part_slug}/
            └── {chapter_slug}/
                ├── 001.jpg
                ├── 002.jpg
                └── ...
```

对外访问路径：

```txt
/uploads/comics/{series_slug}/{part_slug}/{chapter_slug}/001.jpg
```

该路径保存到：

```txt
Asset.url
```

## 文件命名规则

导入或上传章节时，每页图片会按页序重命名：

```txt
001.ext
002.ext
003.ext
```

扩展名来自源文件后缀的小写形式。

当前允许：

```txt
.jpg
.jpeg
.png
.webp
.gif
```

## 页序规则

阅读顺序由数据库决定：

```txt
ComicPage.display_order
```

不要使用这些信息作为页序：

```txt
文件名
Asset.id
Asset.created_at
原始文件名
```

文件名只是静态资源名。当前它通常与页序一致，但业务上仍以 `ComicPage.display_order` 为准。

## 删除规则

删除 chapter 时，service 会删除：

```txt
backend/uploads/comics/{series_slug}/{part_slug}/{chapter_slug}
```

对应函数：

```py
delete_chapter_files(series_slug, part_slug, chapter_slug)
```

删除 part 或 series 时，会逐层调用 chapter 删除逻辑。

## Asset 记录

每张漫画页图片对应一条 `Asset`。

当前导入时写入：

```txt
Asset.filename      = URL 中的文件名
Asset.original_name = 源文件名
Asset.mime_type     = 根据扩展名推断
Asset.size          = 源文件大小
Asset.url           = /uploads/comics/...
Asset.usage         = comic_page
```

`ComicPage.asset_id` 指向对应 `Asset.id`。
