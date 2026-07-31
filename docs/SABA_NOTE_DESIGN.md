# Saba-Note 长期设计锚点

> 本文档记录 Saba-Note 的项目初心、领域语义、产品边界、当前实现和长期方向。它不是临时开发日志，也不是某个页面的需求清单。
>
> 任何影响核心对象、信息架构、删除语义或前后端职责的改动，都应先与本文档核对。若设计确实需要改变，应同步更新本文档并说明原因。
>
> 状态基线：2026-07-30。本文档同时维护于 `saba-note/docs/SABA_NOTE_DESIGN.md` 与 `personal-site/docs/SABA_NOTE_DESIGN.md`，两份内容必须保持一致。

## 项目初心

Saba-Note 最初并不是为了做一个普通 Markdown 编辑器，也不是为了做一个 Notion 类知识库。

它来源于长期学习过程中的实际需求：

- 很多知识理解不是一次完成的，而是在反复推导、错误和修正中形成；
- 传统笔记擅长保存结果，却很难保存“为什么这样理解”；
- 学习过程中产生的推导、疑问、失败和错误认知，本身也是有价值的信息；
- 如果只保留最终答案，未来很难重新进入当时的思考过程，也很难知道自己的理解是如何变化的。

因此，Saba-Note 希望长期记录：

- 推导过程；
- 思考过程；
- 阶段性疑问；
- 暂时受阻的尝试；
- 曾经的错误理解；
- 后续修正与新的结论。

项目目标是：

> 博客式知识展示 + 私人知识整理系统 + 推导工作台。

Saba-Note 的核心原则是：

> 内容优先，结构辅助。

知识结构应该服务于阅读、理解、回顾和继续思考，而不是让用户为了找到内容，先维护一套复杂目录。用户应当可以先写下当前理解，再逐步整理；系统不能要求用户先完成分类体系，才允许知识产生。

## Saba-Note 不是什么

### 不是文件管理器

Saba-Note 不是：

```text
目录
→ 子目录
→ 文件
```

这样的传统层级。

知识之间通常不是简单树状关系。一个概念可能属于某个学科分类，也可能与多个概念、推导、方法和错误认知同时发生联系。Category 可以提供导航，但不能决定知识的全部结构。

因此：

- 不以文件树作为产品主入口；
- 不要求每条 Derivation 必须归档；
- 不要求每个 Node 必须属于 Category；
- 不把移动目录当作主要知识工作。

### 不是后台管理系统

`/saba-note/manage` 可以继续使用 `manage` 这个名称，但它不是 Admin。

它不是：

- 管理用户；
- 管理数据库；
- 直接操作数据表；
- 面向站点运营人员的 CRUD 控制台。

Manage 是作者自己的知识整理空间。它处理的是概念、分类、标签、关系和内容归属，其目标是让个人知识逐渐清晰，而不是追求后台系统式的操作密度。

Saba-Note 使用主站认证，但 Manage 不应依赖主站管理员角色。它面向当前知识所有者。

### 不是纯博客系统

Saba-Note 有博客式的内容流和文章阅读体验，但不只负责展示文章。

长期还需要支持：

- Node；
- Category；
- Tag；
- Node Relation；
- ContentLink 与 backlinks；
- 基于个人知识积累的 Agent 分析。

博客式展示解决“阅读什么”，知识结构解决“它与什么有关”，工作台解决“如何继续形成理解”。

### 不是自动生成知识的 AI 容器

AI 或 Agent 不是当前内容的替代品。

未来 Agent 应建立在用户真实积累的 Derivation、Node、Relation 与 ContentLink 之上，帮助检索、比较、发现冲突和重新进入过去的理解。模型生成的内容必须与用户原有内容区分，并能够追溯来源。

## 总体产品原则

