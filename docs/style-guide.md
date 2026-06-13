# Style Guide

本文档记录当前网站的视觉风格、布局事实和 UI 改动约束。

## 样式入口

全局入口：

```txt
frontend/src/index.css
```

当前主要样式文件：

```txt
frontend/src/styles/tokens.css
frontend/src/styles/typography.css
frontend/src/styles/page.css
frontend/src/styles/auth.css
frontend/src/styles/admin.css
frontend/src/styles/novel.css
frontend/src/styles/mobile.css
```

新增 UI 时优先复用已有 token 和通用 class。

## 颜色

颜色事实源：

```txt
frontend/src/styles/tokens.css
```

当前基调：

- 浅色界面。
- 背景以浅灰蓝和白色为主。
- 文本以 slate 系灰阶为主。
- 强调色使用蓝色。
- 危险和成功色只用于状态反馈。
- 阅读器另有 dark/reader token。

常用 token：

```txt
--color-page-bg
--color-page-bg-soft
--color-panel-bg
--color-panel-muted-bg
--color-panel-soft-bg
--color-text-main
--color-text-strong
--color-text-muted
--color-text-soft
--color-border-soft
--color-border-control
--color-accent
--color-accent-hover
--color-accent-soft
--color-accent-border
--color-accent-border-strong
--color-danger
--color-success
--radius-card
--radius-card-large
--radius-control
--radius-control-sm
--shadow-card
--shadow-card-hover
```

## 字体

字体事实源：

```txt
frontend/src/styles/typography.css
```

当前 token：

```txt
--font-sans
--font-reading
```

`page-shell`、`admin-page-shell`、`auth-page-shell` 使用 `--font-sans`；小说 Markdown 使用 `--font-reading`。

## 页面族风格

公共页面：

- 安静、内容优先。
- 使用 `page-shell`、`surface-card` 等现有结构。
- 不新增营销式大面积渐变和装饰。

后台页面：

- 工作台气质。
- 信息密度可以高于公共页。
- 优先清晰表单、列表、树、操作按钮。

创作者页面：

- 介于公共页和后台之间。
- 内容组织要适合长期管理作品。
- 漫画书架、漫画 Part 上传抽屉和小说编辑器优先保持操作稳定。

阅读器：

- 以阅读内容为中心。
- 漫画阅读器完全沉浸，不显示 App Navbar/Footer。
- 小说阅读器目前仍使用普通 App Navbar/Footer，正文区和目录滚动需谨慎调整。

互动组件：

- 评论面板是跨页面组件，当前挂载于用户页、小说详情、小说章节、漫画 Part、漫画章节。
- 评论输入、回复浮层、图片预览和删除行为属于共享交互，改动前要检查所有挂载点。

## App Layout 模式

当前 `frontend/src/App.tsx` 使用三种 Navbar 模式：

```txt
standard
auto
none
```

### standard

用于普通页面。

行为：

- 渲染 sticky Navbar。
- 渲染 Footer。
- 页面通常自然滚动。

适用：

- Home / Projects / About。
- Works、Comics、Novels、详情页。
- Admin 页面。
- 用户页和设置页。

### auto

用于创作工作页。

当前页面：

- `/creator/comics/:seriesSlug/:partSlug`
- `/creator/novels/:novelSlug/new-chapter`
- `/creator/novels/:novelSlug/:chapterSlug/edit`
- `/admin/activity-logs`

行为：

- 桌面端：Navbar 默认收起，只保留顶部窄热区；鼠标移到最顶部或 focus 进入 Navbar 时展开。
- 桌面端：Footer 隐藏，避免工作区被页脚撑出额外滚动。
- 移动端：保持普通 sticky Navbar 和 Footer，避免破坏已验证的手机端体验。

约束：

- 顶部热区应保持窄，避免误触。
- 展开的 Navbar 是覆盖层，不能参与工作页高度计算。
- 展开后 Navbar 不应让用户误点下方页面按钮；必要时提高遮罩层 z-index 或调整顶部工具栏间距。
- 不要把所有创作者页面都直接归入 `auto`，只有需要沉浸工作区或完整视口工具面的页面才使用。

### none

用于完全沉浸页。

当前页面：

- `/works/comics/:seriesSlug/:partSlug/:chapterSlug`

行为：

- 不渲染 App Navbar。
- 不渲染 Footer。
- 页面自己管理阅读器顶部栏和滚动。

## 当前布局问题和后续标准化方向

当前历史遗留问题：

