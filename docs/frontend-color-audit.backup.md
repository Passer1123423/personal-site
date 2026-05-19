# 前端颜色与样式现状审计

范围：

- `frontend/src/pages/`
- `frontend/src/components/`
- `frontend/src/App.tsx`
- `frontend/src/App.css`
- `frontend/src/index.css`

补充说明：`frontend/src/data/projects.ts` 不在原始扫描范围内，但其中 `coverClass` 会通过 `ProjectCard` 进入 UI className，因此本报告也记录其渐变色。`frontend/src/api/` 未发现需要纳入的 UI 颜色代码。

本次审计未发现 JSX/TSX 中的 inline `style={{ color/background... }}` 颜色，也未发现 Tailwind `@apply`。

## 一、颜色总表

| 用途 | 类 / 值 | 文件 | 大概用途 | 是否重复出现 | 是否适合抽 token |
|---|---|---|---|---|---|
| 页面背景 | `bg-slate-50`, CSS `#f5f7fb`, `bg-slate-950` | `frontend/src/App.tsx`, `frontend/src/index.css`, `frontend/src/pages/AdminLoginPage.tsx`, `frontend/src/pages/RegisterPage.tsx`, `frontend/src/pages/AdminHomePage.tsx`, `frontend/src/pages/AdminUsersPage.tsx`, `frontend/src/pages/UserPage.tsx`, `frontend/src/components/Hero.tsx` | 公开页浅背景、后台/用户页深背景、Hero 深底 | 高 | 是：`--color-page-bg`, `--color-page-dark-bg` |
| 卡片 / block 背景 | `bg-white`, `bg-white/90`, `bg-white/5`, `bg-slate-100`, `bg-slate-50`, `bg-slate-900`, `bg-slate-900/80`, `bg-slate-950`, `bg-slate-800` | 多数 pages/components，尤其 `ProjectCard`, `ComicsPage`, `AdminUsersPage`, `UserPage`, `AdminComicsPage` | 白卡、浅灰块、深色后台卡片/输入/table row/avatar | 高 | 是：`--color-panel-bg`, `--color-panel-muted-bg`, `--color-dark-panel-bg`, `--color-dark-control-bg` |
| 主文字 | `text-slate-900`, `text-slate-950`, `text-slate-100`, CSS `#111827`, `text-white` | 公开页、登录注册、后台深色页、Hero | 标题/主体/反白文字 | 高 | 是：`--color-text-main`, `--color-text-inverse`, `--color-dark-text-main` |
| 次级文字 | `text-slate-600`, `text-slate-700`, `text-slate-300`, `text-slate-200` | 公开页正文、表单 label、后台浅色正文 | 正文说明、控件文字 | 高 | 是：`--color-text-muted`, `--color-dark-text-muted` |
| 弱提示文字 | `text-slate-500`, `text-slate-400` | 加载、空状态、slug、辅助说明、footer | muted / placeholder-like 文案 | 高 | 是：`--color-text-soft`, `--color-dark-text-soft` |
| 边框 | `border-slate-200`, `border-slate-300`, `border-blue-100`, `border-blue-200`, `border-white/10`, `border-red-200`, `border-red-300`, `border-red-400/30`, `border-green-200`, `border-green-300`, `border-emerald-400/30`, CSS `transparent`, `var(--border)` | 全局、公开卡片、登录表单、后台控件、消息 | 分割线、卡片边、输入框、状态边 | 高 | 是：`--color-border-soft`, `--color-border-control`, `--color-dark-border`, `--color-danger-border`, `--color-success-border` |
| hover / focus | `hover:bg-slate-100`, `hover:bg-slate-50`, `hover:bg-white/10`, `hover:border-white/30`, `focus:border-blue-400`, `focus:bg-white`, `hover:border-blue-300`, `hover:border-blue-400`, `hover:text-blue-700`, `hover:text-blue-500`, `hover:text-slate-100`, `group-hover:text-slate-600`, `group-hover:text-slate-300` | `Navbar`, `Hero`, 登录注册、漫画页、后台页 | 交互态、focus border | 高 | 是：`--color-focus`, `--color-hover-bg`, `--color-dark-hover-bg` |
| 主按钮 | `bg-blue-600 text-white hover:bg-blue-500/700`, `bg-slate-900 text-white`, 深色后台 `bg-white text-slate-950 hover:bg-slate-200` | `Hero`, `AdminLoginPage`, `RegisterPage`, `AdminComicsPage`, `AdminUsersPage` | CTA、提交按钮 | 高 | 是：`--color-accent`, `--color-accent-hover`, `--color-button-dark-bg` |
| 次级按钮 | `border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100`, `border-slate-300 bg-white text-slate-700 hover:border-blue-400 hover:text-blue-600`, `border-white/10 text-slate-100 hover:bg-white/10` | `Navbar`, `ComicSeriesPage`, `AdminUsersPage` | 登录入口、章节链接、刷新/表格操作 | 中 | 是：`--button-secondary-*` |
| 危险操作 | `bg-red-600 hover:bg-red-700 text-white`, `text-red-600/700/200`, `border-red-200/300/400/30`, `bg-red-50`, `bg-red-500/10`, `hover:bg-red-50`, `hover:bg-red-500/10` | `Navbar`, `AdminComicsPage`, `AdminUsersPage`, 登录注册错误 | 登出、删除、取消、错误消息 | 高 | 是：`--color-danger*` |
| 成功提示 | `bg-green-50 border-green-200 text-green-700`, `border-green-300 text-green-700 hover:bg-green-50`, `bg-emerald-500/10 border-emerald-400/30 text-emerald-200` | `AdminComicsPage`, `AdminUsersPage` | 成功消息、保存按钮、启用状态 | 中 | 是：`--color-success*`，深色成功建议单独 token |
| 错误提示 | `bg-red-50 border-red-200 text-red-600/700`, 深色 `bg-red-500/10 border-red-400/30 text-red-200` | 登录、注册、漫画公开页、后台页 | 表单/API 错误 | 高 | 是：`--message-error-*` |
| 登录 / 注册 / 用户页独有 | 登录注册：`border-blue-100 bg-blue-50/40 shadow-blue-100/60 text-blue-500`; 用户页：`bg-slate-950 bg-white/5 border-white/10 bg-slate-800 text-slate-300` | `AdminLoginPage`, `RegisterPage`, `UserPage` | 登录卡片蓝色柔和视觉、用户主页深色面板 | 高/中 | 是，登录和暗色 profile 分开 |
| 漫画后台中独有 | 浅色 admin comics：`bg-white border-slate-200 bg-slate-50 border-slate-300 focus:border-blue-400 bg-slate-900 text-white` | `AdminComicsPage.tsx` | 目前与深色 admin users 不统一，是后台中最明显的风格分叉 | 高 | 是，优先抽 `admin-light-*` 或统一到暗色后台 |
| 其它无法归类 | `bg-gradient-to-br from-slate-900 to-blue-700/to-cyan-700/to-indigo-700`, Hero arbitrary `rgba(37,99,235,.45)`, `rgba(14,165,233,.25)`, `transparent`, CSS vars `--accent`, `--border`, `--social-bg` | `Hero`, `WorksPage`, `ComicsPage`, `ComicSeriesPage`, `ProjectCard`, `data/projects.ts`, `App.css` | 封面占位渐变、Hero 装饰、旧 CSS 变量 | 中 | 渐变可抽 `--gradient-cover-*`，旧 CSS 变量需清理或并入 tokens |

