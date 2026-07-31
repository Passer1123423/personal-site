import { useEffect } from "react";

type KnowledgeDeleteDialogProps = {
  open: boolean;
  title: string;
  description: string;
  removeItems: string[];
  preserveItems?: string[];
  confirmLabel: string;
  footerNote?: string;
  pending?: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function KnowledgeDeleteDialog({
  open,
  title,
  description,
  removeItems,
  preserveItems = [],
  confirmLabel,
  footerNote = "此操作不进入回收站，无法恢复。",
  pending = false,
  error,
  onCancel,
  onConfirm,
}: KnowledgeDeleteDialogProps) {
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !pending) onCancel();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCancel, open, pending]);

  if (!open) return null;

  return (
    <div className="saba-note-manage-dialog-backdrop" role="presentation">
      <section
        className="saba-note-manage-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="saba-note-delete-title"
      >
        <span className="saba-note-manage-dialog-mark" aria-hidden="true">
          !
        </span>
        <p className="saba-note-manage-dialog-kicker">危险操作</p>
        <h2 id="saba-note-delete-title">{title}</h2>
        <p className="saba-note-manage-dialog-description">{description}</p>

        <div className="saba-note-manage-impact-grid">
          <div>
            <strong>将发生</strong>
            <ul>
              {removeItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          {preserveItems.length > 0 && (
            <div className="saba-note-manage-impact-preserve">
              <strong>仍会保留</strong>
              <ul>
                {preserveItems.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <p className="saba-note-manage-irrevocable">{footerNote}</p>
        {error && (
          <p className="saba-note-manage-operation-error" role="alert">
            {error}
          </p>
        )}
        <div className="saba-note-manage-dialog-actions">
          <button
            type="button"
            className="admin-button-secondary"
            disabled={pending}
            onClick={onCancel}
          >
            取消
          </button>
          <button
            type="button"
            className="admin-button-danger"
            disabled={pending}
            onClick={onConfirm}
          >
            {pending ? "处理中…" : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