1. **Derivation 是内容核心。** 首页、阅读和编辑首先围绕用户的理解过程组织。
2. **允许先写后整理。** 未归档 Derivation、未分类 Node 和无 Tag 内容都是合法的一等状态。
3. **结构是辅助，不是门槛。** Category、Node、Tag 和 Relation 不应阻塞写作。
4. **状态与归档、删除相互独立。** 推导过程状态不能被用来替代知识归属或回收站状态。
5. **安全删除优先。** 危险操作必须说明影响，知识内容默认保留。
6. **真实 API 优先。** 正式页面不能围绕 mock 自行创造后端不存在的字段。
7. **主站提供基础设施，Saba-Note 保持领域独立。**
8. **小步演进。** 不为尚未出现的规模或功能提前引入复杂抽象。

## 核心对象设计

### Derivation

Derivation 是最核心的内容对象。

它可以表示：

- 一次推导；
- 一篇知识文章；
- 一次理解过程；
- 一次失败尝试；
- 一次认知修正；
- 尚未完成的思考草稿。

用户主要通过以下页面接触 Derivation：

- 总览页；
- 阅读页；
- Workspace 编辑页；
- Manage 中的 Derivation 整理视图；
- 回收站。

当前主要字段包括：

- `title`；
- `contentMd`；
- `status`；
- `nodeId`；
- `isDiscarded`；
- `discardedAt`；
- 创建和更新时间。

Derivation 当前没有后端 `summary` 字段。总览页需要摘要时，可以从 `contentMd` 派生，但派生摘要不是新的后端字段，也不能在编辑页伪造保存。

#### Derivation status

当前状态：

```text
draft
verified
failed
misconception
```

语义如下。

`draft`

草稿。内容仍在形成，尚未作出稳定判断。

`verified`

正确推导，表示当前认为成立的理解。它不是永远不变的真理；未来仍可被新证据修正。

`failed`

推导失败、暂时受阻或没有得到结果。失败过程本身需要保留。

`misconception`

曾经存在的错误理解，用于记录认知修正过程。它不是普通删除状态，也不应从内容流中自动隐藏。

status 只表示推导过程。

它不表示：

- 是否归档；
- 是否公开；
- 是否删除；
- 是否在回收站。

因此：

- status 不作为总览页主要筛选维度；
- `nodeId = null` 表示未归档，与 status 无关；
- `isDiscarded = true` 表示进入回收站，与 status 无关。

### Node

Node 是 Saba-Note 长期知识结构中的核心实体。

不要把 Node 完全当成普通 Tag。

Tag 描述性质，例如：

- 量子力学；
- 数学；
- 困难；
- 待整理。

Node 表示知识实体，例如：

- 角动量；
- 傅里叶变换；
- 麦克斯韦方程组。

Node 的长期价值包括：

- 聚合相关 Derivation；
- 为一个相对稳定的知识概念提供标题和 summary；
- 连接 Category、Tag 和 Node Relation；
- 成为 Markdown 内部引用目标；
- 支持未来知识图和 Agent 分析。

当前 UI 可以让 Node 看起来类似一种“高级 Tag”，以降低操作成本，但语义上必须保持独立。

Node 可以没有 Category。创建 Node 不应依赖完整分类树。

删除 Node 时，不应删除关联 Derivation。后端提供的破坏性删除语义是：

- 删除 Node；
- 相关 Derivation 转为未归档；
- 清理 Node-Tag、Node Relation 和指向该 Node 的 ContentLink。

前端确认文案必须准确说明这些影响。

### Category

Category 用于：

- 分类；
- 导航；
- 整理；
- 提供相对稳定的纵向知识领域。

Category 可以形成父子层级，但它不是知识的唯一入口，也不是文件夹系统。

不要设计成：

- 必须先创建完整分类树才能写 Derivation；
- 必须先选择 Category 才能创建 Node；
- 只能通过 Category 找到内容。

系统必须允许：

- 未分类 Node；
- 未归档 Derivation。

当前后端支持创建根 Category、创建子 Category和重命名，但不支持修改已有 Category 的 `parentId`。因此 Manage 第一阶段不做拖拽移动 Category。

递归删除 Category 树时：

- Category 和子 Category 删除；
- Node 不删除，转为未分类；
- Derivation 不受影响。

### Tag

Tag 用于描述属性和建立横向索引。