## 二、按文件列出颜色使用情况

### 文件：`frontend/src/App.tsx`

- `bg-slate-50`：全站浅色页面壳背景。

### 文件：`frontend/src/index.css`

- `#f5f7fb`：body 背景，接近 `slate-50` 但不完全相同。
- `#111827`：body 默认文字，接近 `gray-900` / `slate-900`。

### 文件：`frontend/src/App.css`

- `var(--accent)`：`.counter` 文本和 focus outline。
- `var(--accent-bg)`：`.counter` 背景。
- `var(--accent-border)`：`.counter:hover` 边框。
- `var(--border)`：分割线、tick 三角边。
- `var(--text-h)`：社交链接文字。
- `var(--social-bg)`：社交链接背景。
- `var(--shadow)`：社交链接 hover 阴影。
- `transparent`：按钮/三角 tick 边框透明底。

### 文件：`frontend/src/components/Navbar.tsx`

- `border-slate-200`：顶部导航底部分割线。
- `bg-white/90`：顶部导航半透明白底。
- `text-blue-600`：品牌、导航链接、用户链接。
- `border-blue-600`：当前 nav active underline。
- `border-transparent`：非 active nav underline。
- `hover:border-blue-300`：nav hover underline。
- `bg-red-600` / `hover:bg-red-700` / `text-white`：退出登录按钮。
- `border-blue-200` / `bg-blue-50` / `text-blue-700` / `hover:border-blue-300` / `hover:bg-blue-100`：登录按钮。

