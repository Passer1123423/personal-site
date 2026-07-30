import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";

import SearchBox from "../../../components/SearchBox";
import SearchablePicker from "../../../components/SearchablePicker";
import DerivationCard from "../components/DerivationCard";
import SabaNoteAsyncState from "../components/SabaNoteAsyncState";
import SabaNoteShell from "../components/SabaNoteShell";
import {
  getNode,
  getTags,
  sabaNoteCategories,
  sabaNoteDerivations,
  sabaNoteTags,
} from "../data/mockData";

export default function SabaNoteOverviewPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get("q") ?? "";
  const categoryId = searchParams.get("category") ?? "";
  const tagId = searchParams.get("tag") ?? "";

  const derivations = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return sabaNoteDerivations.filter((derivation) => {
      if (categoryId && derivation.categoryId !== categoryId) {
        return false;
      }
      if (tagId && !derivation.tagIds.includes(tagId)) {
        return false;
      }
      if (!normalizedQuery) {
        return true;
      }

      const node = getNode(derivation.nodeId);
      const tags = getTags(derivation.tagIds);
      const searchableText = [
        derivation.title,
        derivation.summary,
        derivation.contentMd,
        node?.title,
        ...tags.map((tag) => tag.name),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchableText.includes(normalizedQuery);
    });
  }, [categoryId, query, tagId]);

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

  return (
    <SabaNoteShell
      actions={
        <Link
          to="/saba-note/workspace"
          className="admin-button-primary px-3 py-2 text-sm font-semibold"
        >
          写一条推导
        </Link>
      }
    >
      <section className="saba-note-overview-hero">
        <p className="saba-note-eyebrow">最近的理解</p>
        <h1>我最近理解了什么</h1>
        <p>
          这里保留结论，也保留结论形成之前的犹豫、证据与修正。
        </p>

      </section>

      <section className="saba-note-filter-bar" aria-label="知识内容筛选">
        <div className="saba-note-filter-control saba-note-search-control">
          <span>Search</span>
          <SearchBox
            value={query}
            onChange={(value) => updateFilter("q", value)}
            placeholder="搜索标题、摘要、正文或 Tag"
            className="saba-note-overview-search"
          />
        </div>

        <div className="saba-note-filter-control">
          <span>Category</span>
          <SearchablePicker
            value={categoryId}
            onChange={(value) => updateFilter("category", value)}
            options={sabaNoteCategories.map((category) => ({
              value: category.id,
              label: category.name,
            }))}
            placeholder="全部分类"
            searchPlaceholder="搜索 Category"
          />
        </div>

        <div className="saba-note-filter-control">
          <span>Tag</span>
          <SearchablePicker
            value={tagId}
            onChange={(value) => updateFilter("tag", value)}
            options={sabaNoteTags.map((tag) => ({
              value: tag.id,
              label: `#${tag.name}`,
            }))}
            placeholder="全部 Tag"
            searchPlaceholder="搜索 Tag"
          />
        </div>

        <div className="saba-note-flow-count">
          <strong>{derivations.length}</strong>
          <span>条推导</span>
        </div>
      </section>

      <section className="saba-note-content-flow">
        {derivations.length > 0 ? (
          derivations.map((derivation) => (
            <DerivationCard key={derivation.id} derivation={derivation} />
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
    </SabaNoteShell>
  );
}
