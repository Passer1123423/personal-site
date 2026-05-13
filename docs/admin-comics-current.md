# Admin Comics Current Implementation

本文档用于锚定当前漫画后台管理功能的实际实现状态。

当前 admin 功能只服务于本地内容管理，不是完整后台系统。目标是方便作者在本地上传漫画章节、查看漫画结构、删除测试章节。

公开展示页面和后台管理页面必须分开。

公开展示页面：

/works/comics
/works/comics/:seriesSlug
/works/comics/:seriesSlug/:partSlug/:chapterSlug

后台管理页面：

/admin/comics

公开展示 API：

/api/comics

后台管理 API：

/api/admin/comics

## 1. 当前已实现功能

当前已经基本实现漫画后台管理的最小闭环：

1. 查看漫画结构
2. 选择已有 series / part
3. 新建 series / part 并上传章节
4. 上传多张图片并创建新 chapter
5. 删除 chapter
6. 上传成功后刷新漫画结构
7. 删除成功后刷新漫画结构
8. 前端对重复 slug 做提示和拦截，避免误操作

当前不实现完整后台系统，只实现本地发布工具。

## 2. 后端相关文件

当前后端 admin 相关文件：

backend/app/dependencies/auth.py
backend/app/routers/comic_admin.py
backend/app/services/comic_admin.py
backend/app/main.py

### 2.1 auth.py

位置：

backend/app/dependencies/auth.py

作用：

预留后台权限入口。

当前实现：

def require_admin_user():
    return {
        "id": "local-admin",
        "role": "admin",
    }

当前阶段不做真实登录验证。

后续如果接入账号系统，只替换 require_admin_user() 的实现，不修改具体 admin API。

### 2.2 comic_admin router

位置：

backend/app/routers/comic_admin.py

作用：

提供漫画后台管理 API。

当前 prefix：

/api/admin/comics

当前已实现接口：

GET /api/admin/comics/tree
POST /api/admin/comics/chapters
DELETE /api/admin/comics/{series_slug}/{part_slug}/{chapter_slug}

### 2.3 main.py

main.py 中已经注册 admin router。

当前公开 comics router 和 admin comics router 分开注册。

后台接口不混入公开展示接口。

## 3. 当前后端 API

### 3.1 获取 admin 漫画结构

GET /api/admin/comics/tree

用途：

获取所有 series / part / chapter 结构，用于后台页面选择和展示。

返回层级：

ComicSeries
└── ComicPart
    └── ComicChapter

当前返回字段包括：

series:
- id
- slug
- title
- visibility
- displayOrder
- parts

part:
- id
- slug
- title
- visibility
- displayOrder
- chapters

chapter:
- id
- slug
- title
- visibility
- displayOrder
- pageCount

说明：

admin tree 用于后台管理，不等同于公开展示 API。
后续如果有 hidden / draft 内容，可以优先让 admin tree 返回。

### 3.2 上传并创建新章节

POST /api/admin/comics/chapters

Content-Type:

multipart/form-data

当前表单字段：

series_slug: string
part_slug: string
chapter_title: string | null
series_title: string | null
part_title: string | null
files: File[]

当前规则：

1. series_slug 必填
2. part_slug 必填
3. chapter_title 可空
4. series_title 可空
5. part_title 可空
6. files 必填
7. files 支持多图上传
8. 后端按接收到的文件顺序保存到临时目录
9. 临时目录中的文件按 001.jpg、002.jpg、003.jpg 等顺序命名
10. 最终调用 app/services/comic_admin.py 中的 import_comic_chapter_from_dir()
11. service 负责创建 chapter、asset、comic_page
12. page.display_order 决定阅读顺序
13. asset 不承担页序

当前 service 函数：