### 文件：`frontend/src/components/Hero.tsx`

- `bg-slate-950`：Hero 深色底。
- `bg-[radial-gradient(...rgba(37,99,235,0.45)...rgba(14,165,233,0.25)...transparent...)]`：Hero 蓝/cyan 装饰光。
- `bg-slate-950/40`：Hero 深色遮罩。
- `text-white`：Hero 主文字和主按钮文字。
- `text-blue-200`：Hero eyebrow。
- `text-slate-200`：Hero 描述。
- `bg-blue-600` / `hover:bg-blue-700`：主 CTA。
- `bg-white` / `hover:bg-slate-100` / `text-slate-900`：次 CTA。

### 文件：`frontend/src/components/ProjectCard.tsx`

- `border-slate-200` / `bg-white` / `shadow-sm` / `hover:shadow-md`：项目卡片。
- `bg-gradient-to-br ${project.coverClass}`：封面渐变，颜色来自 `frontend/src/data/projects.ts`。
- `text-slate-900`：项目标题。
- `text-slate-600`：项目说明。

### 文件：`frontend/src/data/projects.ts`

- `from-slate-900 to-blue-700`：项目封面渐变。
- `from-slate-900 to-indigo-700`：项目封面渐变。
- `from-slate-900 to-cyan-700`：项目封面渐变。

### 文件：`frontend/src/components/SectionTitle.tsx`

- `text-blue-600`：eyebrow / action link。
- `hover:text-blue-700`：action link hover。
- `text-slate-900`：标题。

### 文件：`frontend/src/components/WorksSection.tsx`

- `border-slate-200` / `bg-white`：分区背景。
- `bg-slate-100`：入口块。
- `text-slate-900`：标题。
- `text-slate-600`：正文。

### 文件：`frontend/src/components/Footer.tsx`

- `text-slate-500`：footer 弱文字。

### 文件：`frontend/src/pages/HomePage.tsx`

- `border-slate-200` / `bg-white`：作品入口分区。
- `bg-slate-100`：两个入口块。
- `hover:shadow-md`：入口块 hover。
- `text-slate-900`：入口标题。
- `text-slate-600`：入口说明。

### 文件：`frontend/src/pages/ProjectsPage.tsx`

- `text-slate-600`：页面说明。
- 其他颜色通过 `SectionTitle` 和 `ProjectCard` 引入。

### 文件：`frontend/src/pages/AboutPage.tsx`

- `text-blue-600`：eyebrow。
- `text-slate-900`：标题。
- `text-slate-600`：正文。

### 文件：`frontend/src/pages/WorksPage.tsx`

- `text-blue-600`：eyebrow。
- `text-slate-900`：页面标题和卡片标题。
- `text-slate-600`：正文说明。
- `border-slate-200` / `bg-white` / `shadow-sm` / `hover:shadow-md`：作品卡片。
- `from-slate-900 to-blue-700`：小说封面占位渐变。
- `from-slate-900 to-cyan-700`：漫画封面占位渐变。

