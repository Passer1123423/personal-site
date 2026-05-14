# Admin Comics Current Implementation

本文档用于锚定当前漫画后台管理功能的实际实现状态。

当前 admin 功能只服务于本地内容管理，不是完整后台系统。目标是方便作者在本地上传漫画章节、查看漫画结构、删除测试内容、调整章节顺序。

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

当前已经实现漫画后台管理的本地最小管理闭环：

1. 查看漫画结构
2. 选择已有 series / part
3. 新建 series / part 并上传章节
4. 上传多张图片并创建新 chapter
5. 删除 chapter
6. 删除 part
7. 删除 series
8. 上移 chapter
9. 下移 chapter
10. 上传成功后刷新漫画结构
11. 删除成功后刷新漫画结构
12. 调整顺序成功后刷新漫画结构
13. 前端对重复 slug 做提示和拦截，避免误操作
14. 前端有成功提示和错误提示
15. 前端页面已经拆分为多个内部组件，避免主页面 JSX 过深

当前不实现完整后台系统，只实现本地漫画发布和管理工具。

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
DELETE /api/admin/comics/{series_slug}/{part_slug}
DELETE /api/admin/comics/{series_slug}
PATCH /api/admin/comics/{series_slug}/{part_slug}/{chapter_slug}/move

说明：

admin router 只负责接收请求、调用 service、返回结果。
具体业务逻辑仍然放在 app/services/comic_admin.py 中。

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
11. service 负责创建 series、part、chapter、asset、comic_page
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

chapter 标题生成规则：

如果传入 chapter_title：

title = f"第{next_order}话 {chapter_title}"

如果没有传入 chapter_title：

title = f"第{next_order}话"

因此章节标题中的“第X话”部分可以和 display_order 保持同步。

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

### 3.4 删除 part

DELETE /api/admin/comics/{series_slug}/{part_slug}

用途：

删除一个 part 及其下属所有 chapter。

当前调用 service：

delete_part(
    session=session,
    series_slug=series_slug,
    part_slug=part_slug,
)

当前 service 行为：

1. 查找 part
2. 查找该 part 下所有 chapter
3. 逐个调用 delete_chapter()
4. 删除 part cover asset
5. 删除 ComicPart

说明：

删除 part 会级联删除其下所有 chapter、page、asset 和对应 uploads 文件。
这是高风险操作，前端必须要求输入 part_slug 才能确认删除。

### 3.5 删除 series

DELETE /api/admin/comics/{series_slug}

用途：

删除一个 series 及其下属所有 part。

当前调用 service：

delete_series(
    session=session,
    series_slug=series_slug,
)

当前 service 行为：

1. 查找 series
2. 查找该 series 下所有 part
3. 逐个调用 delete_part()
4. 删除 series cover asset
5. 删除 ComicSeries

说明：

删除 series 会级联删除其下所有 part、chapter、page、asset 和对应 uploads 文件。
这是最高风险操作，前端必须要求输入 series_slug 才能确认删除。

### 3.6 移动 chapter 顺序

PATCH /api/admin/comics/{series_slug}/{part_slug}/{chapter_slug}/move

Content-Type:

application/json

请求体：

{
  "direction": "up"
}

或：

{
  "direction": "down"
}

用途：

上移或下移某个 chapter。

当前调用 service：

shift_chapter(
    session=session,
    series_slug=series_slug,
    part_slug=part_slug,
    chapter_slug=chapter_slug,
    direction=payload.direction,
)

当前 service 行为：

1. 查找当前 chapter
2. 根据 direction 找到相邻 chapter
3. 交换两个 chapter 的 display_order
4. 同步更新两个 chapter.title 中的“第X话”
5. session.commit()
6. 返回移动结果

当前返回示例：

移动成功：

{
  "moved": true,
  "chapterSlug": "chapter-002",
  "displayOrder": 1,
  "targetChapterSlug": "chapter-001",
  "targetDisplayOrder": 2
}

到达边界：

{
  "moved": false,
  "reason": "已经到边界，无法继续移动。",
  "chapterSlug": "chapter-002",
  "displayOrder": 2
}

说明：

1. chapter.slug 不变
2. chapter.id 不变
3. uploads 文件路径不变
4. 只交换 display_order
5. title 中的“第X话”随 display_order 更新
6. 公开展示页面的章节顺序也会随 display_order 改变

