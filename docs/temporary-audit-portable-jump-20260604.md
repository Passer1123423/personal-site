# 临时审计报告：作品页与创作者页便携跳转

日期：2026-06-04

## 目的

本报告用于临时审计当前前端中“公共作品页 <-> 创作者管理页”的便携跳转能力，重点说明：

- 小说与漫画两套页面当前实现是否对称。
- 小说树与漫画树的数据获取差异。
- 在类似页面中补齐便携跳转功能的可行性与工作量。
- 基于现状，对获取树与前端判定逻辑的优化方向。

## 审计范围

本次只读查阅了以下页面与接口：

- `frontend/src/pages/NovelDetailPage.tsx`
- `frontend/src/pages/CreatorNovelPage.tsx`
- `frontend/src/pages/ComicPartPage.tsx`
- `frontend/src/pages/CreatorComicPartPage.tsx`
- `frontend/src/pages/ComicSeriesPage.tsx`
- `frontend/src/pages/ComicReaderPage.tsx`
- `frontend/src/pages/NovelReaderPage.tsx`
- `frontend/src/api/authorNovels.ts`
- `frontend/src/api/authorComics.ts`
- `frontend/src/api/novels.ts`
- `frontend/src/api/comics.ts`
- `docs/project-current-state.md`
- `docs/data-model.md`
- `docs/api-reference.md`

## 现状结论

当前小说体系已经具备较完整的双向便携跳转模式，漫画体系则只完成了一半。

### 小说体系

- 公共页 `NovelDetailPage` 已存在“管理这本小说”按钮。
- 该按钮不会无条件显示，而是先拉公共详情，再在已登录时额外拉作者树，用 slug 比对当前作品是否属于当前作者。
- 创作者页 `CreatorNovelPage` 顶部已存在“查看当前小说”按钮，能直接跳回公共详情页。

结论：

- 小说的公共页与创作者页之间，已经形成双向跳转。
- 鉴权显示逻辑也已经存在可复用的基准实现。

### 漫画体系

- 公共页 `ComicPartPage` 当前没有跳往 `CreatorComicPartPage` 的便携按钮。
- 创作者页 `CreatorComicPartPage` 当前也没有“查看当前分部”之类跳回公共页的按钮。
- `CreatorComicPartPage` 的数据来源本质上已经依赖作者树，但 `ComicPartPage` 只有公共详情数据，没有作者归属信息。

结论：

- 漫画 `Part` 这组页面目前不具备对称跳转。
- 这不是 UI 遗漏那么简单，本质原因是漫画的作者归属层级和小说不同。

## 两类获取树的差异

### 小说：作者归属在作品根节点

文档与类型都表明，小说作者归属发生在 `Novel` 层：

- `docs/project-current-state.md`
- `docs/api-reference.md`
- `frontend/src/api/authorNovels.ts`

小说作者树的形状可以概括为：

```txt
AuthorNovel[]
  └─ chapters[]
```

这里的关键特征是：

- 作者拥有的是整本 `Novel`。
- 公共页 `NovelDetailPage` 只要拿到 `novel.slug`，就能去作者树中做一次 `some/find` 判断。
- 创作者页 `CreatorNovelPage` 也只需要通过 `novelSlug` 就能在作者树中定位完整实体。

这意味着：

- 小说的“是否可跳转到 creator 页”判断成本很低。
- 作品级页面与作者树的 key 是天然对齐的。
- 在小说详情页、小说阅读页补便携跳转都比较直接。

### 漫画：作者归属在 Part 层，不在 Series 层

文档与类型都表明，漫画作者归属发生在 `ComicPart` 层，而不是 `ComicSeries` 层：

- `docs/data-model.md`
- `docs/project-current-state.md`
- `docs/api-reference.md`
- `frontend/src/api/authorComics.ts`

漫画作者树的形状可以概括为：

```txt
AuthorComicSeries[]
  └─ parts[]
       ├─ owner
       └─ chapters[]
```

而公共漫画详情树则是：

```txt
ComicSeriesDetail
  └─ parts[]
       └─ chapters[]
```

这里的关键差异是：

- 公共漫画数据里的 `part` 不带 `owner`。
- 创作者权限不挂在 `series` 上，而是挂在 `part` 上。
- 所以公共页只看 `seriesSlug` 是不够的，必须同时知道 `partSlug`，并且还要查作者树。

这带来两个直接后果：