### 文件：`frontend/src/pages/ComicsPage.tsx`

- `text-blue-600`：eyebrow。
- `text-slate-900`：标题。
- `text-slate-600`：正文。
- `text-slate-500`：加载和空状态。
- `border-red-200` / `bg-red-50` / `text-red-600`：错误消息。
- `border-slate-200` / `bg-white` / `shadow-sm` / `hover:shadow-md`：漫画卡片。
- `from-slate-900 to-cyan-700`：无封面占位。
- `bg-blue-50` / `text-blue-600`：状态 badge。

### 文件：`frontend/src/pages/ComicSeriesPage.tsx`

- `text-slate-500`：加载、空状态。
- `border-red-200` / `bg-red-50` / `text-red-600`：错误。
- `text-blue-600` / `hover:text-blue-700`：返回链接。
- `from-slate-900 to-cyan-700`：系列封面占位。
- `from-slate-900 to-blue-700`：part 封面占位。
- `text-slate-900`：标题。
- `text-slate-600`：summary / 正文。
- `bg-blue-50` / `text-blue-600`：状态 badge。
- `bg-slate-100` / `text-slate-600`：可见性 badge。
- `border-slate-200` / `bg-white` / `shadow-sm`：part 卡片。
- `border-slate-300` / `bg-white` / `text-slate-700` / `hover:border-blue-400` / `hover:text-blue-600`：章节按钮。
- `text-slate-400`：暂无章节。

### 文件：`frontend/src/pages/ComicReaderPage.tsx`

- `border-slate-200` / `bg-white` / `text-slate-400`：图片错误/缺失占位。
- `bg-white` / `shadow-sm`：漫画图片背景。
- `text-slate-500`：加载、meta、空状态。
- `border-red-200` / `bg-red-50` / `text-red-600`：错误。
- `text-blue-600` / `hover:text-blue-700`：返回链接。
- `text-slate-900`：章节标题。
- `text-slate-600`：章节 summary。

### 文件：`frontend/src/pages/AdminLoginPage.tsx`

- `bg-slate-50` / `text-slate-900`：登录页背景。
- `border-blue-100` / `bg-white` / `shadow-blue-100/60`：登录卡片。
- `text-blue-500`：品牌文案。
- `text-slate-950`：标题。
- `text-slate-500`：说明。
- `text-slate-700`：label。
- `border-blue-100` / `bg-blue-50/40` / `text-slate-900` / `focus:border-blue-400` / `focus:bg-white`：输入框。
- `text-blue-600` / `hover:text-blue-500`：注册链接。
- `border-red-200` / `bg-red-50` / `text-red-600`：错误。
- `bg-blue-600` / `text-white` / `hover:bg-blue-500` / `disabled:opacity-60`：提交按钮。

### 文件：`frontend/src/pages/RegisterPage.tsx`

- `bg-slate-50` / `text-slate-900`：注册页背景。
- `border-blue-100` / `bg-white` / `shadow-blue-100/60`：注册卡片。
- `text-blue-500`：品牌文案。
- `text-slate-950`：标题。
- `text-slate-500`：说明和底部提示。
- `text-slate-700`：label。
- `border-blue-100` / `bg-blue-50/40` / `text-slate-900` / `focus:border-blue-400` / `focus:bg-white`：输入框。
- `border-red-200` / `bg-red-50` / `text-red-600`：错误。
- `bg-blue-600` / `text-white` / `hover:bg-blue-500` / `disabled:opacity-60`：提交按钮。
- `text-blue-600` / `hover:text-blue-500`：登录链接。

### 文件：`frontend/src/pages/UserPage.tsx`

