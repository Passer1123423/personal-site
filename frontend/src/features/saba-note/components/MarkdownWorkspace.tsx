import { useCallback, useRef, useState } from "react";

import type { DerivationView, MobileWorkspacePanel } from "../types";
import DerivationReferencePicker from "./DerivationReferencePicker";
import SabaMarkdownContent from "./SabaMarkdownContent";

type MarkdownWorkspaceProps = {
  value: string;
  onChange: (value: string) => void;
  mobilePanel: MobileWorkspacePanel;
  referenceCandidates: DerivationView[];
  referencesLoading?: boolean;
  referencesError?: string | null;
};

export default function MarkdownWorkspace({
  value,
  onChange,
  mobilePanel,
  referenceCandidates,
  referencesLoading = false,
  referencesError = null,
}: MarkdownWorkspaceProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const selectionRef = useRef({ start: value.length, end: value.length });
  const [referencePickerOpen, setReferencePickerOpen] = useState(false);

  const rememberSelection = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    selectionRef.current = {
      start: textarea.selectionStart,
      end: textarea.selectionEnd,
    };
  }, []);

  const closeReferencePicker = useCallback(() => {
    setReferencePickerOpen(false);
  }, []);

  function insertReference(reference: string) {
    const start = Math.min(selectionRef.current.start, value.length);
    const end = Math.min(selectionRef.current.end, value.length);
    const nextValue = `${value.slice(0, start)}${reference}${value.slice(end)}`;
    const nextCursor = start + reference.length;

    onChange(nextValue);
    setReferencePickerOpen(false);
    selectionRef.current = { start: nextCursor, end: nextCursor };

    window.setTimeout(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(nextCursor, nextCursor);
    }, 0);
  }

  return (
    <section
      className={`saba-note-editor-grid saba-note-mobile-panel-${mobilePanel}`}
    >
      <div className="saba-note-editor-pane">
        <div className="saba-note-pane-heading saba-note-markdown-toolbar">
          <span>Markdown 输入</span>
          <div className="saba-note-markdown-toolbar-actions">
            <button
              type="button"
              className="saba-note-reference-trigger"
              title="插入 Derivation 引用"
              aria-label="插入 Derivation 引用"
              aria-expanded={referencePickerOpen}
              onMouseDown={(event) => {
                event.stopPropagation();
                rememberSelection();
              }}
              onClick={() => setReferencePickerOpen((open) => !open)}
            >
              +
            </button>
            <span className="saba-note-pane-kicker">MD</span>
          </div>
          {referencePickerOpen && (
            <DerivationReferencePicker
              open
              derivations={referenceCandidates}
              loading={referencesLoading}
              error={referencesError}
              onClose={closeReferencePicker}
              onInsert={insertReference}
            />
          )}
        </div>

        <textarea
          ref={textareaRef}
          className="admin-textarea saba-note-markdown-input"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onSelect={rememberSelection}
          onClick={rememberSelection}
          onKeyUp={rememberSelection}
          onBlur={rememberSelection}
          placeholder="从这里开始写下推导过程…"
          spellCheck={false}
        />
      </div>

      <div className="saba-note-preview-pane">
        <div className="saba-note-pane-heading">
          <span>实时预览</span>
          <span className="saba-note-pane-kicker">预览</span>
        </div>

        <div className="saba-note-preview-scroll">
          <SabaMarkdownContent derivations={referenceCandidates}>
            {value}
          </SabaMarkdownContent>
        </div>
      </div>
    </section>
  );
}
