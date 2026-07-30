import { Link } from "react-router-dom";

import type { DerivationView } from "../types";
import { getDerivationDisplayTitle } from "../utils/derivation";
import DerivationActionMenu from "./DerivationActionMenu";
import DerivationMeta from "./DerivationMeta";

const DATE_FORMATTER = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

export default function DerivationCard({
  item,
  compact = false,
  onDiscard,
  discardPending = false,
}: {
  item: DerivationView;
  compact?: boolean;
  onDiscard?: () => void;
  discardPending?: boolean;
}) {
  const { derivation, category, node, tags, excerpt } = item;

  return (
    <article
      className={[
        "surface-card surface-card-link saba-note-derivation-card",
        compact ? "saba-note-derivation-card-compact" : "",
      ].join(" ")}
    >
      <aside className="saba-note-card-structure">
        <span>{category?.name ?? "未分类"}</span>
        <strong>{node?.title ?? "未归档"}</strong>
        <small>{node ? "知识节点" : "等待整理"}</small>
      </aside>

      <div className="saba-note-card-content">
        <div className="saba-note-card-meta-row">
          <div className="saba-note-card-metadata">
            <time
              dateTime={derivation.updatedAt}
              className="saba-note-date-stamp"
            >
              <span aria-hidden="true">📅</span>
              {DATE_FORMATTER.format(new Date(derivation.updatedAt))}
            </time>
            <DerivationMeta
              status={derivation.status}
              category={category}
              node={node}
              tags={tags}
              compact={compact}
              showCategory={false}
              showNode={false}
            />
          </div>
          {!compact && (
            <DerivationActionMenu
              derivationId={derivation.id}
              onDiscard={onDiscard}
              pending={discardPending}
            />
          )}
        </div>

        <Link
          to={`/saba-note/derivation/${derivation.id}`}
          className="saba-note-card-title"
        >
          {getDerivationDisplayTitle(derivation.title)}
        </Link>

        <p className="saba-note-card-summary">
          {excerpt || "这条推导暂时没有正文。"}
        </p>

        {!compact && (
          <div className="saba-note-card-links">
            <Link
              to={`/saba-note/derivation/${derivation.id}`}
              className="font-semibold text-main"
            >
              阅读全文
            </Link>
            <Link
              to={`/saba-note/workspace?id=${encodeURIComponent(derivation.id)}`}
              className="link-accent font-medium"
            >
              继续推导
            </Link>
          </div>
        )}
      </div>
    </article>
  );
}
