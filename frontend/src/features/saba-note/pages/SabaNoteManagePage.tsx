import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";

import SearchBox from "../../../components/SearchBox";
import SearchablePicker from "../../../components/SearchablePicker";
import { httpSabaNoteApi } from "../api";
import {
  CategoryManagePanel,
  DerivationManagePanel,
  NodeManagePanel,
  RelationManagePanel,
  TagManagePanel,
} from "../components/SabaNoteManagePanels";
import SabaNoteAsyncState from "../components/SabaNoteAsyncState";
import SabaNoteShell from "../components/SabaNoteShell";
import { DERIVATION_STATUS_PRESENTATION } from "../data/statuses";
import useManageData from "../hooks/useManageData";
import type { Category, DerivationView } from "../types";
import { getDerivationDisplayTitle } from "../utils/derivation";

type ManageView = "nodes" | "categories" | "tags" | "relations" | "derivations";

const MANAGE_VIEWS: Array<{ value: ManageView; label: string; eyebrow: string }> = [
  { value: "nodes", label: "Node", eyebrow: "长期概念" },
  { value: "categories", label: "Category", eyebrow: "分类导航" },
  { value: "tags", label: "Tag", eyebrow: "横向属性" },
  { value: "relations", label: "Relation", eyebrow: "显式关系" },
  { value: "derivations", label: "Derivation", eyebrow: "内容整理" },
];

const MANAGE_DATE_FORMATTER = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

const SELECTION_KEYS: Record<ManageView, string> = {
  nodes: "node",
  categories: "category",
  tags: "tag",
  relations: "relation",
  derivations: "derivation",
};

function isManageView(value: string | null): value is ManageView {
  return MANAGE_VIEWS.some((item) => item.value === value);
}

function categoryRows(categories: Category[]) {
  const rows: Array<{ category: Category; depth: number }> = [];
  const visited = new Set<string>();
  function visit(parentId: string | null, depth: number) {
    categories
      .filter((item) => item.parentId === parentId)
      .sort((a, b) => a.name.localeCompare(b.name, "zh-CN"))
      .forEach((category) => {
        if (visited.has(category.id)) return;
        visited.add(category.id);
        rows.push({ category, depth });
        visit(category.id, depth + 1);
      });
  }
  visit(null, 0);
  categories.forEach((category) => {
    if (!visited.has(category.id)) rows.push({ category, depth: 0 });
  });
  return rows;
}

