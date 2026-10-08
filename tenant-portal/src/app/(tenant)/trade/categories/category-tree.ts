import type { TreeNode } from "@/design-system";
import type { CategoryPage } from "./category-contract";

const CATEGORY_ROOT_KEY = "ROOT";
export function categoryPageKey(parentId: string | null) { return parentId ?? CATEGORY_ROOT_KEY; }

export function categoryTreeNodes(pages: ReadonlyMap<string, CategoryPage>, busy: ReadonlySet<string>, parentId: string | null = null): TreeNode[] {
  return (pages.get(categoryPageKey(parentId))?.items ?? []).map((node) => {
    const position = node.path.at(-1)!;
    return { id: node.id, label: node.name, hasChildren: node.hasChildren,
      level: node.depth, position: position.siblingPosition, setSize: position.siblingTotal,
      children: categoryTreeNodes(pages, busy, node.id), busy: busy.has(node.id) };
  });
}

/** Replacing one sibling page cannot retain descendants of its former rows. */
export function removeCategoryChildren(pages: Map<string, CategoryPage>, expanded: Set<string>, parentId: string | null) {
  const removed = new Set<string>();
  for (const node of pages.get(categoryPageKey(parentId))?.items ?? []) {
    for (const id of removeCategoryChildren(pages, expanded, node.id)) removed.add(id);
    removed.add(node.id);
    pages.delete(node.id);
    expanded.delete(node.id);
  }
  return removed;
}
