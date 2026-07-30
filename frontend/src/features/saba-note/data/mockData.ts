import type {
  Category,
  Derivation,
  KnowledgeNode,
  NodeRelation,
  Tag,
} from "../types";

const CREATED_AT = "2026-06-01T08:00:00+08:00";

export const mockCategories: Category[] = [
  {
    id: "thinking",
    name: "思维方法",
    parentId: null,
    createdAt: CREATED_AT,
    updatedAt: "2026-07-20T10:00:00+08:00",
  },
  {
    id: "engineering",
    name: "软件工程",
    parentId: null,
    createdAt: CREATED_AT,
    updatedAt: "2026-07-28T21:10:00+08:00",
  },
  {
    id: "language",
    name: "语言与表达",
    parentId: null,
    createdAt: CREATED_AT,
    updatedAt: "2026-07-22T18:05:00+08:00",
  },
];

export const mockNodes: KnowledgeNode[] = [
  {
    id: "bayesian-thinking",
    title: "贝叶斯式思考",
    summary: "用新证据持续修正判断，而不是只保存最终结论。",
    categoryId: "thinking",
    createdAt: CREATED_AT,
    updatedAt: "2026-07-29T14:35:00+08:00",
  },
  {
    id: "system-boundaries",
    title: "系统边界",
    summary: "关注模块归属、变化原因和可替换边界。",
    categoryId: "engineering",
    createdAt: CREATED_AT,
    updatedAt: "2026-07-28T21:10:00+08:00",
  },
  {
    id: "cache-design",
    title: "缓存设计",
    summary: "从副本、一致性和失效责任理解缓存。",
    categoryId: "engineering",
    createdAt: CREATED_AT,
    updatedAt: "2026-07-25T09:20:00+08:00",
  },
  {
    id: "context-writing",
    title: "上下文写作",
    summary: "让结论保留重新进入推理过程的上下文。",
    categoryId: "language",
    createdAt: CREATED_AT,
    updatedAt: "2026-07-22T18:05:00+08:00",
  },
];

export const mockTags: Tag[] = [
  { id: "mental-model", name: "心智模型", createdAt: CREATED_AT, updatedAt: CREATED_AT },
  { id: "decision", name: "决策", createdAt: CREATED_AT, updatedAt: CREATED_AT },
  { id: "architecture", name: "架构", createdAt: CREATED_AT, updatedAt: CREATED_AT },
  { id: "frontend", name: "前端", createdAt: CREATED_AT, updatedAt: CREATED_AT },
  { id: "writing", name: "写作", createdAt: CREATED_AT, updatedAt: CREATED_AT },
  { id: "practice", name: "实践", createdAt: CREATED_AT, updatedAt: CREATED_AT },
];

export const mockDerivations: Derivation[] = [
  {
    id: "evidence-changes-confidence",
    title: "证据不是结论，而是对置信度的更新",
    contentMd: `## 从二元判断退后一步

我们经常把信息处理成“相信”或“不相信”两个按钮。但现实中的大多数证据，只够让一个判断变得**更可能**或**更不可能**。

假设我原本认为某个方案成功的概率是 40%。一次小规模实验表现良好，不意味着成功率立刻变成 100%；更合理的动作是追问：

- 这次实验和真实环境有多接近？
- 样本是否足够？
- 有没有同样能解释结果的其他原因？

## 一个更有用的表达

与其说“新证据证明了我的观点”，不如说：

> 在当前假设下，这条证据应当把我的置信度从哪里推向哪里？

这种表达保留了修正空间，也迫使我说明更新的幅度。推导的价值不在于永远正确，而在于留下**为什么这样更新**的路径。`,
    status: "verified",
    nodeId: "bayesian-thinking",
    isDiscarded: false,
    discardedAt: null,
    createdAt: "2026-07-15T11:20:00+08:00",
    updatedAt: "2026-07-29T14:35:00+08:00",
  },
  {
    id: "feature-boundary-before-abstraction",
    title: "先确定 feature 边界，再讨论组件抽象",
    contentMd: `## 抽象之前先问归属

看到两个相似界面时，第一反应通常是提取“通用组件”。但视觉相似不代表变化原因相同。

一个更稳妥的顺序是：

1. 先确认功能属于哪个 feature；
2. 让领域行为在 feature 内完整闭环；
3. 只有基础交互已经稳定时，才把它提升为主站能力。

这样做会暂时保留少量重复，却避免一个业务模块的变化牵动完全无关的页面。`,
    status: "draft",
    nodeId: "system-boundaries",
    isDiscarded: false,
    discardedAt: null,
    createdAt: "2026-07-18T16:40:00+08:00",
    updatedAt: "2026-07-28T21:10:00+08:00",
  },
  {
    id: "cache-is-a-consistency-decision",
    title: "缓存首先是一项一致性决策",
    contentMd: `## 被忽略的问题

“加一层缓存”听起来像单纯的性能优化，实际上它同时创建了一份数据副本。

真正需要先写下来的不是缓存介质，而是：

- 可接受的陈旧窗口有多长；
- 写入失败时以哪一份为准；
- 谁拥有失效动作；
- 无法确认一致性时如何降级。

只有这些问题有答案，缓存命中率才是值得优化的指标。`,
    status: "failed",
    nodeId: "cache-design",
    isDiscarded: false,
    discardedAt: null,
    createdAt: "2026-07-19T09:20:00+08:00",
    updatedAt: "2026-07-25T09:20:00+08:00",
  },
  {
    id: "context-before-conclusion",
    title: "写结论之前，先交代它解决了什么张力",
    contentMd: `## 结论为什么会失去生命力

只记录“最终应该怎么做”，几周后往往已经不知道它适用于什么条件。

更耐用的记录至少包含三个部分：

1. 当时存在什么张力；
2. 哪些限制无法同时满足；
3. 为什么当前取舍比其他选择更合适。

结论因此不再是一条命令，而是一次可以被复查的推导。`,
    status: "misconception",
    nodeId: "context-writing",
    isDiscarded: false,
    discardedAt: null,
    createdAt: "2026-07-20T12:30:00+08:00",
    updatedAt: "2026-07-22T18:05:00+08:00",
  },
];

export const mockDerivationTagLinks: Record<string, string[]> = {
  "evidence-changes-confidence": ["mental-model", "decision"],
  "feature-boundary-before-abstraction": ["architecture", "frontend"],
  "cache-is-a-consistency-decision": ["architecture", "practice"],
  "context-before-conclusion": ["writing", "mental-model"],
};

export const mockRelations: NodeRelation[] = [
  {
    id: "relation-system-cache",
    sourceNodeId: "system-boundaries",
    targetNodeId: "cache-design",
    relationType: "informs",
    note: "缓存边界需要跟随系统所有权划分。",
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
  },
];