- `bg-slate-950` / `text-slate-100`：用户页深色背景。
- `text-slate-400`：返回、加载、说明。
- `hover:text-slate-100`：返回链接 hover。
- `border-white/10` / `bg-white/5`：profile/card 面板。
- `bg-slate-800` / `text-slate-300`：头像占位。
- `border-white/10` / `text-slate-300`：role badge。

### 文件：`frontend/src/pages/AdminHomePage.tsx`

- `bg-slate-950` / `text-slate-100`：后台首页深色壳。
- `text-slate-400`：说明/加载。
- `border-white/10` / `bg-white/5` / `hover:border-white/30` / `hover:bg-white/10`：后台入口卡片。

### 文件：`frontend/src/pages/AdminUsersPage.tsx`

- `bg-slate-950` / `text-slate-100`：深色后台壳。
- `text-slate-400`：返回、说明、表头、加载、空状态。
- `text-slate-500`：当前登录标记、编辑图标、弱信息。
- `text-slate-300`：label、停用 badge。
- `text-slate-200`：表格显示名。
- `border-white/10` / `bg-white/5`：section 面板。
- `bg-slate-900`：创建表单输入背景。
- `bg-slate-950`：表格内编辑输入/select 背景。
- `bg-slate-900/80`：table row 和空状态背景。
- `focus:border-white/30`：深色输入/select focus。
- `hover:border-white/30` / `hover:bg-white/10`：深色次级按钮 hover。
- `bg-white` / `text-slate-950` / `hover:bg-slate-200`：创建用户主按钮。
- `border-emerald-400/30` / `bg-emerald-500/10` / `text-emerald-200`：成功消息、保存按钮、启用状态。
- `border-red-400/30` / `bg-red-500/10` / `text-red-200`：错误消息、删除/取消。
- `bg-slate-500/10` / `text-slate-300`：停用状态。
- `disabled:opacity-40` / `disabled:opacity-60`：禁用态。

### 文件：`frontend/src/pages/AdminComicsPage.tsx`

- `border-red-200` / `bg-red-50` / `text-red-700`：错误消息。
- `text-red-600`：校验错误、删除按钮。
- `border-red-300` / `border-red-400` / `hover:bg-red-50`：危险按钮。
- `border-green-200` / `bg-green-50` / `text-green-700`：成功消息。
- `border-green-300` / `hover:bg-green-50`：保存按钮。
- `border-slate-200` / `bg-white`：浅色后台主面板、part 卡。
- `bg-slate-50`：分组块、章节行、待上传图片顺序。
- `border-slate-300`：input/select/button 边框。
- `text-slate-900`：编辑输入文字。
- `text-slate-700`：select / 操作按钮 / 文件列表。
- `text-slate-500`：说明、slug、空状态、章节 meta。
- `text-slate-600`：页面说明、编辑图标 hover。
- `text-slate-400`：编辑图标。
- `focus:border-blue-400`：浅色控件 focus。
- `bg-slate-900` / `text-white`：上传主按钮。
- `bg-slate-950` / `text-slate-100`：仅认证检查页为深色，其余主后台为浅色。
- `disabled:opacity-50` / `disabled:opacity-60`：禁用态。

## 三、重复模式

