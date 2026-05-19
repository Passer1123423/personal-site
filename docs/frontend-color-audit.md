# 前端颜色设计文档

本文档用于约束后续页面和组件设计，确保新页面与当前颜色 token、公共 class、既有视觉保持一致。

历史审计内容已备份到：

- `docs/frontend-color-audit.backup.md`

当前实现入口：

- `frontend/src/styles/tokens.css`
- `frontend/src/styles/page.css`
- `frontend/src/styles/admin.css`
- `frontend/src/styles/auth.css`
- `frontend/src/index.css`

## 设计原则

1. 默认主题是浅色。
2. 深色 token 只作为未来 dark mode 备用，不作为当前后台或用户页默认风格。
3. 新页面优先使用公共 class，不直接散写 Tailwind 颜色类。
4. Hero、封面渐变、图片占位可以保留特定视觉色，但不要把它们扩散成通用页面背景。
5. 错误、成功、危险、链接、面板、输入框必须使用统一 token 或公共 class。

## 默认颜色

### 页面和面板

| 用途 | Token | 当前值 | 推荐 class |
|---|---|---:|---|
| 页面背景 | `--color-page-bg` | `#f5f7fb` | `page-shell`, `admin-page-shell`, `auth-page-shell` |
| 柔和页面背景 | `--color-page-bg-soft` | `#f8fafc` | 仅在需要轻微层级时使用 |
| 面板背景 | `--color-panel-bg` | `#ffffff` | `surface-card`, `admin-section`, `auth-card` |
| 次级面板背景 | `--color-panel-muted-bg` | `#f1f5f9` | 少量静态浅灰块 |
| 柔和面板背景 | `--color-panel-soft-bg` | `#f8fafc` | `admin-muted-panel` |

### 文本

| 用途 | Token | 当前值 | 推荐 class |
|---|---|---:|---|
| 主文字/标题 | `--color-text-main` | `#0f172a` | `text-main` |
| 强标题 | `--color-text-strong` | `#020617` | 需要更强对比时少量使用 |
| 正文/说明 | `--color-text-muted` | `#475569` | `text-muted` |
| 弱提示/空状态 | `--color-text-soft` | `#64748b` | `text-soft` |
| 反白文字 | `--color-text-inverse` | `#ffffff` | 按钮或 Hero 内局部使用 |

### 边框

| 用途 | Token | 当前值 | 推荐 class |
|---|---|---:|---|
| 柔和边框 | `--color-border-soft` | `#e2e8f0` | `surface-card`, `admin-section`, `admin-muted-panel` |
| 控件边框 | `--color-border-control` | `#cbd5e1` | `admin-input`, `admin-select`, `admin-button-secondary` |

### Accent

| 用途 | Token | 当前值 | 推荐 class |
|---|---|---:|---|
| 主强调色 | `--color-accent` | `#2563eb` | `link-accent`, `admin-button-primary`, `auth-button-primary` |
| 强调 hover | `--color-accent-hover` | `#1d4ed8` | 由公共 class 处理 |
| 柔和强调背景 | `--color-accent-soft` | `#eff6ff` | `badge-accent` |
| 强调边框 | `--color-accent-border` | `#dbeafe` | `auth-card`, `auth-input` |
| focus 边框 | `--color-accent-border-strong` | `#60a5fa` | `admin-input:focus`, `auth-input:focus` |

### 状态色

| 用途 | Token | 当前值 | 推荐 class |
|---|---|---:|---|
| 危险文字/按钮 | `--color-danger` | `#dc2626` | `admin-button-danger` |
| 危险 hover | `--color-danger-hover` | `#b91c1c` | 实心危险按钮需要时使用 |
| 错误背景 | `--color-danger-bg` | `#fef2f2` | `message-error`, `admin-message-error` |
| 错误边框 | `--color-danger-border` | `#fecaca` | `message-error`, `admin-message-error` |
| 成功文字 | `--color-success` | `#15803d` | `message-success`, `admin-message-success` |
| 成功背景 | `--color-success-bg` | `#f0fdf4` | `message-success`, `admin-message-success` |
| 成功边框 | `--color-success-border` | `#bbf7d0` | `message-success`, `admin-message-success` |

## 公共 Class 使用规范

### 通用页面

使用场景：公开页、用户页、非后台内容页。

| Class | 用途 |
|---|---|
| `page-shell` | 页面最外层浅色背景和主文字 |
| `surface-card` | 白色卡片、面板、资料块 |
| `surface-card-link` | 可点击卡片 hover 效果 |
| `text-main` | 标题和主文字 |
| `text-muted` | 正文说明 |
| `text-soft` | 加载、空状态、弱提示 |
| `link-accent` | 文本链接 |
| `badge-accent` | 角色、状态、轻量标签 |
| `message-error` | 公开页错误提示 |
| `message-success` | 公开页成功提示 |

新公开页推荐结构：

