type MarkdownNode = {
  type: string;
  value?: string;
  url?: string;
  children?: MarkdownNode[];
};

// Matches filenames ending with .md (supports Korean, ASCII, hyphens, underscores, dots)
const MD_FILE_RE = /[\w가-힣一-鿿぀-ゟ゠-ヿ][\w가-힣一-鿿぀-ゟ゠-ヿ._-]*\.md\b/gi;

export function normalizeStemToKey(stem: string): string {
  return stem.toLowerCase().replace(/[^a-z0-9_-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

export function findMatchingDocumentKey(filename: string, keys: readonly string[]): string | null {
  if (keys.length === 0) return null;
  const stem = filename.replace(/\.md$/i, "");

  // 1. Exact match (case-insensitive)
  const exactMatch = keys.find((k) => k.toLowerCase() === stem.toLowerCase());
  if (exactMatch) return exactMatch;

  // 2. Normalized match (strip non-alphanumeric)
  const normalizedStem = normalizeStemToKey(stem);
  if (normalizedStem) {
    const normalizedMatch = keys.find((k) => normalizeStemToKey(k) === normalizedStem);
    if (normalizedMatch) return normalizedMatch;
  }

  return null;
}

function createDocumentLinkNode(filename: string, key: string): MarkdownNode {
  return {
    type: "link",
    url: `#document-${encodeURIComponent(key)}`,
    children: [{ type: "text", value: filename }],
  };
}

function linkifyMdFilesInText(value: string, keys: readonly string[]): MarkdownNode[] | null {
  const nodes: MarkdownNode[] = [];
  let cursor = 0;
  let matched = false;

  for (const match of value.matchAll(MD_FILE_RE)) {
    const raw = match[0];
    if (!raw) continue;
    const start = match.index ?? 0;
    const end = start + raw.length;

    const matchedKey = findMatchingDocumentKey(raw, keys);
    if (!matchedKey) continue;

    matched = true;
    if (start > cursor) {
      nodes.push({ type: "text", value: value.slice(cursor, start) });
    }
    nodes.push(createDocumentLinkNode(raw, matchedKey));
    cursor = end;
  }

  if (!matched) return null;
  if (cursor < value.length) {
    nodes.push({ type: "text", value: value.slice(cursor) });
  }
  return nodes;
}

function rewriteTreeForMdFiles(node: MarkdownNode, keys: readonly string[]) {
  if (!Array.isArray(node.children) || node.children.length === 0) return;
  if (
    node.type === "link" ||
    node.type === "linkReference" ||
    node.type === "code" ||
    node.type === "definition" ||
    node.type === "html"
  ) {
    return;
  }

  const nextChildren: MarkdownNode[] = [];
  for (const child of node.children) {
    if (child.type === "text" && typeof child.value === "string") {
      const linked = linkifyMdFilesInText(child.value, keys);
      if (linked) {
        nextChildren.push(...linked);
        continue;
      }
    }
    rewriteTreeForMdFiles(child, keys);
    nextChildren.push(child);
  }
  node.children = nextChildren;
}

export function createRemarkLinkMdFiles(keys: readonly string[]) {
  return () => (tree: MarkdownNode) => {
    if (keys.length === 0) return;
    rewriteTreeForMdFiles(tree, keys);
  };
}
