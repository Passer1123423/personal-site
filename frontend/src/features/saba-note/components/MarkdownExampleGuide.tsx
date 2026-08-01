import { SABA_NOTE_MARKDOWN_EXAMPLES } from "../data/markdownExamples";
import SabaMarkdownContent from "./SabaMarkdownContent";

export default function MarkdownExampleGuide() {
  return (
    <div className="saba-note-example-guide">
      <header className="saba-note-example-intro">
        <p>写作参考</p>
        <h2>Markdown 与 LaTeX 示例</h2>
        <span>先查看可以复制的源码，再确认当前阅读管线的实际效果。</span>
      </header>

      {SABA_NOTE_MARKDOWN_EXAMPLES.map((section) => (
        <section key={section.id} className="saba-note-example-section">
          <div className="saba-note-example-section-heading">
            <p>{section.eyebrow}</p>
            <h3>{section.title}</h3>
            <span>{section.description}</span>
          </div>

          <div className="saba-note-example-list">
            {section.examples.map((example) => (
              <article key={example.id} className="saba-note-example-card">
                <header>
                  <h4>{example.title}</h4>
                  <p>{example.description}</p>
                </header>

                <div className="saba-note-example-source">
                  <span>源码</span>
                  <SabaMarkdownContent emptyText="">
                    {["````markdown", example.source, "````"].join("\n")}
                  </SabaMarkdownContent>
                </div>

                <div className="saba-note-example-result">
                  <span>效果</span>
                  <SabaMarkdownContent readingStyle="novel">
                    {example.source}
                  </SabaMarkdownContent>
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