Tag 可以关联：

- Node；
- Derivation。

Tag 不承担稳定知识实体的职责，也不取代 Category。

Tag 可以：

- 在 Manage 页面创建；
- 在 Workspace 编辑页快速创建；
- 在 Workspace 中关联或解除 Derivation Tag。

编辑页在 Tag 选择附近可以提供“新建 Tag”，降低写作中断；不需要提供 Tag 删除。删除 Tag 属于知识整理阶段，应集中在 Manage。

Tag 删除分为：

- 安全删除：仅删除没有任何关联的 Tag；
- 强制删除：删除 Tag 及其关联，但不删除 Node 或 Derivation。

## 关系设计

### Node Relation

Node Relation 属于显式知识结构，由作者在 Manage 中维护。

例如：

```text
角动量
↓
球谐函数
```

Relation 当前包含：

- source Node；
- target Node；
- relationType；
- note。

关系有方向。Node 不能与自身建立关系；相同 source、target 和 relationType 不能重复。

当前后端编辑 Relation 时只能修改 relationType 和 note，不能替换 source 或 target。若连接对象选错，应删除后重新建立。

第一阶段不做图谱可视化。列表、筛选和清晰的 source → relation → target 表达已经足够验证语义。

### Derivation Relation 与 ContentLink

Derivation 之间的联系不要设计成简单的文章尾部手工列表。

长期目标更接近 Wiki 链接和 Obsidian 双链。

例如正文：

```text
[[node:<id>|傅里叶变换]]
[[derivation:<id>|此前的推导]]
```

保存 Markdown 时，后端解析内部链接并生成 ContentLink。ContentLink 支持：

- 正文跳转；
- backlinks；
- 引用目标检查；
- 未来的知识关系分析。

ContentLink 与 Node Relation 不同：

- Node Relation 是作者显式整理的概念关系；
- ContentLink 是正文自然产生的引用关系。

当前前端已经支持内部链接的基础展示和 backlinks 数量查询，但完整插入、搜索、失效链接和富 backlinks 阅读体验可以暂缓。

## 前后端与主站边界

### Saba-Note backend

Saba-Note backend 是独立知识引擎服务，负责：

- 领域模型；
- 所有权检查；
- 数据校验；
- 删除语义；
- ContentLink 解析；
- `knowledge.db`；
- 对外 API。

前端不能通过隐藏数据或本地模拟替代后端领域操作。

### personal-site

主站负责：

- 产品入口；
- Bearer Token 身份；
- Navbar 与全站布局；
- 公共视觉 token；
- SearchBox、SearchablePicker、Button、Card 等基础组件。

主站不应吸收 Saba-Note 的知识领域逻辑。

### Saba-Note feature module

正式前端目录：

```text
personal-site/frontend/src/features/saba-note/
```

Saba-Note 自己管理：

- 页面；
- 路由；
- hooks；
- API adapter；
- 领域类型；
- 领域组件；
- 局部样式。

主站只挂载：

```text
/saba-note/*
```

Saba-Note 不向主站已有 pages、components 或 api 目录散落知识业务逻辑。通用能力优先复用，领域能力留在 feature 内，以便未来整体迁移、删除或独立维护。

正式数据流：

```text
Page
→ feature hook
→ feature API / read adapter
→ HTTP client
→ Saba-Note backend
→ knowledge.db
```

HTTP 是默认数据源。mock adapter 可以为无后端预览保留，但不能成为正式页面默认来源，也不能为了页面便利扩展真实 schema。

## 页面定位

### 总览页

路径：

```text
/saba-note
```

定位：个人知识博客首页。

它不是 Dashboard。

主要展示：

- 最新 Derivation；
- 标题；
- 从正文派生的摘要；
- status；
- Node 或“未归档”；
- Category；
- Tag；
- 更新时间；
- 阅读与编辑入口；
- 低干扰操作菜单。

状态使用胶囊式标签展示，例如：

```text
[正确推导] [量子力学] [角动量]
```

