# 数据模型设计

当前阶段重点设计漫画模块。小说、项目、随笔模块暂时只保留扩展位置，后续再单独补充。

本文档只描述业务数据模型，不绑定具体前端组件、页面样式或数据库实现。后续前端 mock 数据、FastAPI 接口返回值、数据库表结构都应尽量向本文档对齐。

## 1. 设计原则

数据模型先于前端实现。

前端中的 mock 数据只用于临时展示，不作为最终数据模型的来源。后续 mock 数据应根据本文档调整。

数据模型中只保存内容本身，不保存纯前端样式字段。

例如：

| 不应进入正式数据模型 | 应进入正式数据模型 |
|---|---|
| `coverClass` | `coverAssetId` 或 `coverUrl` |
| 渐变色类名 | 封面图片 |
| 卡片布局样式 | 标题、简介、状态、更新时间 |
| 页面动画配置 | 排序、章节、图片资源 |

前端可以根据正式数据自行决定如何展示样式。

## 2. 当前模块范围

当前阶段只重点设计漫画模块。

漫画模块采用以下层级：

    漫画系列 ComicSeries
    └── 分部 ComicPart
        └── 章节 ComicChapter
            └── 漫画页 ComicPage
                └── 图片资源 Asset

说明：

1. 一个漫画系列可以包含多个分部。
2. 一个分部可以包含多个章节。
3. 一个章节可以包含多张漫画图片。
4. 漫画图片按顺序纵向展示。
5. 图片文件统一作为 Asset 管理。

## 3. 通用字段约定

多数数据对象都可以包含以下通用字段：

| 字段 | 含义 |
|---|---|
| `id` | 内部唯一标识 |
| `slug` | 用于 URL 的可读标识 |
| `order` | 排序序号 |
| `createdAt` | 创建时间 |
| `updatedAt` | 更新时间 |

说明：

1. `id` 用于数据库内部关联。
2. `slug` 用于前端路由。
3. `order` 用于控制显示顺序。
4. 前端路由优先使用 `slug`，不要直接暴露数据库 `id`。

示例：

| 页面 | 路由 |
|---|---|
| 漫画系列详情页 | `/comics/:seriesSlug` |
| 漫画分部详情页 | `/comics/:seriesSlug/:partSlug` |
| 漫画阅读页 | `/comics/:seriesSlug/:partSlug/:chapterSlug` |
1. `seriesSlug` 用于定位漫画系列。
2. `partSlug` 用于定位系列下的分部。
3. `chapterSlug` 用于定位分部下的章节

## 4. 枚举约定

### 4.1 内容状态 status

| 值 | 中文显示 | 含义 |
|---|---|---|
| `draft` | 草稿 | 尚未公开发布 |
| `planning` | 筹备中 | 条目已建立，但内容未正式开始 |
| `ongoing` | 连载中 | 正在更新 |
| `finished` | 已完结 | 已完成 |
| `paused` | 暂停更新 | 暂时停止更新 |

### 4.2 可见性 visibility

| 值 | 中文显示 | 含义 |
|---|---|---|
| `public` | 公开 | 前台页面可见 |
| `private` | 私有 | 仅后台可见 |

说明：

1. 后端建议存英文枚举。
2. 前端负责将英文枚举显示为中文。
3. 公开页面只展示 `visibility = public` 的内容。

## 5. 漫画系列 ComicSeries

漫画系列表示一部漫画作品的整体条目。

例如：

- 某个长篇漫画
- 某个短篇漫画集
- 某个世界观下的主线漫画

建议字段：

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | 内部唯一标识 |
| `slug` | string | URL 标识 |
| `title` | string | 系列标题 |
| `summary` | string | 系列简介 |
| `coverAssetId` | string / null | 封面资源 ID |
| `status` | enum | 系列状态 |
| `visibility` | enum | 是否公开 |
| `order` | number | 排序 |
| `createdAt` | datetime | 创建时间 |
| `updatedAt` | datetime | 更新时间 |

说明：

1. `title` 用于页面显示。
2. `slug` 用于路由，例如 `/comics/example-series`。
3. `summary` 用于列表页和详情页简介。
4. `coverAssetId` 关联上传资源，不直接保存前端样式。
5. `status` 表示整个系列的状态。
6. `visibility` 控制是否在公开页面显示。
7. `order` 决定系列在漫画列表中的显示顺序。

## 6. 漫画分部 ComicPart

漫画分部表示一个漫画系列下的“部”“卷”“篇章”或“短篇集”。

例如：

- 第一部
- 第二部
- 番外篇
- 短篇集
- 设定集

建议字段：

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | 内部唯一标识 |
| `seriesId` | string | 所属漫画系列 ID |
| `slug` | string | 分部标识 |
| `title` | string | 分部标题 |
| `summary` | string / null | 分部简介 |
| `status` | enum | 分部状态 |
| `visibility` | enum | 是否公开 |
| `order` | number | 在系列中的排序 |
| `createdAt` | datetime | 创建时间 |
| `updatedAt` | datetime | 更新时间 |

说明：

1. 一个 `ComicSeries` 可以包含多个 `ComicPart`。
2. `seriesId` 用于关联所属漫画系列。
3. `order` 决定分部在系列详情页中的显示顺序。
4. 分部可以有自己的状态。例如系列整体连载中，但第二部仍处于筹备中。

