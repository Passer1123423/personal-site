import {
  Link,
  useNavigate,
  useParams,
} from "react-router-dom";

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

const DATE_FORMATTER = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "long",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

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
      <SabaNoteShell>
        <div className="py-16">
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
    <SabaNoteShell>
      <main className="saba-note-reading-page">
        <Link to="/saba-note" className="saba-note-back-link">
          ← 最近推导
        </Link>

        <div className="surface-card saba-note-reader-frame">
          <header className="saba-note-article-header">
            <div className="saba-note-article-kicker-row">
              <p className="saba-note-eyebrow">Derivation</p>
              <DerivationActionMenu
                derivationId={derivation.id}
                onDiscard={() => void handleDiscard()}
                pending={pendingId === derivation.id}
              />
            </div>
            <h1>{getDerivationDisplayTitle(derivation.title)}</h1>
            <time dateTime={derivation.updatedAt}>
              📅 更新于 {DATE_FORMATTER.format(new Date(derivation.updatedAt))}
            </time>

            <DerivationMeta
              status={derivation.status}
              category={category}
              node={node}
              tags={tags}
            />
            {actionError && (
              <p className="saba-note-inline-error" role="alert">
                {actionError}
              </p>
            )}
          </header>

          <div className="saba-note-reader-body">
            <div className="saba-note-article-body">
              <SabaMarkdownContent className="saba-note-reader-markdown">
                {derivation.contentMd}
              </SabaMarkdownContent>
            </div>

            <aside className="saba-note-reader-sidebar">
              <div className="saba-note-reader-toc">
                <p className="saba-note-reader-toc-title">文章目录</p>
                <div className="saba-note-reader-toc-list">
                  {headings.length > 0 ? (
                    headings.map((heading) => (
                      <a
                        key={`${heading.id}-${heading.level}`}
                        href={`#${heading.id}`}
                        className={
                          heading.level === 3
                            ? "saba-note-toc-link saba-note-toc-link-child"
                            : "saba-note-toc-link"
                        }
                      >
                        {heading.text}
                      </a>
                    ))
                  ) : (
                    <p>正文暂时没有小节标题。</p>
                  )}
                </div>

                <div className="saba-note-reader-toc-footer">
                  <span>归档于</span>
                  <strong>{node?.title ?? "未归档"}</strong>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </main>

      <section className="saba-note-related-section">
        <div>
          <p className="saba-note-eyebrow">继续阅读</p>
          <h2>相关知识</h2>
          <p className="saba-note-backlinks-summary">
            {backlinksError
              ? "反向链接暂时无法读取"
              : `${backlinks.length} 条反向链接引用了这条推导`}
          </p>
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
          <p className="text-sm text-soft">
            暂时没有同一 Node 或 Category 下的其他推导。
          </p>
        )}
      </section>
    </SabaNoteShell>
  );
}