```tsx
<main className="page-shell px-6 py-16">
  <section className="mx-auto max-w-6xl">
    <p className="text-sm font-semibold uppercase tracking-[0.25em] link-accent">
      Section
    </p>
    <h1 className="mt-2 text-3xl font-bold text-main">页面标题</h1>
    <p className="mt-5 max-w-3xl leading-7 text-muted">页面说明</p>
  </section>
</main>
```

### Admin 页面

当前 admin 默认也是浅色。不要使用 `bg-slate-950`, `text-slate-100`, `bg-white/5`, `border-white/10` 作为默认后台风格。

| Class | 用途 |
|---|---|
| `admin-page-shell` | 后台页面最外层 |
| `admin-section` | 后台主面板 |
| `admin-muted-panel` | 后台内部浅色块、表格行、空状态 |
| `admin-input` | input |
| `admin-select` | select |
| `admin-textarea` | textarea |
| `admin-button-primary` | 主要提交按钮 |
| `admin-button-secondary` | 普通操作按钮 |
| `admin-button-danger` | 删除、取消、危险操作 |
| `admin-message-error` | 后台错误提示 |
| `admin-message-success` | 后台成功提示 |

后台表单推荐结构：

```tsx
<main className="admin-page-shell px-6 py-10">
  <section className="mx-auto max-w-6xl">
    <section className="admin-section mt-8">
      <h2 className="text-xl font-semibold text-main">表单标题</h2>
      <input className="admin-input mt-2 w-full px-4 py-3" />
      <button className="admin-button-primary px-5 py-3 font-semibold">
        提交
      </button>
    </section>
  </section>
</main>
```

### Auth 页面

登录和注册保持柔和蓝白风格。

| Class | 用途 |
|---|---|
| `auth-page-shell` | 登录/注册页面壳 |
| `auth-card` | 登录/注册卡片 |
| `auth-input` | 登录/注册输入框 |
| `auth-button-primary` | 登录/注册主按钮 |

## 允许保留的特殊视觉

### Hero 深色区

`Hero.tsx` 中的深色背景、radial gradient、反白文字属于首页展示区，不是默认页面主题。可以保留，但不要复用到普通页面或后台页面作为默认背景。

可保留：

- `bg-slate-950`
- `bg-slate-950/40`
- `text-white`
- `text-blue-200`
- `text-slate-200`
- radial-gradient arbitrary class

### 封面渐变

项目卡片和作品入口的封面占位渐变可以保留，因为它们是内容视觉资产。

可保留：

- `bg-gradient-to-br`
- `from-slate-900`
- `to-blue-700`
- `to-cyan-700`
- `to-indigo-700`

不要把这些渐变用于普通卡片背景、页面背景或后台面板。

## 禁止新增的默认样式模式

后续新增页面时，默认不要再写：

- `bg-slate-950 text-slate-100` 作为页面壳
- `border-white/10 bg-white/5` 作为后台或用户页卡片
- `bg-slate-900 bg-slate-950 text-slate-100` 作为默认输入框
- `border-red-200 bg-red-50 text-red-600` 直接散写错误提示
- `border-green-200 bg-green-50 text-green-700` 直接散写成功提示
- `text-blue-600 hover:text-blue-700` 直接散写链接
- `rounded-2xl border border-slate-200 bg-white shadow-sm` 直接散写卡片

对应替代：

- 页面壳：`page-shell` / `admin-page-shell` / `auth-page-shell`
- 卡片：`surface-card` / `admin-section` / `auth-card`
- 链接：`link-accent`
- 错误：`message-error` / `admin-message-error`
- 成功：`message-success` / `admin-message-success`
- 输入：`admin-input` / `admin-select` / `admin-textarea` / `auth-input`

## 页面类型选择

| 页面类型 | 页面壳 | 卡片 | 控件 |
|---|---|---|---|
| 公开展示页 | `page-shell` 或继承 App 背景 | `surface-card` | 一般无表单控件 |
| 用户资料页 | `page-shell` | `surface-card` | `badge-accent` |
| 后台管理页 | `admin-page-shell` | `admin-section`, `admin-muted-panel` | `admin-input`, `admin-select`, `admin-button-*` |
| 登录/注册页 | `auth-page-shell` | `auth-card` | `auth-input`, `auth-button-primary` |
| 漫画公开阅读页 | `page-shell` 或现有公开页布局 | `surface-card` | 错误用 `message-error` |

## 后续改页面前检查清单

1. 页面是否默认浅色。
2. 外层是否使用合适 shell class。
3. 卡片是否使用 `surface-card` 或 `admin-section`。
4. 链接是否使用 `link-accent`。
5. 错误/成功提示是否使用 message class。
6. 表单控件是否使用 admin/auth 控件 class。
7. 是否错误复用了 Hero 深色或封面渐变。
8. 是否直接散写了可由 token 表达的 Tailwind 颜色类。

