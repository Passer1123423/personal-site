import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { SABA_NOTE_ANNOUNCEMENT } from "../data/announcement";

export default function SabaNoteBulletin() {
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const titleId = useId();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const appRoot = document.getElementById("root");
    const rootWasInert = appRoot?.inert ?? false;
    const trigger = triggerRef.current;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    if (appRoot) appRoot.inert = true;
    closeButtonRef.current?.focus();

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
      if (appRoot) appRoot.inert = rootWasInert;
      window.removeEventListener("keydown", closeOnEscape);
      trigger?.focus();
    };
  }, [open]);

  return (
    <div className="saba-note-bulletin">
      <button
        ref={triggerRef}
        type="button"
        className="saba-note-bulletin-trigger"
        aria-label="打开 Saba-Note 布告板"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span aria-hidden="true">▤</span>
      </button>

      {open &&
        createPortal(
          <div
            className="saba-note-bulletin-backdrop"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setOpen(false);
            }}
          >
            <section
              className="saba-note-bulletin-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
            >
              <div className="saba-note-bulletin-heading">
                <div>
                  <span>Website announcement</span>
                  <h2 id={titleId}>{SABA_NOTE_ANNOUNCEMENT.title}</h2>
                </div>
                <button
                  ref={closeButtonRef}
                  type="button"
                  aria-label="关闭布告板"
                  onClick={() => setOpen(false)}
                >
                  ×
                </button>
              </div>
              <div className="saba-note-bulletin-content">
                <p>{SABA_NOTE_ANNOUNCEMENT.content}</p>
              </div>
            </section>
          </div>,
          document.body,
        )}
    </div>
  );
}