- `ComicPartPage` 想显示“管理这个 part”，必须额外拉作者树。
- `ComicSeriesPage` 即使想加跳转，也不能简单类比小说详情页，因为一个 series 下可能只有部分 part 属于当前作者。

## 页面级分析

### 1. `NovelDetailPage` 与 `CreatorNovelPage`

当前状态：

- 已双向打通。
- 公共页已实现作者校验后显示 creator 跳转。
- 创作者页已实现回看公共页。

判断：

- 这组实现可作为其它页面的参考模板。
- 如果后续要抽通用 hook，这组最适合作为第一版基线。

### 2. `ComicPartPage` 与 `CreatorComicPartPage`

当前状态：

- 两边都还没补便携跳转。
- 但这组页面在路由上是天然一一对应的：
  - 公共页：`/works/comics/:seriesSlug/:partSlug`
  - 创作者页：`/creator/comics/:seriesSlug/:partSlug`

判断：

- 这是漫画体系里最适合优先补齐的一组。
- 数据层虽然不像小说那样直接，但足够明确。

实现建议：

- `CreatorComicPartPage` 顶部新增“查看当前分部”按钮，直接跳到公共 `ComicPartPage`。
- `ComicPartPage` 参考 `NovelDetailPage`：
  - 先拉公共 `getComicSeriesDetail(seriesSlug)`
  - 若已登录，再拉 `fetchAuthorComicsTree()`
  - 在作者树中按 `seriesSlug + partSlug` 查找匹配项
  - 命中时显示“管理这个 Part”按钮

### 3. `NovelReaderPage`

当前状态：

- 已有 `novelSlug`、`chapterSlug`。
- 已经同时拉了 `getNovelReaderData()` 与 `getNovelDetail()`。
- 当前没有跳转到创作者编辑页的按钮。

判断：

- 可行性高。
- 增量逻辑与 `NovelDetailPage` 很接近，只是目标路由改成章节编辑页或小说管理页。

注意点：

- 需要先明确产品语义：
  - 是跳去 `CreatorNovelPage`
  - 还是跳去 `CreatorNovelChapterEditorPage`
- 如果定位为“便携跳转”，更合理的目标通常是当前章节编辑页。

### 4. `ComicReaderPage`

当前状态：

- 已有 `seriesSlug`、`partSlug`、`chapterSlug`。
- 已经同时拉了 `getComicReaderData()` 与 `getComicSeriesDetail()`。
- 当前没有跳去作者页的按钮。

判断：

- 可行，但目标页不是 chapter 编辑页，而应是 `CreatorComicPartPage`。
- 原因是漫画创作者管理目前是以 `Part` 为中心，不存在与小说完全对应的 chapter 独立作者页。

注意点：

- 按钮名称最好不要误导成“编辑当前章节”。
- 更合适的是“管理这个 Part”或“进入 Part 管理”。

### 5. `ComicSeriesPage`

当前状态：

- 页面只知道 `seriesSlug`，展示的是整棵公共 series 树。
- 当前没有跳去 `CreatorComicSeriesPage` 的便携按钮。

判断：

- 技术上能做，但语义最复杂。
- 因为 `CreatorComicSeriesPage` 不是“series owner 后台”，而是“该 series 下属于当前用户的 parts 集合页”。

风险：

- 用户看到“管理这个系列”，可能误以为自己拥有整个 series。
- 但现有数据模型并不支持这种语义。

建议：

- 这页不要机械复刻小说详情页。
- 如果要做，按钮文案应更接近：
  - “查看我在该系列下的 Part”
  - “进入该系列下的创作页”

## 工作量判断

以下评估以现有前端结构不重构为前提。

### 低工作量

- `CreatorComicPartPage -> ComicPartPage`
- `ComicPartPage -> CreatorComicPartPage`
- `NovelReaderPage` 补作者态便携跳转

特点：

- 路由参数已齐全。
- 不需要新增后端接口。
- 主要是补一个按钮和一段作者树校验逻辑。

### 中等工作量

- `ComicReaderPage` 补作者态便携跳转

特点：

- 功能本身不难。
- 但需要更谨慎处理按钮位置、文案和阅读器界面干扰问题。

### 中到偏高工作量

- `ComicSeriesPage` 补 creator 便携跳转

特点：

- 难点不是编码，而是语义设计。
- 需要避免把 “series 下我拥有部分 part” 误表达成 “我拥有 series”。

## 获取树优化的可能

当前前端已经可以实现功能，但判定过程仍有重复请求和结构不对齐的问题。下面是几个可行的优化方向。