当前章节标题规则可以保证标题以“第X话”开头，因此自动替换标题编号是可控的。

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
deleteAdminComicPart()
deleteAdminComicSeries()
moveAdminComicChapter()

当前类型：

AdminComicSeries
AdminComicPart
AdminComicChapter

当前 moveAdminComicChapter() 请求：

PATCH /api/admin/comics/{seriesSlug}/{partSlug}/{chapterSlug}/move

请求体：

{
  "direction": "up" | "down"
}

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
14. 删除 part
15. 删除 series
16. 上移 chapter
17. 下移 chapter
18. 操作完成后刷新 tree
19. 显示成功提示
20. 显示错误提示
21. 成功提示自动消失
22. 错误提示自动消失

当前页面已经进行组件拆分。

当前内部组件结构：

AdminComicsPage
├── MessageArea
├── UploadChapterForm
└── ComicTreeView
    └── SeriesBlock
        └── PartBlock
            └── ChapterRow

说明：

1. AdminComicsPage 负责 state、请求、操作函数和页面总结构
2. MessageArea 负责显示成功和错误提示
3. UploadChapterForm 负责上传新章节表单
4. ComicTreeView 负责展示漫画结构
5. SeriesBlock 负责展示单个 series
6. PartBlock 负责展示单个 part
7. ChapterRow 负责展示单个 chapter 以及移动、删除按钮

拆分后避免 AdminComicsPage 的 JSX 过深，后续维护时优先保持这种分块结构。

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
是否正在上传、删除或移动。

errorMessage:
前端错误提示。

successMessage:
前端成功提示。

fileInputRef:
用于控制隐藏的文件 input，实现自定义“选择图片”按钮。

## 6. 提示信息逻辑

当前前端有两类提示：

errorMessage:
显示红色错误提示。

successMessage:
显示绿色成功提示。

当前规则：

1. 操作开始前通常清空旧的 errorMessage 和 successMessage
2. 操作成功后设置 successMessage
3. 操作失败后设置 errorMessage
4. successMessage 会在数秒后自动清空
5. errorMessage 会在数秒后自动清空

这样可以避免旧提示长期残留，造成操作结果混淆。

删除 part / series 时：

1. 用户输入正确 slug 并删除成功，显示成功提示
2. 用户输入错误 slug，显示错误提示
3. 用户点击取消，不执行操作

## 7. slug 选择与绑定逻辑

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

点击删除 chapter 时，请求：

DELETE /api/admin/comics/{series_slug}/{part_slug}/{chapter_slug}

删除 part 按钮渲染时绑定：

series.slug
part.slug

点击删除 part 时，请求：

DELETE /api/admin/comics/{series_slug}/{part_slug}

删除 series 按钮渲染时绑定：

series.slug

点击删除 series 时，请求：

DELETE /api/admin/comics/{series_slug}

移动 chapter 按钮渲染时绑定：

series.slug
part.slug
chapter.slug
direction

点击上移时，请求：

PATCH /api/admin/comics/{series_slug}/{part_slug}/{chapter_slug}/move

body:

{
  "direction": "up"
}

点击下移时，请求：

PATCH /api/admin/comics/{series_slug}/{part_slug}/{chapter_slug}/move

body:

{
  "direction": "down"
}

这就是前端按钮和后端数据对应的方式。

## 8. 新建 series / part 的当前规则

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

## 9. 文件上传规则

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

## 10. 删除规则

当前 admin 页面支持删除：

1. chapter
2. part
3. series

### 10.1 删除 chapter

删除 chapter 使用普通确认。

删除后会同时删除：

1. ComicChapter
2. ComicPage
3. Asset
4. uploads 中对应 chapter 文件夹

删除后会重排该 part 下的 chapter.display_order。

### 10.2 删除 part

删除 part 前必须输入 part_slug。

删除后会同时删除：

1. ComicPart
2. 其下所有 ComicChapter
3. 其下所有 ComicPage
4. 相关 Asset
5. uploads 中对应文件夹内容
6. part cover asset

这是高风险操作。

### 10.3 删除 series

删除 series 前必须输入 series_slug。

删除后会同时删除：

1. ComicSeries
2. 其下所有 ComicPart
3. 其下所有 ComicChapter
4. 其下所有 ComicPage
5. 相关 Asset
6. uploads 中对应文件夹内容
7. series cover asset

这是最高风险操作。

当前删除接口不提供 deleteFiles 参数。
删除数据库记录时会同步删除 uploads 文件。