def import_comic_chapter_from_dir(
    session: Session,
    source_dir: Path,
    series_slug: str,
    part_slug: str,
    series_title: str | None = None,
    series_summary: str | None = None,
    part_title: str | None = None,
    part_summary: str | None = None,
    chapter_title: str | None = None,
    uploads_root: Path | None = UPLOADS_ROOT,
    series_display_order: int | None = None,
    part_display_order: int | None = None,
):

重要约定：

1. 必要参数只有 session、source_dir、series_slug、part_slug
2. title / summary / display_order 是客制化参数，可空
3. service 支持自动创建不存在的 series / part
4. 前端对重复 slug 的提示只是为了避免用户混淆
5. 后端不额外做存在性检查
6. 后续调用 service 时必须先核对实际函数签名，不要凭设想写参数

Swagger UI 中多文件上传显示可能不稳定。
实际测试以 curl 和前端 FormData 为准。

### 3.3 删除章节

DELETE /api/admin/comics/{series_slug}/{part_slug}/{chapter_slug}

用途：

删除一个 chapter。

当前调用 service：

delete_chapter(
    session=session,
    series_slug=series_slug,
    part_slug=part_slug,
    chapter_slug=chapter_slug,
)

当前 service 行为：

1. 查找 chapter
2. 删除 uploads 中对应 chapter 文件夹
3. 删除 ComicPage
4. 删除 Asset
5. 删除 ComicChapter
6. 重排该 part 下的 chapter.display_order

当前版本不提供 deleteFiles 参数。

也就是说，删除 chapter 时会同时删除数据库记录和 uploads 文件。

## 4. 前端相关文件

当前前端 admin 相关文件：

frontend/src/api/adminComics.ts
frontend/src/pages/AdminComicsPage.tsx
frontend/src/App.tsx

### 4.1 adminComics.ts

位置：

frontend/src/api/adminComics.ts

作用：

封装后台漫画管理 API 请求。

当前 API base URL：

http://127.0.0.1:18001

当前函数：

fetchAdminComicsTree()
uploadAdminComicChapter()
deleteAdminComicChapter()

当前类型：

AdminComicSeries
AdminComicPart
AdminComicChapter

### 4.2 AdminComicsPage.tsx

位置：

frontend/src/pages/AdminComicsPage.tsx

当前页面路由：

/admin/comics

当前页面功能：

1. 加载 admin comics tree
2. 展示当前漫画结构
3. 选择已有 series
4. 选择已有 part
5. 选择“+ 新建 series”
6. 选择“+ 新建 part”
7. 输入新 series slug / title
8. 输入新 part slug / title
9. 输入 chapter title
10. 选择多张图片
11. 显示待上传图片顺序
12. 上传并创建章节
13. 删除 chapter
14. 操作完成后刷新 tree

### 4.3 App.tsx

App.tsx 中已加入后台页面路由：

/admin/comics

admin 页面不挂在 /works 下。

## 5. 前端状态逻辑

当前 AdminComicsPage.tsx 中的核心状态：

tree:
后端返回的完整 admin tree。

selectedSeriesSlug:
当前选择的已有 series slug。

selectedPartSlug:
当前选择的已有 part slug。

seriesMode:
existing 或 new。

partMode:
existing 或 new。

newSeriesSlug:
新建 series 时输入的 slug。

newSeriesTitle:
新建 series 时输入的标题，可空。

newPartSlug:
新建 part 时输入的 slug。

newPartTitle:
新建 part 时输入的标题，可空。

chapterTitle:
上传新章节时输入的章节标题，可空。

files:
当前选择的图片文件数组。

loading:
是否正在加载 tree。

submitting:
是否正在上传或删除。

errorMessage:
前端错误提示。

## 6. slug 选择与绑定逻辑

前端不是靠按钮本身记住数据，而是靠后端返回的 tree 数据绑定 slug。

series select 中：

用户看到的是 series.title 和 series.slug。
实际 value 是 series.slug。

part select 中：

用户看到的是 part.title 和 part.slug。
实际 value 是 part.slug。

