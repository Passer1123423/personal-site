import { useEffect, useMemo, useRef, useState } from "react";

import { formatChinaDateTimeToMinute } from "../../../utils/time";
import { DERIVATION_STATUS_PRESENTATION } from "../data/statuses";
import type { DerivationView } from "../types";
import { getDerivationDisplayTitle } from "../utils/derivation";
import { makeDerivationReference } from "../utils/markdown";

type DerivationReferencePickerProps = {
  open: boolean;
  derivations: DerivationView[];
  loading?: boolean;
  error?: string | null;
  onClose: () => void;
  onInsert: (reference: string) => void;
};

export default function DerivationReferencePicker({
  open,
  derivations,
  loading = false,
  error = null,
  onClose,
  onInsert,
}: DerivationReferencePickerProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const [keyword, setKeyword] = useState("");
  const [copyMessage, setCopyMessage] = useState("");

  const filtered = useMemo(() => {
    const query = keyword.trim().toLowerCase();
    if (!query) return derivations;

    return derivations.filter((item) => {
      const status = DERIVATION_STATUS_PRESENTATION[item.derivation.status];
      return [
        item.derivation.title,
        item.derivation.id,
        item.node?.title,
        status?.label,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [derivations, keyword]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => searchRef.current?.focus(), 0);

    function handlePointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  async function copyReference(item: DerivationView) {
    const reference = makeDerivationReference(
      item.derivation.id,
      getDerivationDisplayTitle(item.derivation.title),
    );
    try {
      await navigator.clipboard.writeText(reference);
      setCopyMessage("引用文本已复制");
    } catch {
      setCopyMessage("复制失败，请手动复制");
    }
  }

  if (!open) return null;

  return (
    <div ref={rootRef} className="saba-note-reference-picker">
      <div className="saba-note-reference-picker-heading">
        <div>
          <strong>插入 Derivation 引用</strong>
          <span>选择后插入当前光标位置</span>
        </div>
        <button type="button" onClick={onClose} aria-label="关闭引用选择器">
          ×
        </button>
      </div>

      <div className="saba-note-reference-search">
        <input
          ref={searchRef}
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder="搜索标题、Node、状态或 ID"
        />
      </div>

      {copyMessage && (
        <p className="saba-note-reference-message" role="status">
          {copyMessage}
        </p>
      )}

      <div className="saba-note-reference-options">
        {loading ? (
          <p>正在加载 Derivation…</p>
        ) : error ? (
          <p>{error}</p>
        ) : filtered.length === 0 ? (
          <p>没有匹配的 Derivation。</p>
        ) : (
          filtered.map((item) => {
            const title = getDerivationDisplayTitle(item.derivation.title);
            const status = DERIVATION_STATUS_PRESENTATION[item.derivation.status];
            const reference = makeDerivationReference(item.derivation.id, title);

            return (
              <article key={item.derivation.id}>
                <button
                  type="button"
                  className="saba-note-reference-insert"
                  onClick={() => onInsert(reference)}
                >
                  <strong>{title}</strong>
                  <span>
                    {status?.label ?? item.derivation.status} · {item.node?.title ?? "未归档"}
                  </span>
                  <time>
                    更新于 {formatChinaDateTimeToMinute(item.derivation.updatedAt)}
                  </time>
                </button>
                <button
                  type="button"
                  className="saba-note-reference-copy"
                  onClick={() => void copyReference(item)}
                >
                  复制
                </button>
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}
