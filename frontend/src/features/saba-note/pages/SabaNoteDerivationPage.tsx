import { Link, useParams } from "react-router-dom";

import DerivationCard from "../components/DerivationCard";
import DerivationMeta from "../components/DerivationMeta";
import SabaMarkdownContent from "../components/SabaMarkdownContent";
import SabaNoteAsyncState from "../components/SabaNoteAsyncState";
import SabaNoteShell from "../components/SabaNoteShell";
import {
  getCategory,
  getNode,
  getTags,
  sabaNoteDerivations,
} from "../data/mockData";
import { extractMarkdownHeadings } from "../utils/markdown";

const DATE_FORMATTER = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "long",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export default function SabaNoteDerivationPage() {
  const { id } = useParams<{ id: string }>();
  const derivation =
    sabaNoteDerivations.find((item) => item.id === id) ?? null;

  if (!derivation) {
    return (
      <SabaNoteShell>
        <div className="py-16">
          <SabaNoteAsyncState
            kind="error"
            title="没有找到这条推导"
            description="它可能还没有加入第一阶段的演示内容。"
            action={
              <Link
                to="/saba-note"
                className="admin-button-secondary inline-block px-4 py-2 text-sm font-semibold"
              >
                返回内容流
              </Link>
            }
          />
        </div>
      </SabaNoteShell>
    );
  }

  const category = getCategory(derivation.categoryId);
  const node = getNode(derivation.nodeId);
  const tags = getTags(derivation.tagIds);
  const related = sabaNoteDerivations
    .filter(
      (item) =>
        item.id !== derivation.id &&
        (item.nodeId === derivation.nodeId ||
          item.categoryId === derivation.categoryId),
    )
    .slice(0, 2);
  const headings = extractMarkdownHeadings(derivation.contentMd);

  return (
    <SabaNoteShell
      actions={
        <Link
          to={`/saba-note/workspace?id=${encodeURIComponent(derivation.id)}`}
          className="saba-note-reader-action"
        >
          继续推导
        </Link>
      }
    >
      <main className="saba-note-reading-page">
        <Link to="/saba-note" className="saba-note-back-link">
          ← 最近推导
        </Link>

        <div className="surface-card saba-note-reader-frame">
          <header className="saba-note-article-header">
            <p className="saba-note-eyebrow">Derivation</p>
            <h1>{derivation.title}</h1>
            <p className="saba-note-article-summary">{derivation.summary}</p>
            <time dateTime={derivation.updatedAt}>
              📅 更新于 {DATE_FORMATTER.format(new Date(derivation.updatedAt))}
            </time>

            <DerivationMeta
              status={derivation.status}
              category={category}
              node={node}
              tags={tags}
            />
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
                  <strong>{node?.title ?? "未归档 Node"}</strong>
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
        </div>

        {related.length > 0 ? (
          <div className="saba-note-related-grid">
            {related.map((item) => (
              <DerivationCard key={item.id} derivation={item} compact />
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
