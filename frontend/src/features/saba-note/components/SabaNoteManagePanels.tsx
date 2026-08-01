import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import SearchablePicker from "../../../components/SearchablePicker";
import { httpSabaNoteApi } from "../api";
import { DERIVATION_STATUS_PRESENTATION } from "../data/statuses";
import type { SabaNoteManageData } from "../hooks/useManageData";
import type {
  Category,
  Derivation,
  DerivationView,
  KnowledgeNode,
  NodeRelation,
  Tag,
} from "../types";
import { getDerivationDisplayTitle } from "../utils/derivation";
import KnowledgeDeleteDialog from "./KnowledgeDeleteDialog";

const DATE_FORMATTER = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

type PanelProps<T> = {
  item: T;
  data: SabaNoteManageData;
  onChanged: (message: string) => void;
  onDeleted: (message: string) => void;
};

function errorText(reason: unknown, fallback: string) {
  return reason instanceof Error ? reason.message : fallback;
}

function PanelSection({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="saba-note-manage-section">
      <div className="saba-note-manage-section-heading">
        <div>
          <h3>{title}</h3>
          {description && <p>{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function OperationError({ message }: { message: string | null }) {
  return message ? (
    <p className="saba-note-manage-operation-error" role="alert">
      {message}
    </p>
  ) : null;
}

function DerivationRow({ item }: { item: DerivationView }) {
  const presentation = DERIVATION_STATUS_PRESENTATION[item.derivation.status];
  return (
    <article className="saba-note-manage-related-card">
      <div className="saba-note-manage-related-main">
        <div className="saba-note-manage-related-meta">
          <span className={`saba-note-status saba-note-status-${presentation?.tone ?? "unknown"}`}>
            {presentation?.label ?? item.derivation.status}
          </span>
          <span>{DATE_FORMATTER.format(new Date(item.derivation.updatedAt))}</span>
        </div>
        <strong>{getDerivationDisplayTitle(item.derivation.title)}</strong>
        <p>{item.excerpt || "这条推导暂时没有正文摘要。"}</p>
      </div>
      <div className="saba-note-manage-related-actions">
        <Link to={`/saba-note/derivation/${item.derivation.id}`}>阅读</Link>
        <Link to={`/saba-note/workspace?id=${encodeURIComponent(item.derivation.id)}`}>
          编辑
        </Link>
      </div>
    </article>
  );
}

function RelationSentence({
  relation,
  nodes,
}: {
  relation: NodeRelation;
  nodes: KnowledgeNode[];
}) {
  const source = nodes.find((node) => node.id === relation.sourceNodeId);
  const target = nodes.find((node) => node.id === relation.targetNodeId);
  return (
    <div className="saba-note-manage-relation-sentence">
      <strong>{source?.title ?? "未知 Node"}</strong>
      <span>{relation.relationType}</span>
      <strong>{target?.title ?? "未知 Node"}</strong>
      {relation.note && <p>{relation.note}</p>}
    </div>
  );
}

export function NodeManagePanel({
  item: node,
  data,
  onChanged,
  onDeleted,
}: PanelProps<KnowledgeNode>) {
  const [title, setTitle] = useState(node.title);
  const [summary, setSummary] = useState(node.summary);
  const [nodeTags, setNodeTags] = useState<Tag[]>([]);
  const [backlinkCount, setBacklinkCount] = useState<number | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteMode, setDeleteMode] = useState<"safe" | "detach" | null>(null);

  useEffect(() => {
    let active = true;
    void Promise.all([
      httpSabaNoteApi.graph.getNodeTags(node.id),
      httpSabaNoteApi.graph.listBacklinks({ targetType: "node", targetId: node.id }),
    ])
      .then(([tags, backlinks]) => {
        if (!active) return;
        setNodeTags(tags);
        setBacklinkCount(backlinks.length);
      })
      .catch((reason: unknown) => {
        if (active) setError(errorText(reason, "Node 关联信息加载失败"));
      });
    return () => {
      active = false;
    };
  }, [node.id]);

  const category = data.categories.find((item) => item.id === node.categoryId);
  const derivations = data.derivations.filter(
    (item) => item.derivation.nodeId === node.id,
  );
  const relations = data.relations.filter(
    (item) => item.sourceNodeId === node.id || item.targetNodeId === node.id,
  );
  const selectedTagIds = new Set(nodeTags.map((tag) => tag.id));

  async function run(key: string, task: () => Promise<unknown>, message: string) {
    setPending(key);
    setError(null);
    try {
      await task();
      onChanged(message);
      return true;
    } catch (reason) {
      setError(errorText(reason, "操作失败"));
      return false;
    } finally {
      setPending(null);
    }
  }

  async function toggleTag(tag: Tag) {
    const selected = selectedTagIds.has(tag.id);
    const changed = await run(
      `tag-${tag.id}`,
      () =>
        selected
          ? httpSabaNoteApi.graph.removeNodeTag(node.id, tag.id)
          : httpSabaNoteApi.graph.addNodeTag(node.id, tag.id),
      selected ? "Node Tag 已解除" : "Node Tag 已关联",
    );
    if (!changed) return;
    setNodeTags((current) =>
      selected
        ? current.filter((item) => item.id !== tag.id)
        : [...current, tag],
    );
  }

  async function confirmDelete() {
    if (!deleteMode) return;
    setPending("delete");
    setError(null);
    try {
      if (deleteMode === "safe") {
        await httpSabaNoteApi.nodes.deleteEmpty(node.id);
      } else {
        await httpSabaNoteApi.nodes.deleteAndDetachDerivations(node.id);
      }
      setDeleteMode(null);
      onDeleted(
        deleteMode === "safe"
          ? "空 Node 已删除"
          : "Node 已删除，相关推导已转为未归档",
      );
    } catch (reason) {
      setError(errorText(reason, "Node 删除失败"));
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="saba-note-manage-detail-content">
      <header className="saba-note-manage-detail-header">
        <div>
          <p className="saba-note-manage-detail-kicker">知识实体</p>
          <h2>{node.title}</h2>
          <p>{node.summary || "尚未补充概念说明。"}</p>
        </div>
        <span className="saba-note-node-tag">{category?.name ?? "未分类"}</span>
      </header>
      <OperationError message={error} />

      <PanelSection title="概念名称" description="使用长期稳定、便于引用的概念名称。">
        <div className="saba-note-manage-inline-editor">
          <input className="admin-input" value={title} onChange={(e) => setTitle(e.target.value)} />
          <button
            type="button"
            className="admin-button-secondary"
            disabled={pending !== null || title.trim() === node.title}
            onClick={() => void run("title", () => httpSabaNoteApi.nodes.updateTitle(node.id, title), "Node 标题已更新")}
          >
            {pending === "title" ? "保存中…" : "保存名称"}
          </button>
        </div>
      </PanelSection>

      <PanelSection title="概念说明" description="一句说明帮助未来重新进入这个概念。">
        <textarea className="admin-textarea saba-note-manage-summary-input" value={summary} onChange={(e) => setSummary(e.target.value)} />
        <button
          type="button"
          className="admin-button-secondary saba-note-manage-section-save"
          disabled={pending !== null || summary.trim() === node.summary}
          onClick={() => void run("summary", () => httpSabaNoteApi.nodes.updateSummary(node.id, summary), "Node 说明已更新")}
        >
          {pending === "summary" ? "保存中…" : "保存说明"}
        </button>
      </PanelSection>

      <PanelSection title="Category" description="Category 提供导航；Node 保持未分类也是合法状态。">
        <SearchablePicker
          value={node.categoryId ?? ""}
          onChange={(value) => void run("category", () => httpSabaNoteApi.nodes.updateCategory(node.id, value || null), "Node Category 已更新")}
          options={data.categories.map((item) => ({ value: item.id, label: item.name }))}
          placeholder="未分类"
          searchPlaceholder="搜索 Category"
          disabled={pending !== null}
        />
      </PanelSection>

      <PanelSection title="Node Tag" description="Tag 描述横向属性，不替代 Node 本身。">
        <div className="saba-note-manage-tag-cloud">
          {data.tags.map((tag) => {
            const selected = selectedTagIds.has(tag.id);
            return (
              <button
                key={tag.id}
                type="button"
                className={selected ? "saba-note-tag-option saba-note-tag-option-selected" : "saba-note-tag-option"}
                disabled={pending !== null}
                aria-pressed={selected}
                onClick={() => void toggleTag(tag)}
              >
                {selected ? "✓ " : ""}#{tag.name}
              </button>
            );
          })}
          {data.tags.length === 0 && <p className="saba-note-manage-empty-copy">还没有 Tag，可在 Tag 视图创建。</p>}
        </div>
      </PanelSection>

      <PanelSection title={`关联推导 · ${derivations.length}`} description="这些内容围绕当前概念积累。">
        <div className="saba-note-manage-related-list">
          {derivations.map((item) => <DerivationRow key={item.derivation.id} item={item} />)}
          {derivations.length === 0 && <p className="saba-note-manage-empty-copy">当前还没有推导归档到这个 Node。</p>}
        </div>
      </PanelSection>

      <PanelSection title={`显式关系 · ${relations.length}`} description="Relation 是作者主动维护的概念联系。">
        <div className="saba-note-manage-relation-list">
          {relations.map((relation) => <RelationSentence key={relation.id} relation={relation} nodes={data.nodes} />)}
          {relations.length === 0 && <p className="saba-note-manage-empty-copy">尚未建立显式关系。</p>}
        </div>
      </PanelSection>

      <PanelSection title="正文引用" description="ContentLink 来自 Markdown 内部引用，不在此手工维护。">
        <p className="saba-note-manage-reference-count">
          {backlinkCount === null ? "正在读取引用…" : `${backlinkCount} 条正文引用指向这个 Node`}
        </p>
      </PanelSection>

      <PanelSection title="危险操作" description="删除前请确认知识内容和结构联系的去向。">
        <div className="saba-note-manage-danger-actions">
          <button type="button" className="admin-button-secondary" onClick={() => setDeleteMode("safe")}>安全删除空 Node</button>
          <button type="button" className="admin-button-danger" onClick={() => setDeleteMode("detach")}>删除 Node 并解除归档</button>
        </div>
      </PanelSection>

      <KnowledgeDeleteDialog
        open={deleteMode !== null}
        title={`删除 Node「${node.title}」？`}
        description={deleteMode === "safe" ? "安全删除仅在没有 Derivation 指向该 Node 时成功。" : `当前读取到 ${derivations.length} 条关联推导。`}
        removeItems={["删除 Node 本身", "解除 Node-Tag", "删除相关 Relation", "清理指向该 Node 的 ContentLink"]}
        preserveItems={["Derivation 正文和 Tag 保留", deleteMode === "detach" ? "相关 Derivation 转为未归档" : "其他知识内容不受影响"]}
        confirmLabel={deleteMode === "safe" ? "确认安全删除" : "确认删除并解除归档"}
        pending={pending === "delete"}
        error={pending === "delete" ? error : null}
        onCancel={() => setDeleteMode(null)}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}

export function CategoryManagePanel({
  item: category,
  data,
  onChanged,
  onDeleted,
  onCreateChild,
}: PanelProps<Category> & { onCreateChild: (parentId: string) => void }) {
  const [name, setName] = useState(category.name);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteMode, setDeleteMode] = useState<"safe" | "tree" | null>(null);
  const children = data.categories.filter((item) => item.parentId === category.id);
  const nodes = data.nodes.filter((item) => item.categoryId === category.id);
  const parent = data.categories.find((item) => item.id === category.parentId);

  async function rename() {
    setPending(true); setError(null);
    try { await httpSabaNoteApi.categories.rename(category.id, name); onChanged("Category 已重命名"); }
    catch (reason) { setError(errorText(reason, "Category 重命名失败")); }
    finally { setPending(false); }
  }

  async function remove() {
    if (!deleteMode) return;
    setPending(true); setError(null);
    try {
      if (deleteMode === "safe") await httpSabaNoteApi.categories.deleteEmpty(category.id);
      else await httpSabaNoteApi.categories.deleteTree(category.id);
      setDeleteMode(null);
      onDeleted(deleteMode === "safe" ? "Category 已删除" : "Category 树已删除，相关 Node 已转为未分类");
    } catch (reason) { setError(errorText(reason, "Category 删除失败")); }
    finally { setPending(false); }
  }

  return (
    <div className="saba-note-manage-detail-content">
      <header className="saba-note-manage-detail-header">
        <div><p className="saba-note-manage-detail-kicker">分类导航</p><h2>{category.name}</h2><p>{parent ? `位于 ${parent.name} 下` : "根 Category"}</p></div>
        <button type="button" className="admin-button-primary" onClick={() => onCreateChild(category.id)}>新建子 Category</button>
      </header>
      <OperationError message={error} />
      <PanelSection title="名称" description="Category 只提供辅助导航，不决定知识的全部结构。">
        <div className="saba-note-manage-inline-editor">
          <input className="admin-input" value={name} onChange={(e) => setName(e.target.value)} />
          <button type="button" className="admin-button-secondary" disabled={pending || name.trim() === category.name} onClick={() => void rename()}>{pending ? "保存中…" : "保存名称"}</button>
        </div>
      </PanelSection>
      <PanelSection title={`子 Category · ${children.length}`} description="当前 API 不支持移动父级，因此这里不提供拖拽。">
        <div className="saba-note-manage-chip-list">
          {children.map((item) => <span key={item.id}>{item.name}</span>)}
          {children.length === 0 && <p className="saba-note-manage-empty-copy">没有子 Category。</p>}
        </div>
      </PanelSection>
      <PanelSection title={`直接关联 Node · ${nodes.length}`} description="删除 Category 树时，这些 Node 会保留并转为未分类。">
        <div className="saba-note-manage-simple-list">
          {nodes.map((node) => <div key={node.id}><strong>{node.title}</strong><p>{node.summary || "暂无说明"}</p></div>)}
          {nodes.length === 0 && <p className="saba-note-manage-empty-copy">没有 Node 直接归属于这里。</p>}
        </div>
      </PanelSection>
      <PanelSection title="危险操作" description="安全删除要求没有子 Category 且没有直接关联 Node。">
        <div className="saba-note-manage-danger-actions">
          <button type="button" className="admin-button-secondary" onClick={() => setDeleteMode("safe")}>安全删除空 Category</button>
          <button type="button" className="admin-button-danger" onClick={() => setDeleteMode("tree")}>删除 Category 树</button>
        </div>
      </PanelSection>
      <KnowledgeDeleteDialog
        open={deleteMode !== null}
        title={`删除 Category「${category.name}」？`}
        description={deleteMode === "safe" ? "只有空叶子 Category 可以安全删除。" : `当前直接包含 ${children.length} 个子 Category、${nodes.length} 个 Node；更深层影响将由后端递归处理。`}
        removeItems={deleteMode === "tree" ? ["删除当前 Category", "递归删除全部子 Category"] : ["删除当前空 Category"]}
        preserveItems={["Node 不删除，受影响 Node 转为未分类", "Derivation 不删除"]}
        confirmLabel={deleteMode === "safe" ? "确认安全删除" : "确认删除分类树"}
        pending={pending}
        error={error}
        onCancel={() => setDeleteMode(null)}
        onConfirm={() => void remove()}
      />
    </div>
  );
}

export function TagManagePanel({ item: tag, onChanged, onDeleted }: PanelProps<Tag>) {
  const [name, setName] = useState(tag.name);
  const [nodes, setNodes] = useState<KnowledgeNode[]>([]);
  const [derivations, setDerivations] = useState<Derivation[]>([]);
  const [loadingLinks, setLoadingLinks] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteMode, setDeleteMode] = useState<"safe" | "force" | null>(null);

  useEffect(() => {
    let active = true;
    void Promise.all([
      httpSabaNoteApi.graph.getTagNodes(tag.id),
      httpSabaNoteApi.graph.getTagDerivations(tag.id),
    ]).then(([nextNodes, nextDerivations]) => {
      if (!active) return;
      setNodes(nextNodes); setDerivations(nextDerivations); setLoadingLinks(false);
    }).catch((reason: unknown) => {
      if (active) { setError(errorText(reason, "Tag 关联信息加载失败")); setLoadingLinks(false); }
    });
    return () => { active = false; };
  }, [tag.id]);

  async function rename() {
    setPending(true); setError(null);
    try { await httpSabaNoteApi.graph.renameTag(tag.id, name); onChanged("Tag 已重命名"); }
    catch (reason) { setError(errorText(reason, "Tag 重命名失败")); }
    finally { setPending(false); }
  }

  async function remove() {
    if (!deleteMode) return;
    setPending(true); setError(null);
    try {
      if (deleteMode === "safe") await httpSabaNoteApi.graph.deleteEmptyTag(tag.id);
      else await httpSabaNoteApi.graph.deleteTagWithLinks(tag.id);
      setDeleteMode(null); onDeleted(deleteMode === "safe" ? "空 Tag 已删除" : "Tag 及其联系已删除");
    } catch (reason) { setError(errorText(reason, "Tag 删除失败")); }
    finally { setPending(false); }
  }

  return (
    <div className="saba-note-manage-detail-content">
      <header className="saba-note-manage-detail-header"><div><p className="saba-note-manage-detail-kicker">横向属性</p><h2>#{tag.name}</h2><p>Tag 描述性质，并为 Node 与 Derivation 建立横向索引。</p></div></header>
      <OperationError message={error} />
      <PanelSection title="名称">
        <div className="saba-note-manage-inline-editor"><input className="admin-input" value={name} onChange={(e) => setName(e.target.value)} /><button type="button" className="admin-button-secondary" disabled={pending || name.trim() === tag.name} onClick={() => void rename()}>{pending ? "保存中…" : "保存名称"}</button></div>
      </PanelSection>
      <PanelSection title={`关联 Node · ${loadingLinks ? "…" : nodes.length}`}>
        <div className="saba-note-manage-simple-list">{nodes.map((node) => <div key={node.id}><strong>{node.title}</strong><p>{node.summary || "暂无说明"}</p></div>)}{!loadingLinks && nodes.length === 0 && <p className="saba-note-manage-empty-copy">没有关联 Node。</p>}</div>
      </PanelSection>
      <PanelSection title={`关联推导 · ${loadingLinks ? "…" : derivations.length}`} description="此反向索引包含回收站中的推导，用于完整判断 Tag 影响。">
        <div className="saba-note-manage-simple-list">{derivations.map((item) => <div key={item.id}><strong>{getDerivationDisplayTitle(item.title)}</strong><p>{item.isDiscarded ? "位于回收站" : DATE_FORMATTER.format(new Date(item.updatedAt))}</p></div>)}{!loadingLinks && derivations.length === 0 && <p className="saba-note-manage-empty-copy">没有关联推导。</p>}</div>
      </PanelSection>
      <PanelSection title="危险操作" description="Tag 删除只处理索引和联系，不删除知识内容。">
        <div className="saba-note-manage-danger-actions"><button type="button" className="admin-button-secondary" onClick={() => setDeleteMode("safe")}>安全删除空 Tag</button><button type="button" className="admin-button-danger" onClick={() => setDeleteMode("force")}>删除 Tag 及全部联系</button></div>
      </PanelSection>
      <KnowledgeDeleteDialog
        open={deleteMode !== null}
        title={`删除 Tag「#${tag.name}」？`}
        description={deleteMode === "safe" ? "安全删除仅在没有任何 Node 或 Derivation 关联时成功。" : `当前读取到 ${nodes.length} 个 Node、${derivations.length} 条推导关联。`}
        removeItems={deleteMode === "force" ? ["删除 Tag 本身", "解除全部 Node-Tag", "解除全部 Derivation-Tag"] : ["删除当前空 Tag"]}
        preserveItems={["Node 保留", "Derivation 及其正文保留"]}
        confirmLabel={deleteMode === "safe" ? "确认安全删除" : "确认删除及解除联系"}
        pending={pending} error={error} onCancel={() => setDeleteMode(null)} onConfirm={() => void remove()}
      />
    </div>
  );
}

export function RelationManagePanel({ item: relation, data, onChanged, onDeleted }: PanelProps<NodeRelation>) {
  const [relationType, setRelationType] = useState(relation.relationType);
  const [note, setNote] = useState(relation.note);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const source = data.nodes.find((node) => node.id === relation.sourceNodeId);
  const target = data.nodes.find((node) => node.id === relation.targetNodeId);

  async function save() {
    setPending(true); setError(null);
    try { await httpSabaNoteApi.graph.updateRelation(relation.id, { relationType, note }); onChanged("Relation 已更新"); }
    catch (reason) { setError(errorText(reason, "Relation 更新失败")); }
    finally { setPending(false); }
  }

  async function remove() {
    setPending(true); setError(null);
    try { await httpSabaNoteApi.graph.deleteRelation(relation.id); setDeleting(false); onDeleted("Relation 已删除"); }
    catch (reason) { setError(errorText(reason, "Relation 删除失败")); }
    finally { setPending(false); }
  }

  return (
    <div className="saba-note-manage-detail-content">
      <header className="saba-note-manage-detail-header"><div><p className="saba-note-manage-detail-kicker">显式知识关系</p><h2>{source?.title ?? "未知 Node"} <span className="saba-note-manage-heading-arrow">→</span> {target?.title ?? "未知 Node"}</h2><p>{relation.relationType}</p></div></header>
      <OperationError message={error} />
      <PanelSection title="关系端点" description="当前 API 不支持替换端点；对象选错时应删除后重新建立。">
        <RelationSentence relation={relation} nodes={data.nodes} />
      </PanelSection>
      <PanelSection title="关系类型"><input className="admin-input saba-note-manage-full-input" value={relationType} onChange={(e) => setRelationType(e.target.value)} /></PanelSection>
      <PanelSection title="说明"><textarea className="admin-textarea saba-note-manage-summary-input" value={note} onChange={(e) => setNote(e.target.value)} /><button type="button" className="admin-button-secondary saba-note-manage-section-save" disabled={pending || (relationType.trim() === relation.relationType && note.trim() === relation.note)} onClick={() => void save()}>{pending ? "保存中…" : "保存关系"}</button></PanelSection>
      <PanelSection title="危险操作" description="只删除这条显式 Relation，不删除两个 Node 或正文引用。"><button type="button" className="admin-button-danger" onClick={() => setDeleting(true)}>删除这条 Relation</button></PanelSection>
      <KnowledgeDeleteDialog open={deleting} title={`删除“${source?.title ?? "未知 Node"} —${relation.relationType}→ ${target?.title ?? "未知 Node"}”？`} description="请确认要移除的是这条人工维护的显式关系。" removeItems={["删除当前 Relation"]} preserveItems={["Source 与 Target Node 保留", "Derivation 与 ContentLink 不受影响"]} confirmLabel="确认删除 Relation" pending={pending} error={error} onCancel={() => setDeleting(false)} onConfirm={() => void remove()} />
    </div>
  );
}

export function DerivationManagePanel({ item, data, onChanged, onDeleted }: PanelProps<DerivationView>) {
  const { derivation } = item;
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [discarding, setDiscarding] = useState(false);
  const selectedTagIds = new Set(item.tags.map((tag) => tag.id));
  const presentation = DERIVATION_STATUS_PRESENTATION[derivation.status];

  async function run(key: string, task: () => Promise<unknown>, message: string) {
    setPending(key); setError(null);
    try { await task(); onChanged(message); }
    catch (reason) { setError(errorText(reason, "推导整理失败")); }
    finally { setPending(null); }
  }

  async function toggleTag(tag: Tag) {
    const selected = selectedTagIds.has(tag.id);
    await run(`tag-${tag.id}`, () => selected ? httpSabaNoteApi.graph.removeDerivationTag(derivation.id, tag.id) : httpSabaNoteApi.graph.addDerivationTag(derivation.id, tag.id), selected ? "Derivation Tag 已解除" : "Derivation Tag 已关联");
  }

  async function discard() {
    setPending("discard"); setError(null);
    try { await httpSabaNoteApi.derivations.discard(derivation.id); setDiscarding(false); onDeleted("推导已移入回收站"); }
    catch (reason) { setError(errorText(reason, "移入回收站失败")); }
    finally { setPending(null); }
  }

  return (
    <div className="saba-note-manage-detail-content">
      <header className="saba-note-manage-detail-header">
        <div><p className="saba-note-manage-detail-kicker">内容整理</p><h2>{getDerivationDisplayTitle(derivation.title)}</h2><p>{item.excerpt || "这条推导暂时没有正文摘要。"}</p></div>
        <span className={`saba-note-status saba-note-status-${presentation?.tone ?? "unknown"}`}>{presentation?.label ?? derivation.status}</span>
      </header>
      <OperationError message={error} />
      <div className="saba-note-manage-reading-actions"><Link className="admin-button-primary" to={`/saba-note/derivation/${derivation.id}`}>进入阅读</Link><Link className="admin-button-secondary" to={`/saba-note/workspace?id=${encodeURIComponent(derivation.id)}`}>编辑正文</Link></div>
      <PanelSection title="Node 归属" description="未归档推导是合法状态，可以稍后再整理。">
        <SearchablePicker value={derivation.nodeId ?? ""} onChange={(value) => void run("node", () => httpSabaNoteApi.derivations.updateNode(derivation.id, value || null), "推导归属已更新")} options={data.nodes.map((node) => ({ value: node.id, label: node.title, description: data.categories.find((category) => category.id === node.categoryId)?.name }))} placeholder="未归档" searchPlaceholder="搜索 Node" disabled={pending !== null} />
      </PanelSection>
      <PanelSection title="Tag">
        <div className="saba-note-manage-tag-cloud">{data.tags.map((tag) => { const selected = selectedTagIds.has(tag.id); return <button key={tag.id} type="button" className={selected ? "saba-note-tag-option saba-note-tag-option-selected" : "saba-note-tag-option"} disabled={pending !== null} aria-pressed={selected} onClick={() => void toggleTag(tag)}>{selected ? "✓ " : ""}#{tag.name}</button>; })}{data.tags.length === 0 && <p className="saba-note-manage-empty-copy">还没有 Tag。</p>}</div>
      </PanelSection>
      <PanelSection title="内容信息"><dl className="saba-note-manage-facts"><div><dt>Category</dt><dd>{item.category?.name ?? "未分类"}</dd></div><div><dt>Node</dt><dd>{item.node?.title ?? "未归档"}</dd></div><div><dt>更新时间</dt><dd>{DATE_FORMATTER.format(new Date(derivation.updatedAt))}</dd></div></dl></PanelSection>
      <PanelSection title="回收站" description="移入回收站会保留正文、Node 归属、Tag 和 ContentLink，可在回收站恢复。"><button type="button" className="admin-button-danger" onClick={() => setDiscarding(true)}>移入回收站</button></PanelSection>
      <KnowledgeDeleteDialog open={discarding} title={`将「${getDerivationDisplayTitle(derivation.title)}」移入回收站？`} description="这不是永久删除，可以稍后恢复。" removeItems={["从正常内容流中移除", "进入 SaBaNote 回收站"]} preserveItems={["Markdown 正文保留", "Node、Tag 与 ContentLink 保留", "可从回收站恢复"]} confirmLabel="确认移入回收站" pending={pending === "discard"} error={error} onCancel={() => setDiscarding(false)} onConfirm={() => void discard()} footerNote="此操作可以在回收站恢复。" />
    </div>
  );
}

export { RelationSentence };
