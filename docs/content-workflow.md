漫画发布流程

1. 作者选择系列
2. 作者选择 part
3. 上传一批图片
4. 前端生成图片预览
5. 前端生成 page 顺序圈
6. 作者可调整顺序
7. 提交后自动创建 chapter
8. 后端创建 asset
9. 后端创建 comic_page
10. display_order 连续排序

删除 page

1. 删除指定 page
2. 后续 page 自动前移重排

删除 chapter

1. 删除 chapter
2. 删除 comic_page
3. 可选删除 asset
4. 可选删除 uploads 文件

202605112047更新
## comic_admin.py 当前职责

当前 `app/services/comic_admin.py` 作为漫画内容管理 service，
负责：

- 漫画图片识别
- series / part / chapter 创建
- 图片复制到正式 uploads
- asset 注册
- comic_page 注册
- 整章导入流程

scripts/ 中的脚本不再直接包含业务逻辑，
而是调用 comic_admin 中的函数。

后续 API 接口和后台 UI 也直接调用这些 service。

---

## 当前结构

```txt
app/services/comic_admin.py
├── 文件识别
├── 创建 / 获取
├── 导入章节
└── （后续）删除 / 重排
文件识别
IMAGE_EXTENSIONS

定义允许导入的图片类型：

IMAGE_EXTENSIONS = {
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
    ".gif",
}
guess_mime_type(path)

根据图片后缀推断 mime_type。

用于 Asset 注册。

list_image_files(source_dir)

作用：

扫描缓存区目录
过滤非法文件
跳过 Windows Zone.Identifier
按文件修改时间排序
返回图片列表

当前规则：

page.display_order
=
文件修改时间顺序

后续 UI 上传时可以改成：

用户拖拽顺序
创建 / 获取
get_or_create_series()

作用：

根据 slug 查找 series
如果已存在则直接返回
不自动更新 title / summary
不自动重排 display_order

series.slug 为永久标识。

display_order 控制展示顺序。

get_or_create_part()

作用：

根据 slug 查找 part
已存在则直接返回
part 不自动递增创建
display_order 手动指定

当前设计：

part.slug
稳定 URL 标识

part.display_order
控制展示顺序
create_next_chapter()

作用：

自动创建下一章
自动计算 chapter.display_order
自动生成 chapter.slug

当前规则：

chapter-001
chapter-002
chapter-003

slug 不因删除或重排改变。

chapter.title 自动生成：

第1话
第2话 相遇
第3话 测试章节

作者可输入副标题后缀。

导入章节
copy_image_to_uploads()

作用：

将缓存区图片复制到正式 uploads
自动生成：
001.jpg
002.png
003.webp

正式目录结构：

uploads/
└── comics/
    └── {series_slug}/
        └── {part_slug}/
            └── {chapter_slug}/

返回：

target_path
asset_url
create_asset()

作用：

创建 Asset 记录。

Asset 只负责：

文件名
url
mime_type
size
usage

不承担漫画页序。

create_comic_page()

作用：

创建 ComicPage。

真正的阅读顺序由：

comic_page.display_order

控制。

而不是：

asset.id
上传时间
文件名
import_comic_chapter_from_dir()

当前核心导入函数。

作用：

缓存区目录
↓
识别图片
↓
创建 / 获取 series
↓
创建 / 获取 part
↓
创建新 chapter
↓
复制图片到 uploads
↓
创建 asset
↓
创建 comic_page
↓
返回导入结果

后续：

scripts
API
后台 UI

统一调用此函数。

当前整体工作流
用户上传图片
↓
进入缓存区
↓
用户排序 / 预览
↓
点击发布
↓
调用 import_comic_chapter_from_dir()
↓
复制到 uploads
↓
注册数据库
↓
前端 API 自动可读

当前设计目标：

缓存区负责“准备”
comic_admin 负责“发布”
uploads 负责正式静态资源
SQLite 负责正式内容索引
:contentReference[oaicite:0]{index=0}

## comic_admin.py 在工作流中的位置

`app/services/comic_admin.py` 是漫画内容管理的核心 service 文件。

当前它负责：

1. 从缓存区识别图片文件
2. 创建或获取 ComicSeries
3. 创建或获取 ComicPart
4. 自动创建下一话 ComicChapter
5. 将图片复制到正式 uploads 目录
6. 创建 Asset
7. 创建 ComicPage
8. 删除 chapter / part / series
9. 删除对应文件夹
10. 重排 display_order

当前约定：

- scripts 只负责临时命令行调用
- service 负责真正业务逻辑
- 后续 API 和后台 UI 也应该调用 service
- 不直接让前端操作数据库或 uploads 正式目录

整体流程：

缓存区图片
→ comic_admin.py 注册
→ uploads 正式文件
→ SQLite 数据库索引
→ 前端 API 展示