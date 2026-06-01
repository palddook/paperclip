type MarkdownNode = {
  type: string;
  value?: string;
  url?: string;
  children?: MarkdownNode[];
};

// Matches filenames with common extensions (Korean + ASCII).
// Excludes .md files (handled separately by document-file-reference).
const WORKSPACE_FILE_RE =
  /[\w가-힣一-鿿぀-ゟ゠-ヿ][\w가-힣一-鿿぀-ゟ゠-ヿ._\- ]*\.(pptx?|docx?|xlsx?|pdf|csv|txt|zip|png|jpe?g|gif|svg|mp4|mov|json|yaml|yml|sh|py|mjs|ts|js)(?=\s|$|[,;:)}\]])/gi;

function linkifyWorkspaceFilesInText(value: string, baseUrl: string): MarkdownNode[] | null {
  const nodes: MarkdownNode[] = [];
  let cursor = 0;
  let matched = false;

  for (const match of value.matchAll(WORKSPACE_FILE_RE)) {
    const raw = match[0];
    if (!raw) continue;
    const start = match.index ?? 0;
    const end = start + raw.length;
    matched = true;
    if (start > cursor) nodes.push({ type: "text", value: value.slice(cursor, start) });
    nodes.push({
      type: "link",
      url: `${baseUrl}/${encodeURIComponent(raw)}`,
      children: [{ type: "text", value: raw }],
    });
    cursor = end;
  }

  if (!matched) return null;
  if (cursor < value.length) nodes.push({ type: "text", value: value.slice(cursor) });
  return nodes;
}

function rewriteTree(node: MarkdownNode, baseUrl: string) {
  if (!Array.isArray(node.children) || node.children.length === 0) return;
  if (["link", "linkReference", "code", "definition", "html"].includes(node.type)) return;

  const next: MarkdownNode[] = [];
  for (const child of node.children) {
    if (child.type === "text" && typeof child.value === "string") {
      const linked = linkifyWorkspaceFilesInText(child.value, baseUrl);
      if (linked) { next.push(...linked); continue; }
    }
    rewriteTree(child, baseUrl);
    next.push(child);
  }
  node.children = next;
}

export function createRemarkLinkWorkspaceFiles(baseUrl: string) {
  return () => (tree: MarkdownNode) => {
    if (!baseUrl) return;
    rewriteTree(tree, baseUrl);
  };
}
