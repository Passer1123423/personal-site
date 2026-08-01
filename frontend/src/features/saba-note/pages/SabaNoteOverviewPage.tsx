import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";

import SearchBox from "../../../components/SearchBox";
import SearchablePicker from "../../../components/SearchablePicker";
import DerivationCard from "../components/DerivationCard";
import SabaNoteAsyncState from "../components/SabaNoteAsyncState";
import SabaNoteShell from "../components/SabaNoteShell";
import useDerivationActions from "../hooks/useDerivationActions";
import useDerivationList from "../hooks/useDerivationList";

export default function SabaNoteOverviewPage() {
  const { data, loading, error, reload } = useDerivationList();
  const {
    discard,
    pendingId,
    error: actionError,
  } = useDerivationActions();
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get("q") ?? "";
  const categoryId = searchParams.get("category") ?? "";
  const tagId = searchParams.get("tag") ?? "";

  const derivations = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return data.filter((item) => {
      const { derivation, node, category, tags, excerpt } = item;

      if (categoryId && category?.id !== categoryId) {
        return false;
      }
      if (tagId && !tags.some((tag) => tag.id === tagId)) {
        return false;
      }
      if (!normalizedQuery) {
        return true;
      }

      const searchableText = [
        derivation.title,
        excerpt,
        derivation.contentMd,
        node?.title,
        ...tags.map((tag) => tag.name),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchableText.includes(normalizedQuery);
    });
  }, [categoryId, data, query, tagId]);

  const categoryOptions = useMemo(
    () =>
      Array.from(
        new Map(
          data
            .map((item) => item.category)
            .filter((item) => item !== null)
            .map((item) => [item.id, item]),
        ).values(),
      ),
    [data],
  );

  const tagOptions = useMemo(
    () =>
      Array.from(
        new Map(
          data.flatMap((item) => item.tags).map((item) => [item.id, item]),
        ).values(),
      ),
    [data],
  );

  function updateFilter(key: string, value: string) {
    const next = new URLSearchParams(searchParams);
    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    setSearchParams(next, { replace: true });
  }

  function clearFilters() {
    setSearchParams({}, { replace: true });
  }

  const hasFilters = Boolean(query || categoryId || tagId);

  async function handleDiscard(id: string) {
    try {
      await discard(id);
      reload();
    } catch {
      // 错误状态由 useDerivationActions 暴露给界面。
    }
  }

  return (
    <SabaNoteShell
      uncontained
      actions={
        <Link
          to="/saba-note/workspace"
          className="admin-button-primary px-3 py-2 text-sm font-semibold"
        >
          写一条想法/推导
        </Link>
      }
    >
      <main className="saba-note-overview-page">
        <section className="saba-note-overview-hero">
          <div>
            <h1>随便写点啥</h1>
            <p>
              积累你的私人知识库，可供未来展望与炫耀。
            </p>
          </div>
          <Link
            to="/saba-note/manage"
            className="admin-button-secondary"
          >
            管理
          </Link>
        </section>

        <section className="saba-note-filter-bar" aria-label="知识内容筛选">
          <div className="saba-note-filter-control saba-note-search-control">
            <SearchBox
              value={query}
              onChange={(value) => updateFilter("q", value)}
              placeholder="搜索标题、正文或 Tag"
              className="saba-note-overview-search"
            />
          </div>

          <div className="saba-note-filter-control">
            <SearchablePicker
              value={categoryId}
              onChange={(value) => updateFilter("category", value)}
              options={categoryOptions.map((category) => ({
                value: category.id,
                label: category.name,
              }))}
              placeholder="全部分类"
              searchPlaceholder="搜索 Category"
            />
          </div>

          <div className="saba-note-filter-control">
            <SearchablePicker
              value={tagId}
              onChange={(value) => updateFilter("tag", value)}
              options={tagOptions.map((tag) => ({
                value: tag.id,
                label: `#${tag.name}`,
              }))}
              placeholder="全部 Tag"
              searchPlaceholder="搜索 Tag"
            />
          </div>

          <button
            type="button"
            className="saba-note-filter-clear"
            disabled={!hasFilters}
            onClick={clearFilters}
          >
            清除
          </button>

          <div className="saba-note-flow-count">
            <strong>{derivations.length}</strong>
            <span>条推导</span>
          </div>
        </section>

        <section className="saba-note-content-flow">
          {actionError && (
            <p className="saba-note-inline-error" role="alert">
              {actionError}
            </p>
          )}
          {loading ? (
            <SabaNoteAsyncState
              kind="loading"
              title="正在整理最近推导"
            />
          ) : error ? (
            <SabaNoteAsyncState
              kind="error"
              title="内容流加载失败"
              description={error}
            />
          ) : derivations.length > 0 ? (
            derivations.map((item) => (
              <DerivationCard
                key={item.derivation.id}
                item={item}
                onDiscard={() =>
                  void handleDiscard(item.derivation.id)
                }
                discardPending={pendingId === item.derivation.id}
              />
            ))
          ) : (
            <SabaNoteAsyncState
              title="没有找到匹配的推导"
              description="换一个关键词，或者清除当前的 Category 与 Tag 条件。"
              action={
                hasFilters ? (
                  <button
                    type="button"
                    className="admin-button-secondary px-4 py-2 text-sm font-semibold"
                    onClick={clearFilters}
                  >
                    清除筛选
                  </button>
                ) : null
              }
            />
          )}
        </section>
      </main>
    </SabaNoteShell>
  );
}
