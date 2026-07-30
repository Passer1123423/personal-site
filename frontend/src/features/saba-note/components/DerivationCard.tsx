import { Link } from "react-router-dom";

import { getCategory, getNode, getTags } from "../data/mockData";
import type { SabaNoteDerivation } from "../types";
import DerivationMeta from "./DerivationMeta";

const DATE_FORMATTER = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

export default function DerivationCard({
  derivation,
  compact = false,
}: {
  derivation: SabaNoteDerivation;
  compact?: boolean;
}) {
  const category = getCategory(derivation.categoryId);
  const node = getNode(derivation.nodeId);
  const tags = getTags(derivation.tagIds);

  return (
    <article
      className={[
        "surface-card surface-card-link saba-note-derivation-card",
        compact ? "saba-note-derivation-card-compact" : "",
      ].join(" ")}
    >
      <DerivationMeta
        status={derivation.status}
        category={category}
        node={node}
        tags={tags}
        compact={compact}
      />

      <Link
        to={`/saba-note/derivation/${derivation.id}`}
        className="saba-note-card-title"
      >
        {derivation.title}
      </Link>

      <p className="saba-note-card-summary">{derivation.summary}</p>

      <div className="saba-note-card-footer">
        <time
          dateTime={derivation.updatedAt}
          className="saba-note-date-stamp"
        >
          <span aria-hidden="true">📅</span>
          {DATE_FORMATTER.format(new Date(derivation.updatedAt))}
        </time>
        {!compact && (
          <Link
            to={`/saba-note/workspace?id=${encodeURIComponent(derivation.id)}`}
            className="link-accent font-medium"
          >
            继续推导
          </Link>
        )}
      </div>
    </article>
  );
}