## 7. 漫画章节 ComicChapter

漫画章节表示某个分部下的一话、一章或一个短篇。

例如：

- 第 1 话
- 第 2 话
- 番外 1
- 角色设定 01

建议字段：

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | 内部唯一标识 |
| `partId` | string | 所属分部 ID |
| `slug` | string | 章节 URL 标识 |
| `title` | string | 章节标题 |
| `summary` | string / null | 章节简介或备注 |
| `visibility` | enum | 是否公开 |
| `order` | number | 在分部中的排序 |
| `publishedAt` | datetime / null | 发布时间 |
| `createdAt` | datetime | 创建时间 |
| `updatedAt` | datetime | 更新时间 |

说明：

1. 一个 `ComicPart` 可以包含多个 `ComicChapter`。
2. `partId` 用于关联所属分部。
3. `slug` 用于阅读页路由。
4. `order` 决定章节顺序。
5. `publishedAt` 为空时，可以表示尚未正式发布。
6. 公开页面只显示 `visibility = public` 的章节。

## 8. 漫画页 ComicPage

漫画页表示一个章节中的单张图片。

一个漫画章节通常包含多张漫画页，阅读页按照 `order` 从小到大纵向展示。

建议字段：

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | 内部唯一标识 |
| `chapterId` | string | 所属章节 ID |
| `assetId` | string | 图片资源 ID |
| `order` | number | 在章节中的页码顺序 |
| `width` | number / null | 图片宽度 |
| `height` | number / null | 图片高度 |
| `createdAt` | datetime | 创建时间 |
| `updatedAt` | datetime | 更新时间 |

说明：

1. 一个 `ComicChapter` 可以包含多个 `ComicPage`。
2. `chapterId` 用于关联所属章节。
3. `assetId` 关联具体图片资源。
4. `order` 决定图片显示顺序。
5. `width` 和 `height` 可选，用于前端优化图片显示。

## 9. 上传资源 Asset

上传资源用于统一管理图片、封面、漫画页、文章插图等文件。

当前阶段主要用于漫画封面和漫画页图片。

建议字段：

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | 内部唯一标识 |
| `filename` | string | 存储后的文件名 |
| `originalName` | string | 原始文件名 |
| `mimeType` | string | 文件类型 |
| `size` | number | 文件大小 |
| `url` | string | 前端访问地址 |
| `usage` | enum | 文件用途 |
| `createdAt` | datetime | 上传时间 |

### 9.1 资源用途 usage

| 值 | 含义 |
|---|---|
| `comic_cover` | 漫画封面 |
| `comic_page` | 漫画页 |
| `post_image` | 文章图片 |
| `project_image` | 项目图片 |
| `other` | 其他文件 |

说明：

1. 正式数据中不直接把图片塞进章节内容里。
2. 图片统一作为 `Asset` 管理。
3. 漫画章节通过 `ComicPage.assetId` 关联图片。
4. 漫画系列通过 `ComicSeries.coverAssetId` 关联封面。

## 10. 模型关系

漫画模块的数据关系如下：

| 关系 | 含义 |
|---|---|
| `ComicSeries 1 - n ComicPart` | 一个漫画系列有多个分部 |
| `ComicPart 1 - n ComicChapter` | 一个分部有多个章节 |
| `ComicChapter 1 - n ComicPage` | 一个章节有多张漫画页 |
| `ComicPage n - 1 Asset` | 多个漫画页分别关联具体图片资源 |
| `ComicSeries n - 1 Asset` | 多个漫画系列可以分别关联封面资源 |

结构示意：

    ComicSeries
    └── ComicPart
        └── ComicChapter
            └── ComicPage
                └── Asset

## 11. 前端 mock 数据与正式模型的关系

前端 mock 数据应逐步向本文档靠拢。

当前可以继续使用：

    frontend/src/data/mockComics.ts

但需要注意：

1. `id` 不应同时承担数据库 ID 和路由 slug 的功能。
2. 路由应优先使用 `slug`。
3. `coverClass` 这类前端样式字段不进入正式数据模型。
4. 封面后续应来自 `coverAssetId` 关联的资源，或 API 返回的 `coverUrl`。
5. 漫画图片后续应来自 `ComicPage`。
6. 前端显示的中文状态应由英文枚举映射得到。

## 12. 当前阶段可简化处理

在没有后端和数据库之前，前端 mock 数据可以适当简化。

当前阶段可以临时写成：

    ComicSeries
    └── ComicPart
        └── ComicChapter
            └── imageUrls

但正式数据模型仍按以下结构设计：

    ComicSeries
    └── ComicPart
        └── ComicChapter
            └── ComicPage
                └── Asset

这样后续接入文件上传和后端数据库时，不需要推翻整体结构。

## 13. API 返回时的补充说明

正式存储时，图片通过 `Asset` 关联。

但 API 返回给前端时，可以为了方便展示直接返回处理后的 URL。

例如：

| 存储层字段 | API 展示层字段 |
|---|---|
| `coverAssetId` | `coverUrl` |
| `ComicPage.assetId` | `ComicPage.imageUrl` |

也就是说，数据库可以存资源关联，前端不一定需要知道所有内部关联细节。