### 方向一：抽出前端通用作者归属判定层

可以新增轻量工具或 hook，例如：

```txt
useAuthorNovelAccess(novelSlug)
useAuthorComicPartAccess(seriesSlug, partSlug)
```

职责：

- 内部统一处理 token 存在判断。
- 统一拉作者树。
- 对外只暴露 `canManage`、`isChecking`、`matchedEntity`。

收益：

- 避免 `NovelDetailPage`、`NovelReaderPage`、`ComicPartPage`、`ComicReaderPage` 各自重复写一遍。
- 后续要改文案、改错误兜底、改缓存策略，会更集中。

成本：

- 低。
- 主要是前端组织优化，不依赖后端改动。

### 方向二：为作者树增加前端缓存

当前模式下，同一会话中多个页面都可能反复请求：

- `/api/author/novels/tree`
- `/api/author/comics/tree`

可考虑：

- 模块级内存缓存
- 或统一迁移到 React Query / SWR 一类缓存方案

收益：

- 便携跳转按钮不会每进一个页都再打一遍作者树接口。
- 也能减少创作者页与公共页切换时的重复加载。

成本：

- 低到中。
- 取决于是否引入统一数据层。

### 方向三：给公共漫画详情补最小归属投影

这是最值得讨论的结构优化。

当前公共漫画详情数据不带 owner 信息，所以 `ComicPartPage` 或 `ComicSeriesPage` 想判断作者归属时，只能额外拉作者树。

可以考虑给公共漫画详情增加非常克制的归属投影，例如：

```txt
part.viewerContext = {
  canManage: boolean
}
```

前提：

- 仅在用户已登录时返回。
- 不泄露额外作者隐私，只返回当前 viewer 是否可管理。

收益：

- 公共页可直接决定是否显示 creator 按钮。
- 不再需要为了一个按钮专门请求作者树。

风险与注意：

- 这会让公共接口开始感知当前登录用户。
- 如果后端当前严格区分 public 与 author 边界，这属于接口设计上的变化，不只是字段新增。

判断：

- 工程价值高。
- 但属于中期优化，不适合作为本轮小改动前提。

### 方向四：补专用轻量接口，而不是复用整棵作者树

如果后续便携跳转入口越来越多，复用整棵树会逐渐显得偏重。

可考虑增加极小接口，例如：

```txt
GET /api/author/novels/{novelSlug}/access
GET /api/author/comics/{seriesSlug}/{partSlug}/access
```

返回：

```json
{
  "canManage": true
}
```

收益：

- 判定语义直接。
- 不需要为一个按钮把整棵树拉回前端。

代价：

- 需要新增后端接口。
- 需要维护额外的权限判断入口。

判断：

- 如果便携跳转只是少量页面需要，不必急着做。
- 如果后续评论区、用户页、搜索页、推荐流都要挂管理入口，这个方向会更合理。

## 建议实施顺序

建议按以下顺序推进，而不是一次性铺开：

1. 补 `CreatorComicPartPage -> ComicPartPage`
2. 补 `ComicPartPage -> CreatorComicPartPage`
3. 补 `NovelReaderPage` 的作者态跳转
4. 补 `ComicReaderPage` 的作者态跳转
5. 单独评审 `ComicSeriesPage` 是否需要入口，以及按钮文案
6. 再决定是否抽通用 hook 和缓存作者树

原因：

- 前四项都是低风险、可快速验证价值的页面。
- `ComicSeriesPage` 的主要难点是语义，不宜和前几项绑定处理。
- 等跳转入口数量达到 3 到 4 个后，再抽通用层会更稳，不容易过度设计。

## 最终判断

本次审计结论如下：

- 小说体系的便携跳转能力已经形成模板，可复用。
- 漫画体系缺少对称跳转，主要受作者归属层级影响，而不是单纯漏写按钮。
- `ComicPartPage` / `CreatorComicPartPage` 是最适合优先补齐的一组，工作量低，可行性高。
- `NovelReaderPage` 与 `ComicReaderPage` 也适合补，但需要先明确按钮语义。
- `ComicSeriesPage` 可以做，但不建议机械套用小说方案。
- 若后续类似入口增多，建议优先做“前端通用判定 hook + 作者树缓存”；若继续扩张，再考虑后端补轻量 access 接口或在公共详情中增加最小 viewer context。

## 附注

本报告为临时审计记录，只基于 2026-06-04 时点代码与文档的只读查阅结果，不包含运行态验证、接口压测或后端字段变更实验。
