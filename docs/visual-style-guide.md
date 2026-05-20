# Visual Style Guide

本文档记录当前网站的视觉风格约束。新会话改 UI 前先读这里，避免重新引入一套不一致的颜色、圆角、阴影或页面气质。

## 样式入口

全局样式入口：

```txt
frontend/src/index.css
```

它按顺序引入：

```txt
frontend/src/styles/tokens.css
frontend/src/styles/page.css
frontend/src/styles/auth.css
frontend/src/styles/admin.css
```

核心原则：

- 新增页面或组件时，先复用已有 CSS 变量和通用 class。
- 不要在组件里随手硬编码新的主色、灰阶、危险色、成功色。
- 确实需要新色值时，先加到 `tokens.css`，并说明用途。

## 颜色事实源

颜色 token 在：

```txt
frontend/src/styles/tokens.css
```

当前主色体系：

```txt
页面背景     --color-page-bg
柔和背景     --color-page-bg-soft
面板背景     --color-panel-bg
弱面板背景   --color-panel-soft-bg
主文本       --color-text-main
正文弱文本   --color-text-muted
辅助文本     --color-text-soft
主强调色     --color-accent
强调 hover   --color-accent-hover
危险色       --color-danger
成功色       --color-success
```

当前基调是冷静、干净、偏工作台的浅色界面：

- 背景以浅灰蓝和白色为主。
- 文字以 slate 系灰阶为主。
- 强调色使用蓝色。
- 危险和成功只用于状态反馈，不作为大面积装饰色。

## 页面族风格

### 公开页面

公开页面使用：

```txt
.page-shell
.surface-card
.surface-card-link
.text-main
.text-muted
.text-soft
.link-accent
```

风格要求：

- 保持轻量、清晰、留白适中。
- 卡片用于独立内容项，不要把整个页面套进多层卡片。
- 链接和重点操作使用 `--color-accent`。
- 正文优先用 `text-muted`，辅助信息用 `text-soft`。

### 认证页面

认证页面使用：

```txt
.auth-page-shell
.auth-card
.auth-input
.auth-button-primary
```

风格要求：

- 可以比普通页面更聚焦，但仍沿用蓝色强调体系。
- 不要新增另一套登录页配色。
- 错误和成功提示复用全局状态色。

### 管理后台

后台页面使用：

```txt
.admin-page-shell
.admin-section
.admin-muted-panel
.admin-input
.admin-select
.admin-textarea
.admin-button-primary
.admin-button-secondary
.admin-button-danger
.admin-message-error
.admin-message-success
```

风格要求：

- 后台是工作界面，不做营销页视觉。
- 信息密度可以高一些，但层级要清晰。
- 操作按钮按语义选 class：主操作、次操作、危险操作。
- 表单控件使用统一边框、圆角和 focus 色。
- 删除、重置密码、清空等危险操作必须使用 danger 样式。

### 漫画阅读器

阅读器有独立深色 token：

```txt
--color-reader-bg
--color-reader-header-bg
--color-reader-panel-bg
--color-reader-panel-strong-bg
--color-reader-border
--color-reader-text-main
--color-reader-text-muted
--color-reader-text-soft
```

风格要求：

- 阅读器可以保持沉浸式深色背景。
- 不要把阅读器深色样式扩散到普通公开页面或后台。
- 阅读器按钮、面板和文字应继续使用 reader token。

## 圆角与阴影

圆角 token：

```txt
--radius-card
--radius-card-large
--radius-control
--radius-control-sm
```

阴影 token：

```txt
--shadow-card
--shadow-card-hover
```

要求：

- 卡片优先用 `--radius-card`。
- 表单、按钮、select 使用 `--radius-control-sm` 或 `--radius-control`。
- 不要为每个组件创造新的圆角尺度。
- 阴影保持克制，后台尤其不要使用厚重装饰阴影。

## 新 UI 的颜色规则

新增 UI 时按这个顺序决策：

1. 是否能用现有通用 class。
2. 是否能用现有 token 加 Tailwind layout class。
3. 是否确实需要新增 token。
4. 如果只是一次性视觉细节，优先调整布局和层级，不先加颜色。

不要做：

- 不要新增大面积紫色、渐变蓝紫、米色、棕橙、深蓝单色主题。
- 不要在局部组件里硬编码一组新的灰阶。
- 不要用随机渐变替代真实内容层级。
- 不要让危险色、成功色承担普通强调色职责。

## 资产和图片

网站已有图片资产位于：

```txt
frontend/public/images/
frontend/src/assets/
backend/uploads/
```

要求：

- 公开页面如果需要图片，应优先使用真实内容图或已有资产。
- 漫画封面、章节页图片来自后端 `Asset.url`。
- 新增静态图片前确认体积，不要把大原图直接放进前端 public。

## 改动前检查

改 UI 前先看：

```txt
frontend/src/styles/tokens.css
frontend/src/styles/page.css
frontend/src/styles/auth.css
frontend/src/styles/admin.css
```

改完后检查：

- 页面是否仍使用同一套文本色、背景色、强调色。
- 按钮是否按语义使用 primary、secondary、danger。
- 表单控件 focus 状态是否一致。
- 阅读器深色样式是否没有污染其它页面。
- 是否新增了不必要的硬编码颜色。