export default function SabaNoteManagePage() {
  const { data, loading, error, reload } = useManageData();
  const [searchParams, setSearchParams] = useSearchParams();
  const explicitNodeId = searchParams.get("node");
  const requestedView = searchParams.get("view");
  const view: ManageView = explicitNodeId
    ? "nodes"
    : isManageView(requestedView)
      ? requestedView
      : "nodes";
  const selectedId = searchParams.get(SELECTION_KEYS[view]) ?? "";
  const query = searchParams.get("q") ?? "";
  const [filter, setFilter] = useState("");
  const [creating, setCreating] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createSummary, setCreateSummary] = useState("");
  const [createParentId, setCreateParentId] = useState("");
  const [createCategoryId, setCreateCategoryId] = useState("");
  const [relationSourceId, setRelationSourceId] = useState("");
  const [relationTargetId, setRelationTargetId] = useState("");
  const [relationNote, setRelationNote] = useState("");
  const [createPending, setCreatePending] = useState(false);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const normalizedQuery = query.trim().toLocaleLowerCase();
  const rows = useMemo(() => categoryRows(data.categories), [data.categories]);
  const categoryMap = useMemo(
    () => new Map(data.categories.map((item) => [item.id, item])),
    [data.categories],
  );
  const nodeMap = useMemo(
    () => new Map(data.nodes.map((item) => [item.id, item])),
    [data.nodes],
  );

  const filteredNodes = data.nodes.filter((node) => {
    if (filter === "uncategorized" && node.categoryId !== null) return false;
    if (filter && filter !== "uncategorized" && node.categoryId !== filter) return false;
    const category = node.categoryId ? categoryMap.get(node.categoryId) : null;
    return `${node.title} ${node.summary} ${category?.name ?? "未分类"}`
      .toLocaleLowerCase()
      .includes(normalizedQuery);
  });
  const filteredCategories = rows.filter(({ category }) =>
    category.name.toLocaleLowerCase().includes(normalizedQuery),
  );
  const filteredTags = data.tags.filter((tag) =>
    tag.name.toLocaleLowerCase().includes(normalizedQuery),
  );
  const filteredRelations = data.relations.filter((relation) => {
    if (
      filter &&
      relation.sourceNodeId !== filter &&
      relation.targetNodeId !== filter
    ) {
      return false;
    }
    const source = nodeMap.get(relation.sourceNodeId);
    const target = nodeMap.get(relation.targetNodeId);
    return `${source?.title ?? ""} ${relation.relationType} ${target?.title ?? ""} ${relation.note}`
      .toLocaleLowerCase()
      .includes(normalizedQuery);
  });
  const filteredDerivations = data.derivations.filter((item) => {
    if (filter === "unassigned" && item.derivation.nodeId !== null) return false;
    if (
      filter.startsWith("category:") &&
      item.category?.id !== filter.slice("category:".length)
    ) {
      return false;
    }
    if (
      filter &&
      filter !== "unassigned" &&
      !filter.startsWith("category:") &&
      item.derivation.nodeId !== filter
    ) {
      return false;
    }
    return [
      item.derivation.title,
      item.excerpt,
      item.node?.title,
      item.category?.name,
      ...item.tags.map((tag) => tag.name),
    ]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase()
      .includes(normalizedQuery);
  });

  const counts: Record<ManageView, number> = {
    nodes: data.nodes.length,
    categories: data.categories.length,
    tags: data.tags.length,
    relations: data.relations.length,
    derivations: data.derivations.length,
  };

  function setView(nextView: ManageView) {
    const next = new URLSearchParams();
    next.set("view", nextView);
    setSearchParams(next);
    setFilter("");
    setNotice(null);
    closeCreate();
  }

  function selectItem(id: string) {
    const next = new URLSearchParams(searchParams);
    next.set("view", view);
    Object.values(SELECTION_KEYS).forEach((key) => next.delete(key));
    next.set(SELECTION_KEYS[view], id);
    setSearchParams(next);
  }

  function clearSelection() {
    const next = new URLSearchParams(searchParams);
    Object.values(SELECTION_KEYS).forEach((key) => next.delete(key));
    setSearchParams(next, { replace: true });
  }

  function updateQuery(value: string) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set("q", value);
    else next.delete("q");
    setSearchParams(next, { replace: true });
  }

  function openCreate(parentId = "") {
    setCreateName("");
    setCreateSummary("");
    setCreateParentId(parentId);
    setCreateCategoryId("");
    setRelationSourceId(filter && view === "relations" ? filter : "");
    setRelationTargetId("");
    setRelationNote("");
    setOperationError(null);
    setCreating(true);
  }

  function closeCreate() {
    setCreating(false);
    setOperationError(null);
  }

  async function createEntity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreatePending(true);
    setOperationError(null);
    try {
      let id = "";
      let message = "";
      if (view === "nodes") {
        const created = await httpSabaNoteApi.nodes.create({
          title: createName,
          summary: createSummary,
          categoryId: createCategoryId || null,
        });
        id = created.id;
        message = "Node 已创建";
      } else if (view === "categories") {
        const created = await httpSabaNoteApi.categories.create({
          name: createName,
          parentId: createParentId || null,
        });
        id = created.id;
        message = createParentId ? "子 Category 已创建" : "根 Category 已创建";
      } else if (view === "tags") {
        const created = await httpSabaNoteApi.graph.createTag(createName);
        id = created.id;
        message = "Tag 已创建";
      } else if (view === "relations") {
        if (relationSourceId === relationTargetId) {
          throw new Error("Relation 的起点和终点需要是不同的 Node");
        }
        const created = await httpSabaNoteApi.graph.createRelation({
          sourceNodeId: relationSourceId,
          targetNodeId: relationTargetId,
          relationType: createName,
          note: relationNote,
        });
        id = created.id;
        message = "Relation 已创建";
      }
      closeCreate();
      reload();
      setNotice(message);
      if (id) {
        const next = new URLSearchParams(searchParams);
        next.set("view", view);
        Object.values(SELECTION_KEYS).forEach((key) => next.delete(key));
        next.set(SELECTION_KEYS[view], id);
        setSearchParams(next);
      }
    } catch (reason) {
      setOperationError(reason instanceof Error ? reason.message : "创建失败");
    } finally {
      setCreatePending(false);
    }
  }

  function handleChanged(message: string) {
    setNotice(message);
    reload();
  }

  function handleDeleted(message: string) {
    setNotice(message);
    clearSelection();
    reload();
  }

  const selectedNode = data.nodes.find((item) => item.id === selectedId);
  const selectedCategory = data.categories.find((item) => item.id === selectedId);
  const selectedTag = data.tags.find((item) => item.id === selectedId);
  const selectedRelation = data.relations.find((item) => item.id === selectedId);
  const selectedDerivation = data.derivations.find(
    (item) => item.derivation.id === selectedId,
  );
  const hasSelection = Boolean(
    selectedNode || selectedCategory || selectedTag || selectedRelation || selectedDerivation,
  );

  if (loading && counts.nodes + counts.categories + counts.tags + counts.relations + counts.derivations === 0) {
    return (
      <SabaNoteShell eyebrow="知识整理" wide>
        <div className="py-10"><SabaNoteAsyncState kind="loading" title="正在打开知识工作台" description="正在读取你的概念、分类、标签、关系和推导。" /></div>
      </SabaNoteShell>
    );
  }

  if (error && counts.nodes + counts.categories + counts.tags + counts.relations + counts.derivations === 0) {
    return (
      <SabaNoteShell eyebrow="知识整理" wide>
        <div className="py-10"><SabaNoteAsyncState kind="error" title="知识工作台加载失败" description={error} action={<button type="button" className="admin-button-secondary px-4 py-2" onClick={reload}>重新加载</button>} /></div>
      </SabaNoteShell>
    );
  }

  const activeView = MANAGE_VIEWS.find((item) => item.value === view)!;
  const listIsEmpty =
    view === "nodes" ? filteredNodes.length === 0 :
      view === "categories" ? filteredCategories.length === 0 :
        view === "tags" ? filteredTags.length === 0 :
          view === "relations" ? filteredRelations.length === 0 : filteredDerivations.length === 0;

  return (
    <SabaNoteShell
      wide
      hideHeader
    >
      <main className="saba-note-manage-page">
        <header className="saba-note-manage-hero">
          <div>
            <p>PERSONAL KNOWLEDGE WORKSPACE</p>
            <h1>整理你的知识空间</h1>
            <span>已经写下了内容？可以考虑将它们归类到节点和目录中，形成更好的结构。</span>
          </div>
          <div className="saba-note-manage-hero-actions">
            <Link to="/saba-note/trash" className="admin-button-secondary">回收站</Link>
            <Link to="/saba-note" className="admin-button-secondary">总览页</Link>
            {view === "derivations" ? (
              <Link to="/saba-note/workspace" className="admin-button-primary">写一条推导</Link>
            ) : (
              <button type="button" className="admin-button-primary" onClick={() => openCreate()}>
                新建 {activeView.label}
              </button>
            )}
          </div>
        </header>

        <nav className="saba-note-manage-tabs" aria-label="知识对象类型">
          {MANAGE_VIEWS.map((item) => (
            <button key={item.value} type="button" className={view === item.value ? "active" : ""} onClick={() => setView(item.value)}>
              <span>{item.label}</span><small>{item.eyebrow}</small><b>{counts[item.value]}</b>
            </button>
          ))}
        </nav>

        {notice && <div className="saba-note-manage-notice" role="status"><span>✓</span>{notice}<button type="button" onClick={() => setNotice(null)}>×</button></div>}

        <section className={`surface-card saba-note-manage-workbench ${hasSelection ? "has-selection" : ""}`}>
          <aside className="saba-note-manage-list-pane">
            <div className="saba-note-manage-list-toolbar">
              <div><p>{activeView.eyebrow}</p><strong>{activeView.label}</strong><span>{counts[view]} 个对象</span></div>
              <SearchBox value={query} onChange={updateQuery} placeholder={`搜索 ${activeView.label}`} className="saba-note-manage-search" />
              {(view === "nodes" || view === "derivations") && (
                <SearchablePicker
                  value={filter}
                  onChange={setFilter}
                  options={[
                    { value: view === "nodes" ? "uncategorized" : "unassigned", label: view === "nodes" ? "未分类 Node" : "未归档推导" },
                    ...data.categories.map((category) => ({
                      value: view === "nodes" ? category.id : `category:${category.id}`,
                      label: category.name,
                    })),
                    ...(view === "derivations" ? data.nodes.map((node) => ({ value: node.id, label: node.title })) : []),
                  ]}
                  placeholder="全部"
                  searchPlaceholder="搜索筛选项"
                />
              )}
              {view === "relations" && (
                <SearchablePicker value={filter} onChange={setFilter} options={data.nodes.map((node) => ({ value: node.id, label: node.title }))} placeholder="全部 Node" searchPlaceholder="按 Node 筛选" />
              )}
            </div>

            <div className="saba-note-manage-entity-list">
              {view === "nodes" && filteredNodes.map((node) => (
                <button key={node.id} type="button" className={selectedId === node.id ? "active" : ""} onClick={() => selectItem(node.id)}>
                  <span className="saba-note-manage-entity-icon">◇</span><span><strong>{node.title}</strong><small>{categoryMap.get(node.categoryId ?? "")?.name ?? "未分类"}</small><p>{node.summary || "尚未补充概念说明"}</p></span>
                </button>
              ))}
              {view === "categories" && filteredCategories.map(({ category, depth }) => (
                <button key={category.id} type="button" className={selectedId === category.id ? "active" : ""} style={{ paddingLeft: `${1 + Math.min(depth, 4) * 0.8}rem` }} onClick={() => selectItem(category.id)}>
                  <span className="saba-note-manage-entity-icon">⌁</span><span><strong>{category.name}</strong><small>{depth === 0 ? "根 Category" : `第 ${depth + 1} 层`}</small></span>
                </button>
              ))}
              {view === "tags" && filteredTags.map((tag) => (
                <button key={tag.id} type="button" className={selectedId === tag.id ? "active" : ""} onClick={() => selectItem(tag.id)}>
                  <span className="saba-note-manage-entity-icon">#</span><span><strong>{tag.name}</strong><small>横向索引</small></span>
                </button>
              ))}
              {view === "relations" && filteredRelations.map((relation) => (
                <button key={relation.id} type="button" className={selectedId === relation.id ? "active" : ""} onClick={() => selectItem(relation.id)}>
                  <span className="saba-note-manage-entity-icon">→</span><span><strong>{relation.relationType}</strong><small>{nodeMap.get(relation.sourceNodeId)?.title ?? "未知"} → {nodeMap.get(relation.targetNodeId)?.title ?? "未知"}</small><p>{relation.note || "没有补充说明"}</p></span>
                </button>
              ))}
              {view === "derivations" && filteredDerivations.map((item) => <DerivationListItem key={item.derivation.id} item={item} active={selectedId === item.derivation.id} onClick={() => selectItem(item.derivation.id)} />)}
              {listIsEmpty && <div className="saba-note-manage-list-empty"><span>⌕</span><strong>没有匹配内容</strong><p>换一个搜索词或清除当前筛选。</p></div>}
            </div>
          </aside>

          <section className="saba-note-manage-detail-pane">
            {hasSelection && <button type="button" className="saba-note-manage-mobile-back" onClick={clearSelection}>← 返回列表</button>}
            {view === "nodes" && selectedNode && <NodeManagePanel key={selectedNode.id} item={selectedNode} data={data} onChanged={handleChanged} onDeleted={handleDeleted} />}
            {view === "categories" && selectedCategory && <CategoryManagePanel key={selectedCategory.id} item={selectedCategory} data={data} onChanged={handleChanged} onDeleted={handleDeleted} onCreateChild={openCreate} />}
            {view === "tags" && selectedTag && <TagManagePanel key={selectedTag.id} item={selectedTag} data={data} onChanged={handleChanged} onDeleted={handleDeleted} />}
            {view === "relations" && selectedRelation && <RelationManagePanel key={selectedRelation.id} item={selectedRelation} data={data} onChanged={handleChanged} onDeleted={handleDeleted} />}
            {view === "derivations" && selectedDerivation && <DerivationManagePanel key={selectedDerivation.derivation.id} item={selectedDerivation} data={data} onChanged={handleChanged} onDeleted={handleDeleted} />}
            {!hasSelection && <div className="saba-note-manage-detail-empty"><span>{view === "nodes" ? "◇" : view === "categories" ? "⌁" : view === "tags" ? "#" : view === "relations" ? "→" : "▤"}</span><h2>选择一个 {activeView.label}</h2><p>在左侧打开对象，查看它的内容、联系与可整理项。</p>{view !== "derivations" && <button type="button" className="admin-button-primary" onClick={() => openCreate()}>新建 {activeView.label}</button>}</div>}
          </section>
        </section>
      </main>

      {creating && (
        <div className="saba-note-manage-dialog-backdrop" role="presentation">
          <form
            className="saba-note-manage-dialog saba-note-manage-create-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="saba-note-create-title"
            onSubmit={createEntity}
          >
            <p className="saba-note-manage-dialog-kicker">建立新的知识对象</p>
            <h2 id="saba-note-create-title">新建 {activeView.label}</h2>
            <p className="saba-note-manage-dialog-description">结构可以稍后继续补充，不必一次整理完整。</p>
            {view === "relations" ? (
              <>
                <label><span>Source Node</span><SearchablePicker value={relationSourceId} onChange={setRelationSourceId} options={data.nodes.map((node) => ({ value: node.id, label: node.title }))} placeholder="选择起点" searchPlaceholder="搜索 Node" /></label>
                <label><span>关系类型</span><input className="admin-input" value={createName} onChange={(e) => setCreateName(e.target.value)} placeholder="例如：依赖、解释、应用于" required /></label>
                <label><span>Target Node</span><SearchablePicker value={relationTargetId} onChange={setRelationTargetId} options={data.nodes.filter((node) => node.id !== relationSourceId).map((node) => ({ value: node.id, label: node.title }))} placeholder="选择终点" searchPlaceholder="搜索 Node" /></label>
                <label><span>补充说明</span><textarea className="admin-textarea" value={relationNote} onChange={(e) => setRelationNote(e.target.value)} /></label>
              </>
            ) : (
              <>
                <label><span>{view === "nodes" ? "Node 标题" : view === "categories" ? "Category 名称" : "Tag 名称"}</span><input autoFocus className="admin-input" value={createName} onChange={(e) => setCreateName(e.target.value)} required /></label>
                {view === "nodes" && <><label><span>概念说明（可选）</span><textarea className="admin-textarea" value={createSummary} onChange={(e) => setCreateSummary(e.target.value)} /></label><label><span>Category（可选）</span><SearchablePicker value={createCategoryId} onChange={setCreateCategoryId} options={data.categories.map((category) => ({ value: category.id, label: category.name }))} placeholder="保持未分类" searchPlaceholder="搜索 Category" /></label></>}
                {view === "categories" && <label><span>父级</span><SearchablePicker value={createParentId} onChange={setCreateParentId} options={data.categories.map((category) => ({ value: category.id, label: category.name }))} placeholder="创建根 Category" searchPlaceholder="搜索 Category" /></label>}
              </>
            )}
            {operationError && <p className="saba-note-manage-operation-error" role="alert">{operationError}</p>}
            <div className="saba-note-manage-dialog-actions"><button type="button" className="admin-button-secondary" disabled={createPending} onClick={closeCreate}>取消</button><button type="submit" className="admin-button-primary" disabled={createPending || (view === "relations" && (!relationSourceId || !relationTargetId || relationSourceId === relationTargetId))}>{createPending ? "创建中…" : `创建 ${activeView.label}`}</button></div>
          </form>
        </div>
      )}
    </SabaNoteShell>
  );
}

function DerivationListItem({ item, active, onClick }: { item: DerivationView; active: boolean; onClick: () => void }) {
  const presentation = DERIVATION_STATUS_PRESENTATION[item.derivation.status];
  return (
    <button type="button" className={active ? "active" : ""} onClick={onClick}>
      <span className="saba-note-manage-entity-icon">▤</span>
      <span>
        <strong>{getDerivationDisplayTitle(item.derivation.title)}</strong>
        <small>{item.node?.title ?? "未归档"} · {item.category?.name ?? "未分类"} · {presentation?.label ?? item.derivation.status}</small>
        <p>{item.excerpt || "暂无正文摘要"}</p>
        <span className="saba-note-manage-list-meta">
          <time>{MANAGE_DATE_FORMATTER.format(new Date(item.derivation.updatedAt))}</time>
          {item.tags.slice(0, 3).map((tag) => <em key={tag.id}>#{tag.name}</em>)}
          {item.tags.length > 3 && <em>+{item.tags.length - 3}</em>}
        </span>
      </span>
    </button>
  );
}
