// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseCategoryDetail, parseCategoryTreePage, type Category } from "../category-contract";
import { useCategoryTree } from "./useCategoryTree";

const { tree, detail } = vi.hoisted(() => ({ tree: vi.fn(), detail: vi.fn() }));
vi.mock("../category-api", () => ({ readCategoryTree: tree, readCategory: detail }));
const id = (n: number) => `019f0000-0000-7000-8000-${n.toString().padStart(12, "0")}`;
const now = "2026-09-27T10:00:00.000Z";
function node(n: number, parent?: Category, position = 1, total = 1, children = 0): Category {
  const segment = { id: id(n), code: `C${n}`, name: `Category ${n}`, siblingPosition: position, siblingTotal: total };
  return { id: id(n), code: segment.code, name: segment.name, displayName: segment.name,
    parentId: parent?.id ?? null, status: "ACTIVE", effectiveActive: true, inactiveAncestorId: null,
    sortOrder: position * 1024, depth: (parent?.depth ?? 0) + 1, version: 1,
    path: [...(parent?.path ?? []), segment], childCount: children, hasChildren: children > 0 };
}
const root = node(1, undefined, 1, 1, 1);
const leaf = node(2, root);
function page(items: Category[], parentId: string | null = null, treeVersion = 1, number = 1, total = items.length) {
  return parseCategoryTreePage({ items, parentId, treeVersion, page: number, limit: 50, total, asOf: now });
}
beforeEach(() => { tree.mockReset(); detail.mockReset(); tree.mockResolvedValue(page([root])); });
afterEach(cleanup);

describe("bounded Category tree reads", () => {
  it("cancels a child request when replacing the page containing its parent", async () => {
    let complete!: (value: ReturnType<typeof page>) => void;
    const { result } = renderHook(() => useCategoryTree("en"));
    await waitFor(() => expect(result.current.nodes).toHaveLength(1));
    tree.mockImplementationOnce(() => new Promise((resolve) => { complete = resolve; }));
    act(() => result.current.expand(root.id, true));
    tree.mockResolvedValueOnce(page([node(3)], null, 1, 2, 51));
    await act(async () => { await result.current.load(null, 2); });
    await act(async () => { complete(page([leaf], root.id)); });
    expect(result.current.pages.has(root.id)).toBe(false);
    expect(result.current.nodes[0].id).toBe(id(3));
    expect(result.current.busy.size).toBe(0);
  });
  it("does not reopen a collapsed branch when its slow child request completes", async () => {
    let complete!: (value: ReturnType<typeof page>) => void;
    const { result } = renderHook(() => useCategoryTree("en"));
    await waitFor(() => expect(result.current.nodes).toHaveLength(1));
    tree.mockImplementationOnce(() => new Promise((resolve) => { complete = resolve; }));
    act(() => result.current.expand(root.id, true));
    act(() => result.current.expand(root.id, false));
    await act(async () => { complete(page([leaf], root.id)); });
    expect(result.current.expanded.has(root.id)).toBe(false);
    expect(result.current.pages.has(root.id)).toBe(false);
    expect(result.current.busy.size).toBe(0);
  });
  it("replaces the entire cache when a later page reports a different tree token", async () => {
    const { result } = renderHook(() => useCategoryTree("en"));
    await waitFor(() => expect(result.current.treeVersion).toBe(1));
    tree.mockResolvedValueOnce(page([leaf], root.id, 2)).mockResolvedValueOnce(page([root], null, 2));
    await act(async () => { await result.current.load(root.id); });
    expect(result.current.treeVersion).toBe(2);
    expect(result.current.pages.size).toBe(1);
    expect(result.current.notice).toBe("changed");
    expect(tree).toHaveBeenCalledTimes(3);
  });
  it("reveals a middle-page path directly without scanning earlier sibling pages", async () => {
    const locatedRoot = node(1, undefined, 51, 80, 151);
    const locatedLeaf = node(2, locatedRoot, 151, 200);
    const located = parseCategoryDetail({ ...locatedLeaf, treeVersion: 1, localizedNames: { en: locatedLeaf.name },
      createdAt: now, updatedAt: now, subtreeHeight: 1, usage: { directItemCount: 0, subtreeItemCount: 0,
        descendantCount: 0, hasRetainedItemReferences: false, canDelete: false, deleteBlockers: ["ACTIVE"], asOf: now } });
    const { result } = renderHook(() => useCategoryTree("en"));
    await waitFor(() => expect(result.current.treeVersion).toBe(1));
    tree.mockResolvedValueOnce(page([locatedRoot], null, 1, 2, 80))
      .mockResolvedValueOnce(page([locatedLeaf], locatedRoot.id, 1, 4, 200));
    await act(async () => { expect(await result.current.reveal(located)).toBe(true); });
    expect(tree.mock.calls.slice(1).map((call) => call.slice(0, 2))).toEqual([[null, 2], [root.id, 4]]);
    expect(result.current.focusRequest?.id).toBe(leaf.id);
    expect(detail).not.toHaveBeenCalled();
  });
  it("refuses another expanded page at the 2000-node bound and frees collapsed branches", async () => {
    const roots = Array.from({ length: 40 }, (_, index) => node(index + 1, undefined, index + 1, 40, 50));
    tree.mockImplementation(async (parent: string | null) => parent === null ? page(roots) :
      page(Array.from({ length: 50 }, (_, index) => node(Number(parent.slice(-12)) * 100 + index,
        roots.find((entry) => entry.id === parent), index + 1, 50)), parent));
    const { result } = renderHook(() => useCategoryTree("en"));
    await waitFor(() => expect(result.current.nodes).toHaveLength(40));
    for (const root of roots.slice(0, 39)) await act(async () => { await result.current.load(root.id); });
    const before = tree.mock.calls.length;
    await act(async () => { await result.current.load(roots[39].id); });
    expect(tree).toHaveBeenCalledTimes(before);
    expect(result.current.notice).toBe("capacity");
    act(() => result.current.expand(roots[0].id, false));
    await act(async () => { await result.current.load(roots[39].id); });
    expect(result.current.pages.has(roots[39].id)).toBe(true);
    expect([...result.current.pages.values()].reduce((sum, entry) => sum + entry.items.length, 0)).toBe(1990);
  });
});
