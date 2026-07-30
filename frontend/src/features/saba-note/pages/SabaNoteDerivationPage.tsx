import {
  Link,
  useNavigate,
  useParams,
} from "react-router-dom";

import { formatChinaDateTimeToMinute } from "../../../utils/time";
import DerivationActionMenu from "../components/DerivationActionMenu";
import DerivationCard from "../components/DerivationCard";
import DerivationMeta from "../components/DerivationMeta";
import SabaMarkdownContent from "../components/SabaMarkdownContent";
import SabaNoteAsyncState from "../components/SabaNoteAsyncState";
import SabaNoteShell from "../components/SabaNoteShell";
import useDerivationActions from "../hooks/useDerivationActions";
import useDerivationBacklinks from "../hooks/useDerivationBacklinks";
import useDerivationDetail from "../hooks/useDerivationDetail";
import useDerivationList from "../hooks/useDerivationList";
import { getDerivationDisplayTitle } from "../utils/derivation";
import { extractMarkdownHeadings } from "../utils/markdown";

export default function SabaNoteDerivationPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { data: item, loading, error } = useDerivationDetail(id);
  const { data: allItems } = useDerivationList();
  const { data: backlinks, error: backlinksError } =
    useDerivationBacklinks(id);
  const {
    discard,
    pendingId,
    error: actionError,
  } = useDerivationActions();

  if (loading || error || !item) {
    return (
      <SabaNoteShell uncontained>
        <main className="page-shell min-h-[100dvh] pb-14">
          <section className="mx-auto max-w-[1250px] px-0 py-6 md:px-8 md:py-8">
            <div className="px-4 md:px-0">
              <Link to="/saba-note" className="font-semibold link-accent">
                ← 最近推导
              </Link>
            </div>
            <div className="mt-4 border-y border-[var(--color-border-soft)] px-6 py-8 md:rounded-[var(--radius-card)] md:border md:bg-[var(--color-panel-bg)] md:shadow-[var(--shadow-card)]">
              <SabaNoteAsyncState
                kind={loading ? "loading" : "error"}
                title={loading ? "正在打开推导" : "没有找到这条推导"}
                description={error ?? undefined}
                action={
                  !loading ? (
                    <Link
                      to="/saba-note"
                      className="admin-button-secondary inline-block px-4 py-2 text-sm font-semibold"
                    >
                      返回内容流
                    </Link>
                  ) : null
                }
              />
            </div>
          </section>
        </main>
      </SabaNoteShell>
    );
  }

  const { derivation, category, node, tags } = item;
  const related = allItems
    .filter(
      (candidate) =>
        candidate.derivation.id !== derivation.id &&
        ((node !== null && candidate.node?.id === node.id) ||
          (category !== null &&
            candidate.category?.id === category.id)),
    )
    .slice(0, 2);
  const headings = extractMarkdownHeadings(derivation.contentMd);

  async function handleDiscard() {
    try {
      await discard(derivation.id);
      navigate("/saba-note/trash");
    } catch {
      // 错误状态由 useDerivationActions 暴露给界面。
    }
  }

  return (
    <SabaNoteShell uncontained>
      <main className="page-shell min-h-[100dvh] pb-14">
        <section className="mx-auto max-w-[1250px] px-0 py-6 md:px-8 md:py-8">
        <div className="mb-4 flex flex-wrap items-center gap-3 px-4 text-sm md:px-0">
          <Link to="/saba-note" className="font-semibold link-accent">
            ← 最近推导
          </Link>
          <span className="text-soft">/</span>
          <span className="max-w-[65vw] truncate font-semibold text-soft">
            {getDerivationDisplayTitle(derivation.title)}
          </span>
        </div>

        <div className="novel-reader-frame relative z-10 border-y border-[var(--color-border-soft)] md:rounded-[var(--radius-card)] md:border md:bg-[var(--color-panel-bg)] md:shadow-[var(--shadow-card)]">
          <header className="novel-reader-header">
            <div className="flex items-start justify-between gap-4">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] link-accent">
                Saba-Note
              </p>
              <DerivationActionMenu
                derivationId={derivation.id}
                onDiscard={() => void handleDiscard()}
                pending={pendingId === derivation.id}
              />
            </div>

            <h1 className="mt-3 text-3xl font-bold leading-tight text-main md:text-4xl">
              {getDerivationDisplayTitle(derivation.title)}
            </h1>

            <p className="mt-4 text-sm text-soft">
              更新于 {formatChinaDateTimeToMinute(derivation.updatedAt)}
            </p>

            <div className="saba-note-reader-meta">
              <DerivationMeta
                status={derivation.status}
                category={category}
                node={node}
                tags={tags}
              />
            </div>

            {actionError && (
              <p className="saba-note-inline-error" role="alert">
                {actionError}
              </p>
            )}
          </header>

          <div className="novel-reader-body">
            <article className="novel-reader-content">
              <SabaMarkdownContent
                readingStyle="novel"
                className="novel-reader-markdown"
              >
                {derivation.contentMd}
              </SabaMarkdownContent>
            </article>

            <aside className="novel-reader-sidebar">
              <div className="novel-reader-toc">
                <p className="novel-reader-toc-title text-sm font-semibold text-main">
                  目录
                </p>

                <div className="novel-reader-toc-list mt-4 space-y-2">
                  {headings.length > 0 ? (
                    headings.map((heading) => (
                      <a
                        key={`${heading.id}-${heading.level}`}
                        href={`#${heading.id}`}
                        className={[
                          "novel-toc-link",
                          heading.level === 3
                            ? "saba-note-reader-heading-child"
                            : "",
                        ].join(" ")}
                      >
                        {heading.text}
                      </a>
                    ))
                  ) : (
                    <p>正文暂时没有小节标题。</p>
                  )}
                </div>

                <div className="novel-reader-toc-footer">
                  <p className="text-xs text-soft">归档于</p>
                  <p className="mt-1 truncate text-sm font-semibold text-main">
                    {node?.title ?? "未归档"}
                  </p>
                  <p className="mt-3 text-xs text-soft">
                    {backlinksError
                      ? "反向链接暂时无法读取"
                      : `${backlinks.length} 条反向链接`}
                  </p>
                </div>
              </div>
            </aside>
          </div>

        </div>

          <section className="saba-note-reader-related">
            <div className="saba-note-reader-related-heading">
              <div>
                <p className="saba-note-eyebrow">Related knowledge</p>
                <h2>相关推导</h2>
                <p>
                  来自相同 Node 或 Category 的延伸理解，不表示固定阅读顺序。
                </p>
              </div>
              <Link to="/saba-note" className="font-semibold link-accent">
                返回内容流
              </Link>
            </div>

            {related.length > 0 ? (
              <div className="saba-note-related-grid">
                {related.map((relatedItem) => (
                  <DerivationCard
                    key={relatedItem.derivation.id}
                    item={relatedItem}
                    compact
                  />
                ))}
              </div>
            ) : (
              <div className="saba-note-reader-related-empty">
                <p>
                  暂时没有同一 Node 或 Category 下的其他推导；这条理解目前保持独立。
                </p>
              </div>
            )}
          </section>
        </section>
      </main>
    </SabaNoteShell>
  );
}
