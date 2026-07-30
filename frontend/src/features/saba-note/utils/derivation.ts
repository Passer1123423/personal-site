import type {
  Category,
  Derivation,
  DerivationView,
  KnowledgeNode,
  Tag,
} from "../types";

export function makeDerivationExcerpt(contentMd: string) {
  return contentMd
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[#>*_`~-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

export function getDerivationDisplayTitle(title: string) {
  return title.trim() || "未命名推导";
}

export function buildDerivationView(
  derivation: Derivation,
  nodes: KnowledgeNode[],
  categories: Category[],
  tags: Tag[],
): DerivationView {
  const node = nodes.find((item) => item.id === derivation.nodeId) ?? null;
  const category =
    categories.find((item) => item.id === node?.categoryId) ?? null;

  return {
    derivation,
    node,
    category,
    tags,
    excerpt: makeDerivationExcerpt(derivation.contentMd),
  };
}