- 公开卡片：`rounded-2xl border border-slate-200 bg-white shadow-sm`，常带 `hover:-translate-y-1 hover:shadow-md`。适合抽：`surface-card`, `surface-card-link`。
- 公开文字层级：`text-slate-900` 标题 + `text-slate-600` 正文 + `text-slate-500` 弱提示。适合抽：`heading-main`, `body-muted`, `muted-text`。
- 蓝色 accent：`text-blue-600`, `hover:text-blue-700`, `bg-blue-600`, `bg-blue-50`, `border-blue-100/200/300/400`。适合抽：`link-accent`, `button-primary`, `badge-accent`, `input-auth`。
- 登录注册表单：`rounded-3xl border-blue-100 bg-white shadow-blue-100/60` + `rounded-2xl border-blue-100 bg-blue-50/40 focus:border-blue-400 focus:bg-white`。适合抽：`auth-card`, `auth-input`, `auth-button-primary`, `auth-link`。
- 深色后台 / 用户页：`bg-slate-950 text-slate-100` + `border-white/10 bg-white/5` + `text-slate-400`。适合抽：`admin-shell-dark`, `admin-card-dark`, `admin-muted-text`。
- 后台深色输入：`border-white/10 bg-slate-900 text-slate-100 focus:border-white/30`。适合抽：`admin-input-dark`, `admin-select-dark`。
- 漫画后台浅色输入：`border-slate-300 bg-white/text-slate-* focus:border-blue-400`。适合抽：`admin-input-light`, `admin-select-light`，后续可决定是否统一成深色后台。
- 错误提示：浅色 `border-red-200 bg-red-50 text-red-600/700`，深色 `border-red-400/30 bg-red-500/10 text-red-200`。适合抽：`message-error`, `message-error-dark`。
- 成功提示：浅色 `border-green-200 bg-green-50 text-green-700`，深色 `emerald-*`。适合抽：`message-success`, `message-success-dark`。
- 危险按钮：浅色 `border-red-300 text-red-600 hover:bg-red-50`，深色 `border-red-400/30 text-red-200 hover:bg-red-500/10`，实心 `bg-red-600 hover:bg-red-700 text-white`。适合抽：`button-danger`, `button-danger-outline`, `button-danger-dark`。
- 占位渐变：`bg-gradient-to-br from-slate-900 to-blue/cyan/indigo-700`。适合抽：`cover-gradient-blue`, `cover-gradient-cyan`, `cover-gradient-indigo`。

## 四、Design Token 建议

基于当前实际颜色，优先保持视觉接近不变。

```css
:root {
  --color-page-bg: #f5f7fb;
  --color-page-bg-tailwind: #f8fafc; /* slate-50 */
  --color-page-dark-bg: #020617; /* slate-950 */

  --color-panel-bg: #ffffff;
  --color-panel-muted-bg: #f1f5f9; /* slate-100 */
  --color-panel-soft-bg: #f8fafc; /* slate-50 */
  --color-panel-dark-bg: rgb(255 255 255 / 0.05);
  --color-control-dark-bg: #0f172a; /* slate-900 */
  --color-control-darker-bg: #020617; /* slate-950 */

  --color-text-main: #0f172a; /* slate-900 */
  --color-text-strong: #020617; /* slate-950 */
  --color-text-muted: #475569; /* slate-600 */
  --color-text-soft: #64748b; /* slate-500 */
  --color-text-inverse: #ffffff;
  --color-text-dark-main: #f1f5f9; /* slate-100 */
  --color-text-dark-muted: #cbd5e1; /* slate-300 */
  --color-text-dark-soft: #94a3b8; /* slate-400 */

  --color-border-soft: #e2e8f0; /* slate-200 */
  --color-border-control: #cbd5e1; /* slate-300 */
  --color-border-dark: rgb(255 255 255 / 0.1);
  --color-border-dark-hover: rgb(255 255 255 / 0.3);

  --color-accent: #2563eb; /* blue-600 */
  --color-accent-hover: #1d4ed8; /* blue-700 */
  --color-accent-hover-soft: #3b82f6; /* blue-500 */
  --color-accent-soft: #eff6ff; /* blue-50 */
  --color-accent-control-bg: rgb(239 246 255 / 0.4);
  --color-accent-border: #dbeafe; /* blue-100 */
  --color-accent-border-strong: #60a5fa; /* blue-400 */

  --color-danger: #dc2626; /* red-600 */
  --color-danger-hover: #b91c1c; /* red-700 */
  --color-danger-bg: #fef2f2; /* red-50 */
  --color-danger-border: #fecaca; /* red-200 */
  --color-danger-dark-bg: rgb(239 68 68 / 0.1);
  --color-danger-dark-border: rgb(248 113 113 / 0.3);
  --color-danger-dark-text: #fecaca; /* red-200 */

  --color-success: #15803d; /* green-700 */
  --color-success-bg: #f0fdf4; /* green-50 */
  --color-success-border: #bbf7d0; /* green-200 */
  --color-success-dark-bg: rgb(16 185 129 / 0.1);
  --color-success-dark-border: rgb(52 211 153 / 0.3);
  --color-success-dark-text: #a7f3d0; /* emerald-200 */

  --radius-card: 1rem; /* rounded-2xl */
  --radius-card-large: 1.5rem; /* rounded-3xl */
  --radius-control: 0.75rem; /* rounded-xl */
  --radius-control-sm: 0.5rem; /* rounded-lg */
}
```

