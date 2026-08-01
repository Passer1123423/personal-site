import type { AnchorHTMLAttributes, ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import type { DerivationView } from "../types";
import {
  getMarkdownHeadingId,
  remarkSabaInternalLinks,
} from "../utils/markdown";
import DerivationCitation from "./DerivationCitation";

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
  readingStyle = "saba",
  derivations = [],
}: {
  children: string;
  emptyText?: string;
  className?: string;
  readingStyle?: "saba" | "novel";
  derivations?: DerivationView[];
}) {
  const derivationById = new Map(
    derivations.map((item) => [item.derivation.id, item]),
  );

  return (
    <div
      className={[
        readingStyle === "novel" ? "novel-markdown" : "saba-markdown",
        className,
      ].join(" ")}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkSabaInternalLinks]}
        components={{
          a: ({ node, href, children: linkChildren, ...props }) => {
            const properties = node?.properties as
              | Record<string, unknown>
              | undefined;
            const type =
              properties?.["data-saba-link-type"] ??
              properties?.dataSabaLinkType;
            const derivationId =
              properties?.["data-saba-link-id"] ??
              properties?.dataSabaLinkId;

            if (type === "derivation" && typeof derivationId === "string") {
              return (
                <DerivationCitation
                  derivationId={derivationId}
                  label={nodeText(linkChildren)}
                  target={derivationById.get(derivationId)}
                />
              );
            }

            return (
              <a
                {...(props as AnchorHTMLAttributes<HTMLAnchorElement>)}
                href={href}
              >
                {linkChildren}
              </a>
            );
          },
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
    </div>
  );
}
