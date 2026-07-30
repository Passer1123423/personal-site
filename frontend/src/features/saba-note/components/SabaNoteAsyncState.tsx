import type { ReactNode } from "react";

type SabaNoteAsyncStateProps = {
  kind?: "loading" | "empty" | "error";
  title: string;
  description?: string;
  action?: ReactNode;
};

export default function SabaNoteAsyncState({
  kind = "empty",
  title,
  description,
  action,
}: SabaNoteAsyncStateProps) {
  return (
    <section className="surface-card saba-note-state" aria-live="polite">
      <span className={`saba-note-state-glyph saba-note-state-glyph-${kind}`}>
        {kind === "loading" ? "···" : kind === "error" ? "!" : "✦"}
      </span>
      <h2>{title}</h2>
      {description && <p>{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </section>
  );
}
