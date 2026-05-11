2026.5.10
# 后端项目结构与数据结构说明

本文档记录当前后端结构和漫画模块数据结构，用于避免后续开发中因旧目录、同名文件或错误导入路径导致项目跑偏。

当前技术栈：

- FastAPI
- SQLModel
- SQLite

## 1. 当前后端目录结构

```text
backend/
├── app/
│   ├── __init__.py
│   ├── main.py
│   ├── database.py
│   ├── models.py
│   ├── seed.py
│   └── routers/
│       ├── __init__.py
│       └── comics.py
├── data/
│   └── site.db
└── uploads/
2. 目录与文件作用
backend/app/

后端 Python 代码目录。

只放 FastAPI 应用代码、数据库连接、数据表模型、API 路由等代码文件。

不要把数据库文件、上传图片、缓存文件放进 app/。

backend/app/main.py

FastAPI 后端入口文件。

负责：

创建 FastAPI 应用。
启动时创建数据库表。
挂载 API 路由。
挂载 uploads 静态文件目录。
提供基础测试接口。

启动命令：

uvicorn app.main:app --reload

该命令应在 backend/ 目录下运行。

backend/app/database.py

数据库连接文件。

负责：

指定 SQLite 数据库路径。
创建数据库连接 engine。
提供 create_db_and_tables()。
提供 get_session() 给 API 使用。

当前数据库路径：

backend/data/site.db
backend/app/models.py

数据库表结构定义文件。

当前只定义漫画模块相关表：

asset
comic_series
comic_part
comic_chapter
comic_page

不要再使用单独的 models/ 文件夹。

backend/app/seed.py

开发阶段测试数据脚本。

用于向 SQLite 数据库插入一组测试漫画数据，验证数据库写入和表关系是否正常。

运行命令：

python -m app.seed

该命令应在 backend/ 目录下运行。

backend/app/routers/

API 路由目录。

用于存放不同模块的接口，避免所有接口都堆在 main.py 里。

当前已有：

routers/comics.py

用于漫画模块 API。

backend/data/

数据库文件目录。

当前 SQLite 数据库文件：

backend/data/site.db

该目录只放运行时数据库文件，不放 Python 代码。

backend/uploads/

上传文件目录。

用于存放漫画封面、漫画页图片、文章插图等静态资源。

数据库中的图片 URL 使用前端访问路径，例如：

/uploads/demo/demo-cover.jpg

实际文件位置对应：

backend/uploads/demo/demo-cover.jpg

FastAPI 通过静态文件挂载，把 /uploads 映射到 backend/uploads。

3. 当前数据结构

当前阶段只重点处理漫画模块。

漫画模块采用以下层级：

ComicSeries
├── cover_asset_id -> Asset
└── ComicPart
    ├── cover_asset_id -> Asset
    └── ComicChapter
        └── ComicPage
            └── asset_id -> Asset
含义：

一个漫画系列可以包含多个分部。
一个分部可以包含多个章节。
一个章节可以包含多张漫画页。
系列和分部都有一个自己的封面
漫画页通过 Asset 关联具体图片资源。
漫画系列也通过 Asset 关联封面资源。
4. 当前数据库表
asset

上传资源表。

用于统一管理图片、封面和后续其他上传文件。

主要字段：

id
series_id
slug
title
summary
cover_asset_id
status
visibility
display_order
created_at
updated_at

其中 cover_asset_id 是可选字段，用于关联 Asset 表中的图片资源，作为该分部的封面。一个分部可以没有单独封面。
当前常用 usage：

comic_cover
comic_page
post_image
project_image
other
comic_series

漫画系列表。

对应一部漫画作品的整体条目。

主要字段：

id
slug
title
summary
cover_asset_id
status
visibility
display_order
created_at
updated_at

说明：

slug 用于前端路由。
cover_asset_id 关联 asset.id。
visibility = public 的内容才在公开页面展示。
comic_part

漫画分部表。

对应第一部、第二部、番外篇、短篇集等。

主要字段：

id
series_id
slug
title
summary
status
visibility
display_order
created_at
updated_at

说明：

series_id 关联 comic_series.id。
同一个系列下，分部 slug 不应重复。
comic_chapter

漫画章节表。

对应第 1 话、第 2 话、番外 1 等。

主要字段：

id
part_id
slug
title
summary
visibility
display_order
published_at
created_at
updated_at

说明：

part_id 关联 comic_part.id。
同一个分部下，章节 slug 不应重复。
published_at 可以为空。
comic_page

漫画页表。

对应章节中的单张漫画图片。

主要字段：

id
chapter_id
asset_id
display_order
width
height
created_at
updated_at

说明：

chapter_id 关联 comic_chapter.id。
asset_id 关联 asset.id。
阅读页按 display_order 从小到大展示图片。
5. 当前字段约定
id

数据库内部唯一标识。

用于表之间关联，不作为前端主要路由参数。

slug

前端 URL 使用的可读标识。

示例：

/comics/demo-comic
/comics/demo-comic/chapter-1
display_order

显示顺序。

对应文档中的 order 概念。

实际数据库字段使用 display_order，避免和 SQL 的 ORDER BY 关键字混淆。

status

内容状态。

当前约定值：

draft
planning
ongoing
finished
paused
visibility

可见性。

当前约定值：

public
private

公开页面只展示 visibility = public 的内容。
