import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { getMarkdownHeadingId } from "../utils/markdown";

function nodeText(children: ReactNode): string {
  if (typeof children === "string" || typeof children === "number") {
    return String(children);
  }

  if (Array.isArray(children)) {
    return children.map(nodeText).join("");
  }

  return "";
}

export default function SabaMarkdownContent({
  children,
  emptyText = "这里还没有正文。",
  className = "",
}: {
  children: string;
  emptyText?: string;
  className?: string;
}) {
  return (
    <article className={`saba-markdown ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h2: ({ children: headingChildren, ...props }) => (
            <h2
              {...props}
              id={getMarkdownHeadingId(nodeText(headingChildren))}
            >
              {headingChildren}
            </h2>
          ),
          h3: ({ children: headingChildren, ...props }) => (
            <h3
              {...props}
              id={getMarkdownHeadingId(nodeText(headingChildren))}
            >
              {headingChildren}
            </h3>
          ),
        }}
      >
        {children || `*${emptyText}*`}
      </ReactMarkdown>
    </article>
  );
}