## 11. 章节顺序规则

当前 admin 页面支持 chapter 上移和下移。

前端按钮样式：

1. 上移按钮使用半箭头
2. 下移按钮使用半箭头
3. 按钮位于每个 chapter 行右侧

当前逻辑：

1. 点击上移，调用 moveAdminComicChapter(direction="up")
2. 点击下移，调用 moveAdminComicChapter(direction="down")
3. 后端交换相邻 chapter 的 display_order
4. 后端同步更新标题中的“第X话”
5. 前端刷新 tree
6. 公开页面顺序同步改变

当前不做拖拽排序。

原因：

拖拽排序需要更多前端状态维护，也需要更复杂的批量更新接口。
当前阶段上移 / 下移已经足够满足本地管理需求。

## 12. 当前不做的功能

以下功能暂时不做：

1. 单独新建空 series
2. 单独新建空 part
3. 编辑 series 元信息
4. 编辑 part 元信息
5. 编辑 chapter 元信息
6. 修改 series_slug
7. 修改 part_slug
8. 修改 chapter_slug
9. 删除单页 page
10. 已发布 chapter 的图片重排
11. 拖拽排序上传图片
12. 账号登录页面
13. 真实权限系统
14. 作者名字段
15. 作者表
16. 作者页面

说明：

当前已经支持“新建 series / part 并上传 chapter”，但不支持单独创建空 series / part。
当前重命名先不做，因为后续可能还要补作者名等字段。
当前不做 slug 重命名，因为 slug 会影响 URL、uploads 路径和 Asset.url。
作者名相关功能先搁置。

## 13. 当前已知注意点

1. 后端 service 是实际业务逻辑中心
2. API router 不直接重写数据库业务逻辑
3. 前端只通过 admin API 操作后端
4. 前端不直接操作 SQLite
5. 前端不直接操作 uploads
6. 调用 service 前必须核对实际函数签名
7. Swagger UI 对多文件上传显示可能不准
8. curl 和前端 FormData 测试更可靠
9. 当前删除 chapter 会删除数据库记录和文件
10. 当前删除 part 会级联删除其下所有内容
11. 当前删除 series 会级联删除其下所有内容
12. 当前 delete chapter / part / series 都没有 deleteFiles 可选项
13. 当前移动 chapter 只改变 display_order 和 title，不改变 slug
14. 当前 chapter.slug 保持稳定，公开阅读 URL 不因排序变化而改变
15. 当前 admin 页面已经拆组件，后续不要再把大量 JSX 塞回主 return 中

## 14. 当前测试通过的链路

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
13. 删除 part
14. 删除 part 后 tree 刷新
15. 被删除 part 从后台结构中消失
16. 删除 series
17. 删除 series 后 tree 刷新
18. 被删除 series 从后台结构中消失
19. 上移 chapter
20. 上移后 tree 刷新
21. displayOrder 与 title 更新
22. 下移 chapter
23. 下移后 tree 刷新
24. displayOrder 与 title 更新
25. 到达边界时返回 moved=false，并显示边界提示

## 15. 当前前端结构维护原则

AdminComicsPage.tsx 当前已经拆分为多个组件。

后续维护原则：

1. 主组件只保留 state、请求、操作函数和页面总结构
2. 上传表单放在 UploadChapterForm
3. 漫画结构树放在 ComicTreeView
4. series 渲染放在 SeriesBlock
5. part 渲染放在 PartBlock
6. chapter 渲染放在 ChapterRow
7. 不要继续在主组件 return 中追加大段嵌套 JSX
8. 如果组件继续变大，再考虑拆到 src/components/admin/ 下

暂时不强制拆成多个文件。
当前阶段保持在 AdminComicsPage.tsx 内部拆函数组件即可。

## 16. 后续开发顺序建议

下一阶段建议顺序：

1. 继续测试不同 series / part 下的上传
2. 测试新建 series + 新建 part + 上传章节
3. 测试删除刚上传的测试 chapter
4. 测试删除测试 part
5. 测试删除测试 series
6. 测试 chapter 上移 / 下移
7. 确认 uploads 目录和数据库一致
8. 再考虑是否做图片预览
9. 再考虑是否做上传前拖拽排序
10. 最后再考虑 series / part / chapter 元信息编辑

不要在当前阶段急着扩展完整后台系统。
当前目标是稳定本地漫画发布与管理工具。