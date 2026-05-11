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

2. 漫画数据层级
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
3. 获取漫画系列列表
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
4. 获取漫画系列详情
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
5. 获取漫画阅读数据
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

6.上传图片注册
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
