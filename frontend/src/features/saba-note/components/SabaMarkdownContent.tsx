import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function SabaMarkdownContent({
  children,
  emptyText = "这里还没有正文。",
}: {
  children: string;
  emptyText?: string;
}) {
  return (
    <article className="saba-markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {children || `*${emptyText}*`}
      </ReactMarkdown>
    </article>
  );
}