status 是内容属性，不作为主要筛选维度。Category 和 Tag 可以辅助浏览，但不能压过内容流。

### 阅读页

路径：

```text
/saba-note/derivation/:id
```

定位：知识文章阅读。

主要展示：

- 标题；
- 更新时间；
- status；
- Category；
- Node 或“未归档”；
- Tag；
- Markdown 正文；
- Markdown 目录；
- backlinks 概况；
- 相关知识。

阅读页视觉上复用主站小说阅读器的主体尺寸、正文排版和目录网格，使其具有“同一站点的同一种阅读体验，只是内容不同”的感觉。

相关推导不是上一章、下一章。它们应以知识推荐或关联内容表达，不能暗示固定阅读顺序。

阅读页操作集中在低干扰菜单中，例如：

- 编辑；
- 移入回收站。

不要在正文顶部铺设大量按钮。

### Workspace 编辑页

路径：

```text
/saba-note/workspace
/saba-note/workspace?id=<derivationId>
```

负责：

- 新建 Derivation；
- 编辑 Markdown；
- 修改 status；
- 绑定或解除 Node；
- 关联 Derivation Tag；
- 显式保存到 backend；
- 本地草稿恢复。

Markdown 是主要输入方式。

交互参考主站小说编辑页：

- 编辑/预览双栏；
- 移动端编辑、预览、信息切换；
- 本地缓存；
- 保存状态；
- 输入区成为视觉主体。

但不要复制小说章节、图片或发布业务。

localStorage 只负责：

- 异常恢复；
- 离开保护；
- 网络失败保护。

backend 才是最终数据源。进入已有 Derivation 时，默认展示后端内容；只有用户主动选择恢复时，才用本地草稿覆盖当前编辑状态。

Node、Category 和 Tag 都不能成为写作门槛：

- Derivation 可以长期未归档；
- Tag 可以为空；
- title 当前后端允许为空，前端只在展示层使用“未命名推导”。

Workspace 已在 Tag 选择附近提供轻量“新建 Tag”：创建成功后直接关联当前 Derivation，现有 Tag 通过胶囊按钮快速关联或解除。该入口不提供重命名和删除，完整整理仍属于 Manage；后续可继续评估轻量“新建 Node”。

### Manage 页面

路径：

```text
/saba-note/manage
```

命名可以继续使用 `manage`。

它不是管理员后台，而是作者的知识整理空间。

当前使用 query 参数保存视图和当前对象，例如：

```text
/saba-note/manage?view=nodes&node=<id>
/saba-note/manage?view=categories&category=<id>
/saba-note/manage?view=tags&tag=<id>
/saba-note/manage?view=relations&relation=<id>
/saba-note/manage?view=derivations&derivation=<id>
```

Markdown 内部 Node 链接已经指向 `/saba-note/manage?node=<id>`，Manage 必须能够识别并打开对应 Node。

#### Derivation 总览管理

包括：

- 查看；
- 搜索；
- status 查看；
- Node、Category、Tag 信息；
- 未归档识别；
- 快速进入阅读或编辑；
- 内容整理入口。

Derivation 管理仍然是内容视图，不应退化成数据库表格。

#### Node 管理

包括：

- 新建；
- 修改标题和 summary；
- Category 绑定或解除；
- 查看关联 Derivation；
- 查看与维护 Node-Tag；
- 查看相关 Relation；
- 查看 backlinks 概况；
- 安全删除；
- 删除 Node 并将相关 Derivation 转为未归档。

Node 应是 Manage 的默认视图，因为它是长期知识结构的核心连接点。但没有 Node 时，系统仍然可以正常写和读 Derivation。

#### Category 管理

包括：

- 创建根 Category；
- 创建子 Category；
- 重命名；
- 安全删除；
- 删除 Category 树并将相关 Node 转为未分类。

第一阶段不做拖拽移动，因为后端暂未提供 parent 修改接口。

Category 树用于辅助定位，不应占据整个 Manage 页面或成为所有操作的前置入口。

#### Tag 管理

包括：

