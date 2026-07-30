import type { MobileWorkspacePanel } from "../types";
import SabaMarkdownContent from "./SabaMarkdownContent";

type MarkdownWorkspaceProps = {
  value: string;
  onChange: (value: string) => void;
  mobilePanel: MobileWorkspacePanel;
};

export default function MarkdownWorkspace({
  value,
  onChange,
  mobilePanel,
}: MarkdownWorkspaceProps) {
  return (
    <section
      className={`saba-note-editor-grid saba-note-mobile-panel-${mobilePanel}`}
    >
      <div className="saba-note-editor-pane">
        <div className="saba-note-pane-heading">
          <span>Markdown 输入</span>
          <span className="saba-note-pane-kicker">MD</span>
        </div>

        <textarea
          className="admin-textarea saba-note-markdown-input"
          value={value}
          onChange={(event) => onChange(event.target.value)}
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
          <SabaMarkdownContent>{value}</SabaMarkdownContent>
        </div>
      </div>
    </section>
  );
}
