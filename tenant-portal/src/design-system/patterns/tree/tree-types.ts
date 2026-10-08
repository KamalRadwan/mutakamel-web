import type { ReactNode } from "react";

export interface TreeNode {
  id: string;
  label: string;
  description?: ReactNode;
  children?: readonly TreeNode[];
  hasChildren: boolean;
  level: number;
  position: number;
  setSize: number;
  busy?: boolean;
}

export interface TreeProps {
  label: string;
  nodes: readonly TreeNode[];
  expanded: ReadonlySet<string>;
  selectedId?: string | null;
  /** Change the request object to reveal/focus an existing UUID after a read. */
  focusRequest?: { id: string; sequence: number };
  onSelect: (id: string) => void;
  onExpand: (id: string, expanded: boolean) => void;
  onFocusNode?: (id: string) => void;
  labels: { expand: string; collapse: string };
  className?: string;
}