- 多个页面直接写 `100dvh`、`100vh`、`min-h-screen`。
- 部分 sticky / sidebar 使用硬编码，如 `top-24`、`calc(100dvh - 9rem)`、`calc(100vh - 120px)`。
- 早期 Navbar 未建立硬高度或 layout token，后续页面各自用临时参数避让。
- Footer 在全屏工作页中容易造成微小外部滚动。
- 普通 SPA 路由当前没有统一 scroll restoration；从长页面切到新页面时，浏览器可能保留旧 `scrollY`，新页面先渲染短 loading 状态时会表现为停在底部。
- `html` 当前设置 `scroll-behavior: smooth`，如果后续增加程序性滚动复位，应显式使用 `behavior: "auto"`，并避免破坏小说阅读器的阅读进度恢复。

本阶段已采用的低风险处理：

- 先用 App 层 `standard / auto / none` 分类，避免每个页面自行判断 Navbar/Footer。
- 对 Novel 编辑页和 Comic Part 作者页桌面端采用自动隐藏 Navbar。
- 对漫画阅读页继续完全不显示 App Navbar/Footer。
- 保持手机端原有行为。

后续结构化方向：

1. 抽出 route layout 配置
   - 将 `App.tsx` 中的 `matchPath` 判断整理为明确 route config。
   - 去除重复 Route 声明。
   - 同时定义哪些 route 使用普通滚动复位，哪些 reader/editor route 自行管理滚动。

2. 建立布局组件
   - `StandardLayout`：Navbar + content + Footer。
   - `ImmersiveLayout`：桌面自动隐藏 Navbar + content，移动端保持常规导航。
   - `ReaderLayout`：完全沉浸，由页面自管阅读器 chrome。

3. 建立 layout token
   - 后续再考虑 Navbar 硬高度。
   - 收敛 `100dvh`、sticky offset、modal max-height 等参数。
   - 可能的 token：`--app-navbar-height`、`--workspace-height`、`--sticky-offset`、`--modal-max-height`。

4. 分阶段清理硬编码
   - 优先：`CreatorNovelChapterEditorPage`、`CreatorComicPartPage`、`NovelReaderPage`、`ComicSeriesPage`。
   - 其次：Creator book/series 管理页、Admin interactions。
   - 最后：普通列表和详情页。

5. 明确滚动归属
   - 普通页面：文档自然滚动。
   - 普通路由切换：后续应在 App/Router 层统一滚到顶部。
   - 工作台：外层尽量稳定，面板内部滚动。
   - 管理详情页：主内容自然滚动，drawer/sticky 面板使用独立滚动。
   - 阅读器：阅读内容优先，评论区和目录不得破坏阅读滚动。

## 响应式风格

目标方向：

- 推荐“桌面默认 + `max-*` 覆盖移动端”。
- 新增响应式 class 时，优先写桌面默认值，再用 `max-sm:`、`max-md:`、`max-lg:` 覆盖小屏。
- 已通过体验检查的移动端工作页不要顺手改动；移动端改动应有明确目标和单独验证。

允许机械调整的属性范围：

- font-size
- line-height
- letter-spacing
- margin
- padding
- gap
- space-x / space-y
- width / height
- min-width / min-height
- max-width / max-height

不建议机械调整：

- flex / grid 布局。
- hidden / block 显隐。
- border / rounded / shadow / bg 装饰。
- absolute / fixed / sticky 定位。
- hover / focus / group-hover 等状态。
- drawer、Navbar、Reader、CommentPanel 滚动相关结构。

## 组件约束

Navbar：

- `mode="standard"` 是普通 sticky 文档流导航。
- `mode="auto"` 桌面端是固定覆盖层，顶部热区触发；移动端保持 sticky。
- 不要在页面内部手写 Navbar 避让参数，除非该页面明确自管阅读器 chrome。

Footer：

- 普通页面显示。
- `auto` 页面桌面端隐藏。
- `none` 页面不显示。

CommentPanel：

- 跨页面复用，改动前至少检查用户页、小说详情、小说章节、漫画 Part、漫画章节。
- 评论图片预览和浮动回复框需要检查移动端和桌面端。

Novel 编辑器：

- 三栏高度对齐和内部滚动是核心体验。
- 外层布局可以标准化，但不要破坏目录栏、编辑栏、预览栏内部滚动。
- 新建 chapter 与已有 chapter 的图片能力不同：新建章发布前不能上传章节图片。

Comic Part 上传页：

- 主页面需要保留自然滚动。
- 右侧 chapter 上传抽屉需要稳定滚动。
- 移动端 fixed 全屏抽屉目前已通过体验检查，不要顺手改。

## 改 UI 前检查

- 是否已有 token 可复用。
- 是否已有页面族 class 可复用。
- 当前页面属于 `standard`、`auto` 还是 `none`。
- 是否会影响 admin / author 的重复工作流。
- 是否会改变阅读器滚动行为。
- 是否会影响 CommentPanel 的多个挂载点。
- 是否会改变移动端已验证行为。
- 是否需要同步更新本文档。