- 创建；
- 重命名；
- 查看关联 Node；
- 查看关联 Derivation；
- 安全删除；
- 强制删除并解除全部关联。

Tag 反向查询当前会包含回收站中的 Derivation，UI 必须明确这一点。

#### Node Relation 管理

包括：

- 查询；
- 按 Node 筛选；
- 创建；
- 修改 relationType 和 note；
- 删除。

第一阶段不做图谱可视化。

#### Manage 视觉方向

Manage 不能复制普通 Admin 页面。

推荐：

- Node、Category、Tag、Relation 作为知识整理视图；
- 桌面端使用列表/筛选 + 当前对象详情的工作区结构；
- 移动端从列表进入详情；
- 使用主站 Card、Button、SearchBox、SearchablePicker 和视觉 token；
- 危险操作使用明确的领域确认 Dialog；
- 不用统计卡片和数据表格占据首屏。

#### Manage 当前实现基线

`personal-site` 已经完成完整的单页知识工作台，不再是占位页面：

- Node 是默认视图；
- Node、Category、Tag、Relation 和 Derivation 使用同一组页内视图切换；
- 桌面端使用左侧对象列表、右侧当前对象详情；两个区域独立滚动；
- 移动端使用“列表 → 对象详情”的进入式交互，不固定压缩为双栏；
- 搜索和筛选在前端基于已加载数据完成；
- 创建、修改、关联、解除关联、移入回收站和删除均调用真实 HTTP API；
- Derivation 视图只负责内容总览、归属与 Tag 整理，Markdown 编辑仍跳转 Workspace；
- 所有危险操作使用领域确认 Dialog，明确展示删除项、保留项、解除的关联和可恢复性；
- `/saba-note/manage?node=<id>` 可以直接打开 Markdown 内部链接指向的 Node。

Manage 当前刻意没有加入分页控件、Dashboard、图谱画布、批量操作和 Category 拖拽。这些不是页面未完成的占位，而是由当前数据规模、产品定位和 API 能力共同决定的范围边界。

## 职责边界

Manage 负责：

- Node；
- Category；
- Tag；
- Node Relation；
- Derivation 归属与整理；
- 删除影响检查。

Workspace 负责：

- Derivation 正文；
- Derivation status；
- Derivation Node 绑定；
- Derivation Tag；
- Derivation 内部引用；
- 草稿与保存。

阅读页负责：

- 消费内容；
- 展示结构；
- 跳转关联；
- 提供低干扰编辑和弃置入口。

不要把所有关系都塞进 Manage，也不要把完整结构管理塞进 Workspace。

## 删除与数据安全

Saba-Note 保存的是长期知识资产，因此默认采用安全删除。

### Derivation

```text
正常内容
→ 移入回收站
→ 恢复 / 永久删除
```

永久删除只允许作用于回收站内容，并必须二次确认。

### Node

- 空 Node 可以安全删除；
- 非空 Node 删除时，Derivation 保留并转为未归档；
- Node Relation、Node-Tag 和指向 Node 的 ContentLink 会被清理。

### Category

- 空叶子 Category 可以安全删除；
- 删除 Category 树时，Node 保留并转为未分类；
- Derivation 不删除。

### Tag

- 未被引用的 Tag 可以安全删除；
- 强制删除只移除 Tag 和关联；
- Node 和 Derivation 不删除。

### Relation

Relation 可以直接删除，但 UI 仍需明确 source、relationType 和 target，避免误删错误边。

危险操作不能只写“确认删除”。确认界面应说明：

- 将删除什么；
- 将保留什么；
- 哪些关联会解除；
- 是否可恢复。

## 当前后端状态

Saba-Note backend 当前已经完成：

- Derivation 创建、查询和更新；
- Markdown 正文保存；
- Derivation status；
- Node 绑定与解除；
- Derivation 回收站；
- 恢复；
- 永久删除；
- Category API；
- Node API；
- Tag API；
- Node-Tag API；
- Derivation-Tag API；
- Node Relation API；
- ContentLink 解析与重建；
- backlinks；
- 主站 Bearer Token 身份解析；
- owner 级数据隔离。

