# Style Guide

本文档记录当前网站的视觉风格和 UI 改动约束。

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
```

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
- 漫画书架和小说编辑器优先保持操作稳定。

阅读器：

- 以阅读内容为中心。
- 不随意改变滚动逻辑、阅读宽度、章节导航。

## 响应式风格

目标方向：

- 推荐“桌面默认 + `max-*` 覆盖移动端”。
- 新增响应式 class 时，优先写桌面默认值，再用 `max-sm:`、`max-md:`、`max-lg:` 覆盖小屏。

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
- drawer、Navbar、Reader 滚动相关结构。

## 改 UI 前检查

- 是否已有 token 可复用。
- 是否已有页面族 class 可复用。
- 是否会影响 admin / author 的重复工作流。
- 是否会改变阅读器滚动行为。
- 是否需要同步更新本文档。
