import {
  isValidElement,
  type AnchorHTMLAttributes,
  type ReactElement,
  type ReactNode,
} from "react";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

import type { DerivationView } from "../types";
import {
  createMarkdownHeadingIdFactory,
  remarkSabaCallouts,
  remarkSabaInternalLinks,
} from "../utils/markdown";
import DerivationCitation from "./DerivationCitation";
import MarkdownCodeBlock from "./MarkdownCodeBlock";

type HastNode = {
  value?: unknown;
  children?: HastNode[];
  properties?: Record<string, unknown>;
};

function nodeText(children: ReactNode): string {
  if (typeof children === "string" || typeof children === "number") {
    return String(children);
  }

  if (Array.isArray(children)) {
    return children.map(nodeText).join("");
  }

  if (isValidElement(children)) {
    return nodeText(
      (children as ReactElement<{ children?: ReactNode }>).props.children,
    );
  }

  return "";
}

const CALLOUT_LABELS: Record<string, string> = {
  note: "备注",
  tip: "提示",
  important: "重要",
  warning: "警告",
  caution: "注意",
};

function hastNodeText(node: HastNode | undefined): string {
  if (!node) return "";
  if (typeof node.value === "string") return node.value;
  return node.children?.map(hastNodeText).join("") ?? "";
}

function getCodeLanguage(node: HastNode | undefined) {
  const className = node?.children?.[0]?.properties?.className;
  const classes = Array.isArray(className)
    ? className.map(String)
    : typeof className === "string"
      ? className.split(/\s+/)
      : [];
  const languageClass = classes.find((item) => item.startsWith("language-"));
  return languageClass?.slice("language-".length) || null;
}

export default function SabaMarkdownContent({
  children,
  emptyText = "放心书写。您的思路值得被认真记录",
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
  const makeHeadingId = createMarkdownHeadingIdFactory();
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
        remarkPlugins={[
          remarkGfm,
          remarkMath,
          remarkSabaInternalLinks,
          remarkSabaCallouts,
        ]}
        rehypePlugins={[rehypeKatex]}
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
          table: ({ node, children: tableChildren, ...props }) => {
            void node;
            return (
              <div
                className="saba-note-markdown-table-scroll"
                role="region"
                aria-label="可横向滚动的表格"
                tabIndex={0}
              >
                <table {...props}>{tableChildren}</table>
              </div>
            );
          },
          blockquote: ({ node, children: quoteChildren, ...props }) => {
            const properties = node?.properties as
              | Record<string, unknown>
              | undefined;
            const calloutType = properties?.["data-callout"];

            if (typeof calloutType === "string" && CALLOUT_LABELS[calloutType]) {
              return (
                <aside
                  className={`saba-note-callout saba-note-callout-${calloutType}`}
                  aria-label={CALLOUT_LABELS[calloutType]}
                >
                  <p className="saba-note-callout-title">
                    {CALLOUT_LABELS[calloutType]}
                  </p>
                  <div className="saba-note-callout-content">{quoteChildren}</div>
                </aside>
              );
            }

            return <blockquote {...props}>{quoteChildren}</blockquote>;
          },
          pre: ({ node, children: preChildren, ...props }) => (
            <MarkdownCodeBlock
              code={hastNodeText(node as HastNode).replace(/\n$/, "")}
              language={getCodeLanguage(node as HastNode)}
              preProps={props}
            >
              {preChildren}
            </MarkdownCodeBlock>
          ),
          h2: ({ children: headingChildren, ...props }) => (
            <h2
              {...props}
              id={makeHeadingId(nodeText(headingChildren))}
            >
              {headingChildren}
            </h2>
          ),
          h3: ({ children: headingChildren, ...props }) => (
            <h3
              {...props}
              id={makeHeadingId(nodeText(headingChildren))}
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
