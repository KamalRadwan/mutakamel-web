"use client";

import { useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { TreeNode, TreeProps } from "../tree-types";

interface VisibleNode { node: TreeNode; parentId: string | null }

function visibleNodes(nodes: readonly TreeNode[], expanded: ReadonlySet<string>, parentId: string | null = null): VisibleNode[] {
  return nodes.flatMap((node) => [
    { node, parentId },
    ...(expanded.has(node.id) ? visibleNodes(node.children ?? [], expanded, node.id) : []),
  ]);
}

/** APG treeview: physical Left/Right retain their meaning in both directions. */
export function useTree(props: TreeProps) {
  const { nodes, expanded, onExpand, onSelect, onFocusNode, focusRequest } = props;
  const root = useRef<HTMLUListElement>(null);
  const elements = useRef(new Map<string, HTMLLIElement>());
  const visible = useMemo(() => visibleNodes(nodes, expanded), [nodes, expanded]);
  const [focusPath, setFocusPath] = useState<string[]>([]);
  const focusedId = focusPath[0];
  const typeahead = useRef({ text: "", at: 0 });
  const requested = useRef<TreeProps["focusRequest"]>(undefined);
  const tabStopId = focusPath.find((id) => visible.some(({ node }) => node.id === id))
    ?? visible.find(({ node }) => node.id === props.selectedId)?.node.id ?? visible[0]?.node.id ?? null;

  useLayoutEffect(() => {
    const lost = focusedId && !elements.current.has(focusedId);
    if (lost && tabStopId && (document.activeElement === document.body || root.current?.contains(document.activeElement))) {
      elements.current.get(tabStopId)?.focus();
    }
    if (focusRequest && requested.current !== focusRequest && elements.current.has(focusRequest.id)) {
      requested.current = focusRequest;
      elements.current.get(focusRequest.id)?.focus();
    }
  }, [focusRequest, focusedId, tabStopId, visible]);

  const focus = (id: string | null | undefined) => { if (id) elements.current.get(id)?.focus(); };
  const onKeyDown = (event: KeyboardEvent<HTMLLIElement>, node: TreeNode) => {
    if (event.target !== event.currentTarget || event.altKey || event.metaKey || event.ctrlKey) return;
    const index = visible.findIndex((entry) => entry.node.id === node.id);
    let handled = true;
    switch (event.key) {
      case "ArrowDown": focus(visible[index + 1]?.node.id); break;
      case "ArrowUp": focus(visible[index - 1]?.node.id); break;
      case "Home": focus(visible[0]?.node.id); break;
      case "End": focus(visible.at(-1)?.node.id); break;
      case "ArrowRight":
        if (node.hasChildren && !expanded.has(node.id)) onExpand(node.id, true);
        else if (expanded.has(node.id)) focus(node.children?.[0]?.id);
        break;
      case "ArrowLeft":
        if (node.hasChildren && expanded.has(node.id)) onExpand(node.id, false);
        else focus(visible[index]?.parentId);
        break;
      case "Enter": case " ": onSelect(node.id); break;
      default: {
        handled = event.key.length === 1;
        if (!handled) break;
        const now = Date.now();
        const text = `${now - typeahead.current.at < 700 ? typeahead.current.text : ""}${event.key}`.toLocaleLowerCase();
        typeahead.current = { text, at: now };
        const prefix = new Set(Array.from(text)).size === 1 ? event.key.toLocaleLowerCase() : text;
        const ordered = [...visible.slice(index + 1), ...visible.slice(0, index + 1)];
        focus(ordered.find(({ node: candidate }) => candidate.label.toLocaleLowerCase().startsWith(prefix))?.node.id);
      }
    }
    if (handled) { event.preventDefault(); event.stopPropagation(); }
  };
  return {
    setRoot: (element: HTMLUListElement | null) => { root.current = element; }, tabStopId, onKeyDown,
    register: (id: string, element: HTMLLIElement | null) => {
      if (element) elements.current.set(id, element); else elements.current.delete(id);
    },
    onFocus: (id: string) => {
      const path = [id];
      let parent = visible.find(({ node }) => node.id === id)?.parentId;
      while (parent) {
        path.push(parent);
        parent = visible.find(({ node }) => node.id === parent)?.parentId;
      }
      setFocusPath(path);
      onFocusNode?.(id);
    },
    select: (id: string) => { focus(id); onSelect(id); },
    toggle: (node: TreeNode) => { focus(node.id); onExpand(node.id, !expanded.has(node.id)); },
  };
}
