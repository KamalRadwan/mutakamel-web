// @vitest-environment jsdom

import { useState } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Tree } from "./Tree";
import type { TreeNode } from "./tree-types";

afterEach(cleanup);

const child: TreeNode = { id: "child", label: "Child", hasChildren: false, level: 2, position: 51, setSize: 100 };
const nodes: TreeNode[] = [
  { id: "a", label: "Alpha", hasChildren: true, level: 1, position: 1, setSize: 2, children: [child] },
  { id: "b", label: "Beta", hasChildren: false, level: 1, position: 2, setSize: 2 },
];
function Example({ select, direction = "ltr" }: { select: (id: string) => void; direction?: string }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  return <div dir={direction}><Tree nodes={nodes} label="Categories" expanded={expanded}
    labels={{ expand: "Expand", collapse: "Collapse" }} onSelect={select}
    onExpand={(id, open) => setExpanded((current) => {
      const next = new Set(current); if (open) next.add(id); else next.delete(id); return next;
    })} /></div>;
}

describe("Tree keyboard model", () => {
  it.each(["ltr", "rtl"])("keeps physical arrows and selection independent in %s", (direction) => {
    const select = vi.fn();
    render(<Example select={select} direction={direction} />);
    const alpha = screen.getByRole("treeitem", { name: "Alpha" });
    act(() => alpha.focus());
    fireEvent.keyDown(alpha, { key: "ArrowRight" });
    expect(alpha).toHaveAttribute("aria-expanded", "true");
    fireEvent.keyDown(alpha, { key: "ArrowRight" });
    const leaf = screen.getByRole("treeitem", { name: "Child" });
    expect(leaf).toHaveFocus();
    expect(leaf).toHaveAttribute("aria-posinset", "51");
    expect(leaf).toHaveAttribute("aria-setsize", "100");
    expect(leaf).not.toHaveAttribute("aria-expanded");
    expect(select).not.toHaveBeenCalled();
    fireEvent.keyDown(leaf, { key: "Enter" });
    expect(select).toHaveBeenCalledWith("child");
    fireEvent.keyDown(leaf, { key: "ArrowLeft" });
    expect(alpha).toHaveFocus();
    fireEvent.keyDown(alpha, { key: "ArrowLeft" });
    expect(screen.queryByRole("treeitem", { name: "Child" })).not.toBeInTheDocument();
    fireEvent.keyDown(alpha, { key: "End" });
    const beta = screen.getByRole("treeitem", { name: "Beta" });
    expect(beta).toHaveFocus();
    fireEvent.keyDown(beta, { key: "Home" });
    expect(alpha).toHaveFocus();
    fireEvent.keyDown(alpha, { key: "b" });
    expect(beta).toHaveFocus();
    expect(screen.getAllByRole("treeitem").filter((item) => item.tabIndex === 0)).toHaveLength(1);
  });

  it("keeps UUID focus through reordered data and restores the parent when a child is removed", () => {
    const select = vi.fn();
    const props = { expanded: new Set(["a"]), label: "Categories", labels: { expand: "Expand", collapse: "Collapse" }, onSelect: select, onExpand: vi.fn() };
    const { rerender } = render(<Tree {...props} nodes={nodes} />);
    const leaf = screen.getByRole("treeitem", { name: "Child" });
    act(() => leaf.focus());
    rerender(<Tree {...props} nodes={[nodes[1], nodes[0]]} />);
    expect(screen.getByRole("treeitem", { name: "Child" })).toHaveFocus();
    rerender(<Tree {...props} expanded={new Set()} nodes={nodes} />);
    expect(screen.getByRole("treeitem", { name: "Alpha" })).toHaveFocus();
  });

  it("focuses a revealed UUID only when explicitly requested", () => {
    render(<Tree nodes={nodes} expanded={new Set()} focusRequest={{ id: "b", sequence: 1 }}
      label="Categories" labels={{ expand: "Expand", collapse: "Collapse" }} onSelect={vi.fn()} onExpand={vi.fn()} />);
    expect(screen.getByRole("treeitem", { name: "Beta" })).toHaveFocus();
  });
});
