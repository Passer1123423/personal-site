import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

type DerivationActionMenuProps = {
  derivationId: string;
  onDiscard?: () => void;
  pending?: boolean;
  align?: "left" | "right";
};

export default function DerivationActionMenu({
  derivationId,
  onDiscard,
  pending = false,
  align = "right",
}: DerivationActionMenuProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    window.addEventListener("mousedown", closeOnOutsideClick);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("mousedown", closeOnOutsideClick);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  return (
    <div ref={rootRef} className="saba-note-action-menu">
      <button
        type="button"
        className="saba-note-action-trigger"
        aria-label="Derivation 操作"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        ···
      </button>

      {open && (
        <div
          className={`saba-note-action-popover saba-note-action-popover-${align}`}
        >
          <Link
            to={`/saba-note/workspace?id=${encodeURIComponent(derivationId)}`}
            onClick={() => setOpen(false)}
          >
            编辑
          </Link>
          <button
            type="button"
            disabled={!onDiscard || pending}
            title={onDiscard ? "移入回收站" : undefined}
            onClick={() => {
              onDiscard?.();
              setOpen(false);
            }}
          >
            {pending ? "处理中…" : "移入回收站"}
          </button>
        </div>
      )}
    </div>
  );
}
