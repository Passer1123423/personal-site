import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import SabaNoteBulletin from "./SabaNoteBulletin";

type SabaNoteShellProps = {
  children: ReactNode;
  eyebrow?: string;
  actions?: ReactNode;
  wide?: boolean;
  hideHeader?: boolean;
  uncontained?: boolean;
};

export default function SabaNoteShell({
  children,
  eyebrow = "私人知识引擎",
  actions,
  wide = false,
  hideHeader = false,
  uncontained = false,
}: SabaNoteShellProps) {
  return (
    <div className="saba-note-shell">
      {!hideHeader && (
        <header className="saba-note-module-header">
          <div
            className={[
              "saba-note-container flex items-center justify-between gap-4",
              wide ? "saba-note-container-wide" : "",
            ].join(" ")}
          >
            <div className="saba-note-module-brand">
              <Link to="/saba-note" className="min-w-0">
                <span className="block text-[11px] font-semibold uppercase tracking-[0.22em] text-soft">
                  {eyebrow}
                </span>
                <span className="mt-1 block truncate text-lg font-bold text-main">
                  Saba-Note
                </span>
              </Link>
              <SabaNoteBulletin />
            </div>

            {actions && (
              <div className="flex shrink-0 items-center gap-2">{actions}</div>
            )}
          </div>
        </header>
      )}

      {uncontained ? (
        children
      ) : (
        <div
          className={[
            "saba-note-container",
            wide ? "saba-note-container-wide" : "",
          ].join(" ")}
        >
          {children}
        </div>
      )}
    </div>
  );
}