## 五、后续一次性改造建议

### 1. 建议新增 CSS 文件

- `frontend/src/styles/tokens.css`：只放 design tokens。
- `frontend/src/styles/page.css`：公开页通用样式，如 `page-shell`, `surface-card`, `surface-card-link`, `muted-text`, `link-accent`, `badge-accent`, `cover-gradient-*`。
- `frontend/src/styles/admin.css`：后台/用户页通用样式，如 `admin-shell-dark`, `admin-card-dark`, `admin-input-dark`, `admin-button-secondary-dark`, `admin-message-error-dark`。
- `frontend/src/styles/auth.css`：登录/注册页通用样式，如 `auth-card`, `auth-input`, `auth-button-primary`。

### 2. import 入口

建议集中在 `frontend/src/index.css` 中导入，顺序为：

```css
@import "tailwindcss";
@import "./styles/tokens.css";
@import "./styles/page.css";
@import "./styles/auth.css";
@import "./styles/admin.css";
```

也可以在 `frontend/src/main.tsx` 中 import，但集中在 `index.css` 更容易管理级联顺序。

### 3. 优先改造页面

- `frontend/src/pages/AdminComicsPage.tsx`：颜色最多，且浅色后台与其他后台风格不一致。
- `frontend/src/pages/AdminUsersPage.tsx`：深色后台重复模式最多，适合先沉淀 admin dark classes。
- `frontend/src/pages/AdminLoginPage.tsx` 和 `frontend/src/pages/RegisterPage.tsx`：几乎同构，收益高。
- `frontend/src/pages/UserPage.tsx` 和 `frontend/src/pages/AdminHomePage.tsx`：深色 shell/card 可复用。
- 公开漫画页面：`frontend/src/pages/ComicsPage.tsx`, `frontend/src/pages/ComicSeriesPage.tsx`, `frontend/src/pages/ComicReaderPage.tsx`，统一 card/message/badge/link。
- 首页/项目/作品页最后做，风险低。

### 4. 可替换成公共 class 的 className

- `rounded-2xl border border-slate-200 bg-white shadow-sm` -> `surface-card`
- `transition hover:-translate-y-1 hover:shadow-md` -> `surface-card-link`
- `text-slate-900` / `text-slate-600` / `text-slate-500` -> `text-main` / `text-muted` / `text-soft`
- `text-blue-600 hover:text-blue-700` -> `link-accent`
- `rounded-full bg-blue-50 ... text-blue-600` -> `badge-accent`
- 登录注册输入长串 -> `auth-input`
- 深色后台面板 -> `admin-card-dark`
- 深色后台输入/select -> `admin-input-dark`
- 浅色错误/成功 -> `message-error`, `message-success`
- 深色错误/成功 -> `admin-message-error`, `admin-message-success`

### 5. 暂时不要动

- 布局类：`grid`, `flex`, `max-w-*`, `px/py`, `space-y-*`, `md:*`，避免影响排版。
- 动画/位移：`hover:-translate-y-1`, `transition`，除非公共 class 原样包含。
- 图片尺寸：`h-64`, `h-80`, `object-cover`, `rounded-*` 先保留。
- `AdminComicsPage.tsx` 的结构和表单逻辑不要拆组件；先只替换视觉 class。
- `App.css` 旧变量若当前没有被实际组件依赖，先标记清理，不建议和第一轮 token 改造混在一起。