删除 chapter 按钮渲染时绑定：

series.slug
part.slug
chapter.slug

点击删除按钮时，请求：

DELETE /api/admin/comics/{series_slug}/{part_slug}/{chapter_slug}

这就是前端按钮和后端数据对应的方式。

## 7. 新建 series / part 的当前规则

当前 admin 页面允许选择：

+ 新建 series
+ 新建 part

新建时，前端提交：

series_slug
part_slug
series_title
part_title
chapter_title
files

当前约定：

1. series_slug 必填
2. part_slug 必填
3. series_title 可空
4. part_title 可空
5. chapter_title 可空
6. 如果 title 为空，后端 service 使用默认值
7. 前端只做重复 slug 提示和拦截
8. 后端不做额外存在性检查

重复 slug 处理：

1. 如果用户选择“新建 series”，但输入的 series_slug 已存在，前端拒绝上传并提示
2. 如果用户选择“新建 part”，但输入的 part_slug 在当前已有 series 下已存在，前端拒绝上传并提示
3. 输入内容不清空，方便用户修改

这个逻辑只是为了避免用户混淆，不是安全校验。

## 8. 文件上传规则

前端使用：

FormData

字段：

series_slug
part_slug
series_title
part_title
chapter_title
files

图片 input 使用：

multiple

说明：

1. 可以选择多张图片
2. Windows 文件选择窗口中可用 Ctrl / Shift 多选
3. 前端显示当前已选择的文件名顺序
4. 后端按接收到的文件顺序保存临时文件
5. 临时文件名为 001、002、003 等
6. service 导入后生成 ComicPage.display_order

当前没有实现拖拽排序。
第一版只按文件选择顺序上传。

## 9. 当前不要继续扩展的功能

以下功能暂时不做：

1. 删除 series 的前端按钮
2. 删除 part 的前端按钮
3. 单独新建空 series
4. 单独新建空 part
5. 编辑 series 元信息
6. 编辑 part 元信息
7. 编辑 chapter 元信息
8. 删除单页 page
9. 已发布 chapter 的图片重排
10. 拖拽排序上传图片
11. 账号登录页面
12. 真实权限系统

原因：

当前目标是先稳定本地漫画发布工具。
series / part 删除风险较高，容易误删大量内容。
空 series / part 新建涉及更多元信息字段，放到后续阶段处理。

## 10. 当前已知注意点

1. 后端 service 是实际业务逻辑中心
2. API router 不直接重写数据库业务逻辑
3. 前端只通过 admin API 操作后端
4. 前端不直接操作 SQLite
5. 前端不直接操作 uploads
6. 调用 service 前必须核对实际函数签名
7. Swagger UI 对多文件上传显示可能不准
8. curl 和前端 FormData 测试更可靠
9. 当前删除 chapter 会删除数据库记录和文件
10. 当前 delete chapter 没有 deleteFiles 可选项

## 11. 当前测试通过的链路

当前核心链路已经跑通：

1. 浏览器访问 /admin/comics
2. 前端加载 /api/admin/comics/tree
3. 页面显示 series / part / chapter
4. 选择已有 series / part
5. 选择多张图片
6. 上传并创建 chapter
7. 上传完成后 tree 刷新
8. 新 chapter 在后台页面可见
9. 新 chapter 在公开展示页面可见
10. 删除 chapter
11. 删除完成后 tree 刷新
12. 被删除 chapter 从后台结构中消失

## 12. 后续开发顺序建议

下一阶段建议顺序：

1. 保持当前 admin 核心功能不变
2. 继续测试不同 series / part 下的上传
3. 测试新建 series + 新建 part + 上传章节
4. 测试删除刚上传的测试 chapter
5. 确认 uploads 目录和数据库一致
6. 再考虑是否做图片预览和拖拽排序
7. 最后再考虑 series / part 删除和编辑功能

不要在当前阶段急着扩展完整后台系统。
