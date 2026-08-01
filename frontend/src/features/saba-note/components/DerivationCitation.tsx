import { useId } from "react";
import { Link } from "react-router-dom";

import { DERIVATION_STATUS_PRESENTATION } from "../data/statuses";
import type { DerivationView } from "../types";
import { getDerivationDisplayTitle } from "../utils/derivation";

export default function DerivationCitation({
  derivationId,
  label,
  target,
}: {
  derivationId: string;
  label: string;
  target?: DerivationView;
}) {
  const tooltipId = useId();
  const status = target
    ? DERIVATION_STATUS_PRESENTATION[target.derivation.status]
    : null;

  return (
    <span className="saba-note-citation-wrap">
      <Link
        to={`/saba-note/derivation/${encodeURIComponent(derivationId)}`}
        className="saba-note-citation"
        aria-describedby={tooltipId}
      >
        [{label}]
      </Link>
      <span
        id={tooltipId}
        className="saba-note-citation-card"
        role="tooltip"
      >
        <strong>
          {target
            ? getDerivationDisplayTitle(target.derivation.title)
            : "Derivation 引用"}
        </strong>
        <span>{status?.label ?? "目标信息暂不可用"}</span>
        {target && <span>Node · {target.node?.title ?? "未归档"}</span>}
      </span>
    </span>
  );
}