知识数据存储在独立 `knowledge.db` 中。开发阶段使用本地真实数据库，不额外维护一套前端测试 schema。

当前后端仍是早期服务：

- 没有正式数据库迁移机制；
- 没有分页和服务端搜索；
- 部分危险操作缺少影响范围聚合 endpoint；
- 没有并发版本或 ETag；
- 自动化测试、备份、恢复和部署运维仍需完善。

## 当前前端状态

personal-site 中已经完成：

- 独立 `features/saba-note` feature module；
- `/saba-note/*` 路由；
- 所有 Saba-Note 页面使用主站 Navbar auto 模式；
- 总览页；
- 阅读页；
- Workspace；
- 回收站；
- 完整 Manage 知识整理工作台；
- Manage 的 Node、Category、Tag、Relation 和 Derivation 页内视图；
- Manage 搜索、筛选、query 选中状态和响应式列表/详情布局；
- Node 创建、标题与 summary 编辑、Category 绑定、Node-Tag、关联内容和删除；
- Category 根/子级创建、重命名、安全删除和树删除；
- Tag 创建、重命名、反向关联查看、安全删除和强制删除；
- Relation 创建、relationType 与 note 修改和删除；
- Derivation 内容总览、Node 与 Tag 调整、阅读/编辑入口和移入回收站；
- 领域删除确认 Dialog；
- schema 对齐的领域类型；
- feature API contract；
- HTTP API adapter；
- HTTP read adapter；
- 主站 `getAccessToken()` Bearer Token 复用；
- Derivation 真实列表和详情读取；
- Derivation 创建和更新；
- status 修改；
- Node 绑定与解除；
- Derivation-Tag 关联；
- Workspace Tag 胶囊选择与快捷创建；
- 弃置、恢复和永久删除；
- backlinks 数量读取；
- Markdown 内部链接基础展示；
- localStorage 主动恢复机制。

mock adapter 仍可保留，但 HTTP 是默认数据源。页面已经不再直接依赖 mockData。

真实 API 生命周期已经验证过：

- 列表读取；
- 创建 Derivation；
- 更新正文；
- 修改 status；
- 绑定 Node；
- 添加 Tag；
- 移入回收站；
- 恢复；
- 永久删除。

Manage 的实现直接复用 feature 内的 `httpSabaNoteApi`，没有 mock 专用字段，也没有为页面虚构聚合接口。当前列表加载会读取 Category、Node、Tag、Relation 和正常 Derivation，并补充每条 Derivation 的 Tag；Tag 详情和 Node backlinks 在选中对象后按需读取。

## 下一阶段目标

建议顺序：

1. 使用真实 `knowledge.db` 走查 Manage 的完整创建、整理和删除流程；
2. 根据真实数据量观察 Manage 首次加载请求数和列表性能；
3. 完善 Markdown 内部引用和 backlinks 阅读；
4. 优化 Node 快速创建与归档体验；
5. 为 Manage 的表单草稿评估统一离开保护；
6. 只有在真实使用证明必要后，再增加后端聚合、搜索或分页接口。

开发原则：

- 真实 API 优先；
- 不脱离后端领域模型设计 UI；
- 小步修改和小步提交；
- 不为了抽象增加复杂度；
- 不让结构管理阻塞内容生产；
- 保持个人长期使用价值。

## 当前项目状态

### 已完成

- Saba-Note backend 的主要领域 API；
- 主站 Bearer Token 认证接入；
- 独立 `knowledge.db` 数据边界；
- personal-site 中的 feature module；
- 总览、阅读、Workspace 和回收站主要流程；
- 真实 Derivation 读写；
- status、Node、Tag 和删除生命周期；
- 阅读页与主站小说阅读体验的视觉对齐；
- Saba-Note 顶栏、自动收起 Navbar 和响应式基础；
- 完整 Manage 知识整理工作台及真实领域 API 接入；
- Manage 桌面双栏、移动端列表到详情和领域删除确认交互。

### 当前正在进行

