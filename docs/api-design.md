# API Design

当前后端使用 FastAPI 提供接口。
当前阶段只实现漫画展示相关 API。

## 1. 基础约定

后端地址：

```txt
http://127.0.0.1:8000

前端请求时统一通过 src/api/comics.ts 封装。

静态资源地址由后端返回相对路径，例如：

/uploads/demo/demo-cover.jpg

前端使用 resolveAssetUrl(url) 转换为完整地址。
```
## 2. 漫画数据层级
```txt
ComicSeries
├── cover_asset_id -> Asset
└── ComicPart
    ├── cover_asset_id -> Asset
    └── ComicChapter
        └── ComicPage
            └── asset_id -> Asset

说明：

ComicSeries 表示一个漫画系列。
ComicPart 表示系列下的一部、卷、篇章或短篇集。
ComicChapter 表示某一部下面的一话或一章。
ComicPage 表示章节中的单页图片。
Asset 表示实际图片资源。
```
## 3. 获取漫画系列列表
```
GET /api/comics

用途：

获取所有公开漫画系列，用于 /works/comics 页面。

返回示例：

[
  {
    "id": "series-id",
    "slug": "demo-comic",
    "title": "测试漫画",
    "summary": "这是用于验证数据库结构的测试漫画。",
    "status": "ongoing",
    "visibility": "public",
    "displayOrder": 1,
    "coverUrl": "/uploads/demo/demo-cover.jpg",
    "createdAt": "2026-05-10T18:07:03.334660",
    "updatedAt": "2026-05-10T18:07:03.334672"
  }
]

前端页面：

/works/comics
```
## 4. 获取漫画系列详情
```
GET /api/comics/{series_slug}

用途：

获取某个漫画系列的详情，包括系列信息、分部列表和章节列表。

返回示例：

{
  "id": "series-id",
  "slug": "demo-comic",
  "title": "测试漫画",
  "summary": "这是用于验证数据库结构的测试漫画。",
  "status": "ongoing",
  "visibility": "public",
  "displayOrder": 1,
  "coverUrl": "/uploads/demo/demo-cover.jpg",
  "createdAt": "2026-05-10T18:07:03.334660",
  "updatedAt": "2026-05-10T18:07:03.334672",
  "parts": [
    {
      "id": "part-id",
      "slug": "part-1",
      "title": "第一部",
      "summary": "测试漫画的第一部分。",
      "status": "ongoing",
      "visibility": "public",
      "displayOrder": 1,
      "coverUrl": "/uploads/demo/demo-part-1-cover.jpg",
      "createdAt": "2026-05-10T18:07:03.336367",
      "updatedAt": "2026-05-10T18:07:03.336378",
      "chapters": [
        {
          "id": "chapter-id",
          "slug": "chapter-1",
          "title": "第 1 话",
          "summary": "这是测试章节。",
          "visibility": "public",
          "displayOrder": 1,
          "publishedAt": null,
          "createdAt": "2026-05-10T18:07:03.337731",
          "updatedAt": "2026-05-10T18:07:03.337741"
        }
      ]
    }
  ]
}

前端页面：

/works/comics/:seriesSlug
```
## 5. 获取漫画阅读数据
```
GET /api/comics/{series_slug}/{part_slug}/{chapter_slug}

用途：

获取某一章的阅读数据，包括章节信息、页数和图片列表。

返回示例：

{
  "series": {
    "id": "series-id",
    "slug": "demo-comic",
    "title": "测试漫画"
  },
  "part": {
    "id": "part-id",
    "slug": "part-1",
    "title": "第一部"
  },
  "chapter": {
    "id": "chapter-id",
    "slug": "chapter-1",
    "title": "第 1 话",
    "summary": "这是测试章节。",
    "publishedAt": null,
    "createdAt": "2026-05-10T18:07:03.337731",
    "updatedAt": "2026-05-10T18:07:03.337741"
  },
  "pageCount": 2,
  "pages": [
    {
      "id": "page-id-1",
      "displayOrder": 1,
      "imageUrl": "/uploads/demo/demo-page-001.jpg",
      "width": null,
      "height": null,
      "createdAt": "2026-05-10T18:07:03.338000",
      "updatedAt": "2026-05-10T18:07:03.338000"
    }
  ]
}

前端页面：

/works/comics/:seriesSlug/:partSlug/:chapterSlug
```

