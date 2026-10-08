"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { useId } from "react";
import { cn } from "../../lib/cn";
import { focusRing } from "../../lib/variants";
import { Button } from "../../primitives/Button";
import { useTree } from "./hooks/useTree";
import type { TreeNode, TreeProps } from "./tree-types";

/** Paged, non-virtual tree. Pagination controls belong outside role=tree. */
export function Tree(props: TreeProps) {
  const state = useTree(props);
  return (
    <ul ref={(element) => state.setRoot(element)} role="tree" aria-label={props.label} className={cn("space-y-1", props.className)}>
      {props.nodes.map((node) => <TreeItem key={node.id} node={node} props={props} state={state} />)}
    </ul>
  );
}

function TreeItem({ node, props, state }: { node: TreeNode; props: TreeProps; state: ReturnType<typeof useTree> }) {
  const descriptionId = useId();
  const expanded = props.expanded.has(node.id);
  return (
    <li ref={(element) => state.register(node.id, element)} role="treeitem"
      tabIndex={state.tabStopId === node.id ? 0 : -1} aria-label={node.label}
      aria-describedby={node.description ? descriptionId : undefined}
      aria-selected={props.selectedId === node.id} aria-expanded={node.hasChildren ? expanded : undefined}
      aria-level={node.level} aria-posinset={node.position} aria-setsize={node.setSize} aria-busy={node.busy || undefined}
      onFocus={(event) => { if (event.target === event.currentTarget) state.onFocus(node.id); }}
      onKeyDown={(event) => state.onKeyDown(event, node)}
      className={cn("rounded-md outline-none", focusRing)}>
      <div onClick={() => state.select(node.id)} className={cn(
        "flex min-h-10 cursor-pointer items-center gap-2 rounded-md pe-3 ps-1 text-sm hover:bg-muted",
        props.selectedId === node.id && "bg-accent text-accent-foreground",
      )}>
        {node.hasChildren ? (
          <Button variant="ghost" size="sm" tabIndex={-1}
            aria-label={`${expanded ? props.labels.collapse : props.labels.expand} ${node.label}`}
            onClick={(event) => { event.stopPropagation(); state.toggle(node); }}>
            {expanded ? <ChevronDown className="size-4" aria-hidden="true" /> : <ChevronRight className="size-4 rtl:-scale-x-100" aria-hidden="true" />}
          </Button>
        ) : <span className="w-8 shrink-0" aria-hidden="true" />}
        <span className="min-w-0 flex-1 break-words">{node.label}</span>
        {node.description ? <span id={descriptionId}>{node.description}</span> : null}
      </div>
      {expanded && node.children?.length ? (
        <ul role="group" className="ms-4 mt-1 space-y-1 border-s ps-2">
          {node.children.map((child) => <TreeItem key={child.id} node={child} props={props} state={state} />)}
        </ul>
      ) : null}
    </li>
  );
}
