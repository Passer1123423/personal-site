export type MarkdownHeading = {
  level: 2 | 3;
  text: string;
  id: string;
};

export type DerivationReference = {
  id: string;
  label: string | null;
};

type MarkdownAstNode = {
  type: string;
  value?: string;
  url?: string;
  children?: MarkdownAstNode[];
  data?: {
    hProperties?: Record<string, string>;
  };
};

const SABA_INTERNAL_LINK_PATTERN =
  /\[\[(node|derivation):([0-9a-fA-F-]+)(?:\|([^\]]+))?\]\]/g;

export function getMarkdownHeadingId(text: string) {
  return text
    .trim()
    .toLowerCase()
    .replace(/[`*_~[\]()]/g, "")
    .replace(/[^\p{L}\p{N}\u4e00-\u9fff]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

export function extractMarkdownHeadings(markdown: string): MarkdownHeading[] {
  const headings: MarkdownHeading[] = [];
  let insideCodeBlock = false;

  for (const line of markdown.split(/\r?\n/)) {
    if (line.trim().startsWith("```")) {
      insideCodeBlock = !insideCodeBlock;
      continue;
    }

    if (insideCodeBlock) {
      continue;
    }

    const match = line.match(/^(#{2,3})\s+(.+?)\s*#*\s*$/);
    if (!match) {
      continue;
    }

    const text = match[2]
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/[`*_~]/g, "")
      .trim();

    if (!text) {
      continue;
    }

    headings.push({
      level: match[1].length as 2 | 3,
      text,
      id: getMarkdownHeadingId(text),
    });
  }

  return headings;
}

export function makeDerivationReference(id: string, title: string) {
  const label = title.replace(/\]/g, "").trim();
  return label
    ? `[[derivation:${id}|${label}]]`
    : `[[derivation:${id}]]`;
}

export function extractDerivationReferences(
  markdown: string,
): DerivationReference[] {
  const references: DerivationReference[] = [];
  const seen = new Set<string>();

  for (const match of markdown.matchAll(SABA_INTERNAL_LINK_PATTERN)) {
    if (match[1] !== "derivation" || seen.has(match[2])) {
      continue;
    }

    seen.add(match[2]);
    references.push({
      id: match[2],
      label: match[3]?.trim() || null,
    });
  }

  return references;
}

function transformInternalLinkText(parent: MarkdownAstNode) {
  if (["link", "code", "inlineCode"].includes(parent.type)) {
    return;
  }

  if (!parent.children) {
    return;
  }

  parent.children = parent.children.flatMap((child) => {
    if (child.type !== "text" || !child.value) {
      transformInternalLinkText(child);
      return [child];
    }

    const nodes: MarkdownAstNode[] = [];
    let cursor = 0;

    for (const match of child.value.matchAll(SABA_INTERNAL_LINK_PATTERN)) {
      const index = match.index ?? 0;
      const [source, type, id, rawLabel] = match;
      const label =
        rawLabel?.trim() || (type === "derivation" ? "引用" : `${type}:${id}`);
      const href =
        type === "derivation"
          ? `/saba-note/derivation/${encodeURIComponent(id)}`
          : `/saba-note/manage?node=${encodeURIComponent(id)}`;

      if (index > cursor) {
        const before = child.value.slice(cursor, index);
        nodes.push({
          type: "text",
          value:
            type === "derivation"
              ? before.replace(/[ \t]*\r?\n[ \t]*$/, "")
              : before,
        });
      }

      nodes.push({
        type: "link",
        url: href,
        children: [{ type: "text", value: label }],
        data: {
          hProperties: {
            "data-saba-link-type": type,
            "data-saba-link-id": id,
          },
        },
      });
      cursor = index + source.length;
    }

    if (nodes.length === 0) {
      return [child];
    }

    if (cursor < child.value.length) {
      nodes.push({ type: "text", value: child.value.slice(cursor) });
    }

    return nodes;
  });
}

export function remarkSabaInternalLinks() {
  return (tree: MarkdownAstNode) => {
    transformInternalLinkText(tree);
  };
}
