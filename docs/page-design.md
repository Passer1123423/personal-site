# Page Design

本文档描述当前前端路由和页面状态。实际路由定义在：

```txt
frontend/src/App.tsx
```

## 路由总览

| 路由 | 页面组件 | 当前状态 |
|---|---|---|
| `/` | `HomePage` | 已实现 |
| `/projects` | `ProjectsPage` | 静态项目列表 |
| `/works` | `WorksPage` | 作品入口页 |
| `/works/comics` | `ComicsPage` | 已接公开漫画 API |
| `/works/comics/:seriesSlug` | `ComicSeriesPage` | 已接公开漫画 API |
| `/works/comics/:seriesSlug/:partSlug/:chapterSlug` | `ComicReaderPage` | 已接公开漫画 API |
| `/about` | `AboutPage` | 已实现 |
| `/admin/comics` | `AdminComicsPage` | 已接后台漫画 API |

注意：

- 当前真实路由使用 `/works`，不是 `/work`。
- 漫画阅读路由包含 `seriesSlug`、`partSlug`、`chapterSlug` 三段。
- 当前没有单独的 `/novels`、`/posts` 路由。

## 首页

路由：

```txt
/
```

组件：

```txt
frontend/src/pages/HomePage.tsx
```

当前内容：

- `Hero`
- 精选项目
- 小说存档入口
- 漫画存档入口

当前首页中的小说和漫画入口都指向 `/works`。

## Projects 页面

路由：

```txt
/projects
```

组件：

```txt
frontend/src/pages/ProjectsPage.tsx
```

当前数据来源：

```txt
frontend/src/data/projects.ts
```

当前是静态项目列表，没有后端项目 API。

## Works 页面

路由：

```txt
/works
```

组件：

```txt
frontend/src/pages/WorksPage.tsx
```

当前内容：

- 小说存档卡片，暂无后端闭环。
- 漫画存档卡片，点击进入 `/works/comics`。

## 漫画列表页

路由：

```txt
/works/comics
```

组件：

```txt
frontend/src/pages/ComicsPage.tsx
```

前端调用：

```ts
getComicSeriesList()
```

后端接口：

```txt
GET /api/comics
```

页面状态：

- loading
- error
- empty
- series card list

每个卡片链接到：

```txt
/works/comics/{series.slug}
```

## 漫画系列详情页

路由：

```txt
/works/comics/:seriesSlug
```

组件：

```txt
frontend/src/pages/ComicSeriesPage.tsx
```

前端调用：

```ts
getComicSeriesDetail(seriesSlug)
```

后端接口：

```txt
GET /api/comics/{series_slug}
```

页面展示：

- series 标题
- series 简介
- series 封面或占位图
- series status
- series visibility
- parts 列表
- 每个 part 下的 chapter 入口

每个 chapter 链接到：

```txt
/works/comics/{series.slug}/{part.slug}/{chapter.slug}
```

## 漫画阅读页

路由：

```txt
/works/comics/:seriesSlug/:partSlug/:chapterSlug
```

组件：

```txt
frontend/src/pages/ComicReaderPage.tsx
```

前端调用：

```ts
getComicReaderData(seriesSlug, partSlug, chapterSlug)
```

后端接口：

```txt
GET /api/comics/{series_slug}/{part_slug}/{chapter_slug}
```

页面展示：

- 返回系列详情页链接
- chapter 标题
- series / part / pageCount
- chapter summary
- 按 `pages[].displayOrder` 渲染图片

图片地址处理：

```ts
resolveAssetUrl(page.imageUrl)
```

## 漫画后台页

路由：

```txt
/admin/comics
```

组件：

```txt
frontend/src/pages/AdminComicsPage.tsx
```

前端 API：

```txt
frontend/src/api/adminComics.ts
```

后端 API prefix：

```txt
/api/admin/comics
```

当前页面功能：

- 加载后台漫画树。
- 上传新 chapter。
- 选择已有 series / part。
- 新建 series / part。
- 删除 series / part / chapter。
- 上移 / 下移 chapter。
- 显示成功和错误消息。

当前页面不是公开展示页面，不应混入 `/works/comics` 的公开阅读流程。

## 命名对接

前端路由参数：

```txt
seriesSlug
partSlug
chapterSlug
```

后端路径参数：

```txt
series_slug
part_slug
chapter_slug
```

前端 API 层负责在 URL 中拼接 slug。

API 返回字段：

```txt
displayOrder
coverUrl
createdAt
updatedAt
publishedAt
```

数据库字段：

```txt
display_order
cover_asset_id
created_at
updated_at
published_at
```