## 4.上传图片注册
```
早期的上传功能只支持图片上传。那作者肯定是先选择一个系列、分部然后上传。章节可以按单次上传直接累加划分，page应该是像发微信朋友圈一样，可以按选择时间、或手动点击决定顺序，让图片右上角显示个带数字的圈。这样从series到page的标号就都有了。
早期上传功能：
选择 series / part
上传多张图片
前端显示预览和页码圈
允许手动调整顺序
提交后创建一个 chapter
每张图片生成 asset
每张图片生成 comic_page
用 display_order 记录最终页序
display_order 必须连贯，如果有删除需要将后续的序号往前递进重排

202605122031新增
# Admin API Design

当前 admin API 只用于本地内容管理。

公开展示接口使用：

/api/comics

后台管理接口使用：

/api/admin/comics

二者必须分开，避免把上传、删除等管理操作混入公开展示接口。
```

## 1. 权限预留
```
当前阶段网站只在 local 运行，暂不实现账号系统。

但所有 admin API 都必须统一经过权限依赖函数：

require_admin_user()

当前 require_admin_user() 可以直接返回 local admin。

后续接入账号系统时，只替换 require_admin_user() 的实现，不修改具体业务接口。
```
## 2. 获取 admin 漫画结构
```
GET /api/admin/comics/tree

用途：

获取所有漫画系列、分部、章节。

用于 admin 页面选择 series / part，以及展示可删除章节。

返回结构：

[
  {
    "id": "series-id",
    "slug": "demo-comic",
    "title": "测试漫画",
    "visibility": "public",
    "displayOrder": 1,
    "parts": [
      {
        "id": "part-id",
        "slug": "part-1",
        "title": "第一部",
        "visibility": "public",
        "displayOrder": 1,
        "chapters": [
          {
            "id": "chapter-id",
            "slug": "chapter-001",
            "title": "第1话",
            "visibility": "public",
            "displayOrder": 1,
            "pageCount": 12
          }
        ]
      }
    ]
  }
]
```
## 3. 上传并发布新章节
```
POST /api/admin/comics/chapters

Content-Type:

multipart/form-data

用途：

上传一批图片，并自动创建一个新的 ComicChapter。

表单字段：

seriesSlug: string
partSlug: string
titleSuffix: string | null
files: File[]

规则：

-第一版前端优先选择已有 series 和已有 part。
-后端 service 支持在 series_slug 或 part_slug 不存在时自动创建，但普通 admin 页面暂不提供完整的新建表单。
-后续若需要新建 series / part，再补充 title / summary / display_order 等可空客制化字段。
- 前端负责显示图片预览和页码顺序
- 前端按最终页序提交 files
- 后端按接收到的 files 顺序生成 ComicPage.display_order
- 后端自动创建 chapter
- chapter.slug 自动递增
- chapter.title 自动生成，可追加 titleSuffix
- 每张图片创建一个 Asset
- 每张图片创建一个 ComicPage
- Asset 不承担页序
- ComicPage.display_order 决定阅读顺序

返回示例：

{
  "seriesSlug": "demo-comic",
  "partSlug": "part-1",
  "chapterSlug": "chapter-003",
  "chapterTitle": "第3话 相遇",
  "pageCount": 12
}
```
## 4. 删除章节
```
DELETE /api/admin/comics/{series_slug}/{part_slug}/{chapter_slug}

Query 参数：

deleteFiles: boolean = true

用途：

删除一个 ComicChapter。

规则：

- 删除 chapter 下属 ComicPage
- 删除 ComicChapter
- 可选删除 uploads 中对应章节文件夹
- 删除后重排后续 chapter.display_order
- chapter.slug 不因重排改变

返回示例：

{
  "deleted": true,
  "seriesSlug": "demo-comic",
  "partSlug": "part-1",
  "chapterSlug": "chapter-003"
}
```
## 5. 删除 part
```
DELETE /api/admin/comics/{series_slug}/{part_slug}

Query 参数：

series_slug/part_slug

用途：
调用删除chapter函数删除part_slug所属的所有chapter
注销part以及删除封面

第一版可以先不接前端按钮，只保留接口设计。
```
## 6. 删除章节
```
DELETE /api/admin/comics/{series_slug}/{part_slug}/{chapter_slug}

用途：

删除一个 ComicChapter。

当前规则：

1. 删除 chapter 下属 ComicPage
2. 删除 chapter 下属 Asset
3. 删除 ComicChapter
4. 删除 uploads 中对应章节文件夹
5. 删除后重排后续 chapter.display_order
6. chapter.slug 不因重排改变

当前版本不提供 deleteFiles 参数。
后续如果需要只删数据库、不删文件，再改造 service 层。
```

## 7. 第一版 admin 页面

前端页面：

/admin/comics

功能：

1. 加载 /api/admin/comics/tree
2. 选择 series
3. 选择 part
4. 选择多张图片
5. 生成图片预览
6. 显示页码顺序
7. 提交发布新 chapter
8. 展示已有 chapter
9. 支持删除 chapter

暂不实现：

- 登录页面
- 账号系统
- 删除单页
- 修改已发布章节顺序
- 编辑 series / part 元信息