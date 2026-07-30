import type {
  Category,
  DerivationStatus,
  KnowledgeNode,
  Tag,
} from "../types";
import { DERIVATION_STATUS_PRESENTATION } from "../data/statuses";

export function DerivationStatusBadge({
  status,
}: {
  status: DerivationStatus;
}) {
  const presentation = DERIVATION_STATUS_PRESENTATION[status] ?? {
    label: status || "状态未知",
    tone: "unknown",
  };

  return (
    <span
      className={`saba-note-status saba-note-status-${presentation.tone}`}
      title={`推导状态：${presentation.label}`}
    >
      {presentation.label}
    </span>
  );
}

type DerivationMetaProps = {
  status: DerivationStatus;
  category?: Category | null;
  node?: KnowledgeNode | null;
  tags?: Tag[];
  compact?: boolean;
};

export default function DerivationMeta({
  status,
  category,
  node,
  tags = [],
  compact = false,
}: DerivationMetaProps) {
  return (
    <div
      className={[
        "saba-note-meta",
        compact ? "saba-note-meta-compact" : "",
      ].join(" ")}
    >
      <DerivationStatusBadge status={status} />

      {category && (
        <span className="saba-note-taxonomy-tag">分类 · {category.name}</span>
      )}

      {node ? (
        <span className="saba-note-node-tag">Node · {node.title}</span>
      ) : (
        <span className="saba-note-node-tag">未归档</span>
      )}

      {tags.map((tag) => (
        <span key={tag.id} className="saba-note-tag">
          #{tag.name}
        </span>
      ))}
    </div>
  );
}
