export type MarkdownHeading = {
  level: 2 | 3;
  text: string;
  id: string;
};

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
