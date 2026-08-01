import {
  useEffect,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import hljs from "highlight.js/lib/core";
import bash from "highlight.js/lib/languages/bash";
import c from "highlight.js/lib/languages/c";
import cpp from "highlight.js/lib/languages/cpp";
import css from "highlight.js/lib/languages/css";
import go from "highlight.js/lib/languages/go";
import java from "highlight.js/lib/languages/java";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import markdown from "highlight.js/lib/languages/markdown";
import python from "highlight.js/lib/languages/python";
import rust from "highlight.js/lib/languages/rust";
import sql from "highlight.js/lib/languages/sql";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";

hljs.registerLanguage("bash", bash);
hljs.registerLanguage("c", c);
hljs.registerLanguage("cpp", cpp);
hljs.registerLanguage("css", css);
hljs.registerLanguage("go", go);
hljs.registerLanguage("java", java);
hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("json", json);
hljs.registerLanguage("markdown", markdown);
hljs.registerLanguage("python", python);
hljs.registerLanguage("rust", rust);
hljs.registerLanguage("sql", sql);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("xml", xml);

const LANGUAGE_ALIASES: Record<string, string> = {
  cxx: "cpp",
  html: "xml",
  js: "javascript",
  jsx: "javascript",
  md: "markdown",
  py: "python",
  sh: "bash",
  shell: "bash",
  ts: "typescript",
  tsx: "typescript",
};

type CopyState = "idle" | "copied" | "error";

export default function MarkdownCodeBlock({
  children,
  code,
  language,
  preProps,
}: {
  children: ReactNode;
  code: string;
  language: string | null;
  preProps: Omit<HTMLAttributes<HTMLPreElement>, "children">;
}) {
  const resetTimerRef = useRef<number | null>(null);
  const [copyState, setCopyState] = useState<CopyState>("idle");

  useEffect(() => {
    return () => {
      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      setCopyState("copied");
    } catch {
      setCopyState("error");
    }

    if (resetTimerRef.current !== null) {
      window.clearTimeout(resetTimerRef.current);
    }
    resetTimerRef.current = window.setTimeout(() => {
      setCopyState("idle");
    }, 1800);
  }

  const copyLabel =
    copyState === "copied"
      ? "已复制"
      : copyState === "error"
        ? "复制失败"
        : "复制";
  const normalizedLanguage = language
    ? (LANGUAGE_ALIASES[language.toLowerCase()] ?? language.toLowerCase())
    : null;
  const highlightedCode =
    normalizedLanguage && hljs.getLanguage(normalizedLanguage)
      ? hljs.highlight(code, { language: normalizedLanguage }).value
      : null;

  return (
    <div className="saba-note-code-block">
      <div className="saba-note-code-toolbar">
        <span>{language ?? "代码"}</span>
        <button type="button" onClick={() => void copyCode()}>
          {copyLabel}
        </button>
      </div>
      <pre {...preProps}>
        {highlightedCode ? (
          <code
            className={`hljs language-${normalizedLanguage}`}
            dangerouslySetInnerHTML={{ __html: highlightedCode }}
          />
        ) : (
          children
        )}
      </pre>
    </div>
  );
}