- 使用真实个人数据持续校验 Manage 的信息密度与整理流程；
- 阅读页、backlinks 与相关知识区域的合理性调整；
- 将本文档维护为两个仓库共享的长期设计锚点。

### 下一步

- 对 Manage 安全删除、强制删除和回收站流转进行真实数据库走查；
- 观察 Derivation 数量增加后的聚合读取成本；
- 增强 ContentLink/backlinks 的阅读上下文；
- 评估 Manage 局部编辑未保存时的离开保护；
- 根据真实瓶颈决定是否新增后端接口。

## 未解决问题

### 未来可能需要扩展的 API

#### 近期价值较明确

- **Derivation 列表聚合 Node、Category 和 Tag。** 当前 Manage 为每条 Derivation 单独读取 Tag，数据增长后会形成明显的 N+1 请求。这是最先值得观测和优化的读取缺口。
- **丰富 backlinks 来源信息。** 当前 Node 详情只能可靠展示引用数量；若 API 返回来源 Derivation 标题和必要上下文，backlinks 才能从计数升级为可用的回顾入口。
- **删除前影响范围查询。** 当前 Dialog 使用已加载数据说明可见影响，并由后端在执行时保证约束。若知识树和关联规模增大，应增加只读 impact/preview endpoint，避免客户端统计遗漏深层 Category 或未加载关联。
- **并发版本控制或 ETag。** Saba-Note 是长期知识资产，多个标签页或未来多设备编辑时需要防止后写覆盖先写。
- **正式数据库迁移与版本管理。** 这是长期保存与部署可靠性的基础，优先级高于纯展示能力。

#### 数据规模证明后再做

- **服务端搜索和分页。** 当前个人知识规模下，客户端搜索与局部滚动更直接；当首屏加载时间、内存或请求量出现真实问题后再引入。
- **Node 详情聚合接口。** 当前 Derivation、Tag、Relation 已经随工作台数据可用，backlinks 按需读取。只有请求延迟或一致性成为问题时，才值得增加专用聚合接口。
- **批量 Tag 关联更新。** 现阶段胶囊式单次切换更符合渐进整理；批量 API 应由真实的批量整理场景驱动。
- **原子化 Derivation 聚合保存接口。** Workspace 目前按真实独立 API 保存字段。只有部分成功导致的一致性问题被观察到后，才考虑聚合事务接口。

#### 当前不建议为 UI 补齐

- **Category 修改 parent。** 这会把分类体验推向文件系统和拖拽树；在确认用户确实需要重构分类树前，不应仅为了界面完整而增加。
- **Relation 修改 source/target。** 关系端点选错时删除并重建更清楚，也更容易审计；当前只修改 `relationType` 和 `note` 是合理边界。
- **人工维护 Derivation Relation。** Derivation 关系应主要由 Markdown 引用生成 ContentLink，不应新增一套 Manage CRUD API。

以上判断遵循“真实瓶颈优先”。接口应在真实 UI、真实数据规模或数据安全要求证明必要后增加，不为抽象完整性提前扩展。

### 暂缓的 UI 设计

- Category 拖拽移动；
- 知识图谱可视化；
- 完整 Node 独立阅读页；
- 富 backlinks 面板；
- Markdown 内部链接搜索与插入器；
- 失效链接修复界面；
- 图片上传；
- 复杂批量管理；
- Manage 内嵌 Markdown 编辑器；
- 人工 Derivation Relation 管理；
- 公开分享和导出。

### 长期规划

- Personal Wiki 式知识浏览；
- 更成熟的双向链接体验；
- Node Relation 与 ContentLink 的联合探索；
- 搜索“我过去如何理解这个问题”；
- 检测重复、冲突和认知变化；
- 基于个人知识的 Agent 分析；
- 可追溯、区分用户内容与模型生成内容的个人知识助手；
- 部署后的备份、恢复、迁移和长期数据安全体系。

长期规划不能反过来破坏当前核心闭环：

```text
写下推导
→ 保存真实思考
→ 阅读和回顾
→ 逐步整理
→ 继续修正理解
```
