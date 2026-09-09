"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

/**
 * The four regions of the page action bar, in the order it renders them.
 *
 * `related` sits in the MIDDLE, on its own: it holds links to other records —
 * a lead's opportunities, its quotations — which are navigation rather than
 * things done to this screen. Keeping it out of the trailing cluster is the
 * whole point, because a control that leaves the screen must not sit in the
 * same group as the controls that act on it.
 *
 * The trailing cluster is then `actions`, `search`, `view` — the reading order
 * of the controls a list screen offers, and the one the bar was specified
 * with. `view` is pinned to the inline end because it is the only control that
 * changes how the screen is drawn rather than what it holds; keeping it at a
 * fixed edge means it does not move as a screen gains or loses actions.
 */
export type PageActionSlot = "related" | "actions" | "search" | "view";

type SlotNodes = Record<PageActionSlot, HTMLElement | null>;

interface PageActionSlotsValue {
  /**
   * Whether a `PageActionSlotsProvider` is above this consumer at all.
   *
   * Distinguishes "the shell is here, its bar just has not committed its nodes
   * yet" from "there is no shell". The first is one render long and must
   * render nothing, or every page load would paint its actions in the body and
   * then move them. The second is permanent — a screen outside the shell, or a
   * component under test — and there rendering in place is the only behaviour
   * that does not silently drop a screen's primary action.
   */
  present: boolean;
  nodes: SlotNodes;
  register: (slot: PageActionSlot, node: HTMLElement | null) => void;
}

const EMPTY_NODES: SlotNodes = { related: null, actions: null, search: null, view: null };

const PageActionSlotsContext = createContext<PageActionSlotsValue>({
  present: false,
  nodes: EMPTY_NODES,
  register: () => undefined,
});

/**
 * Holds the action bar's three mount points for the page below it.
 *
 * **Why DOM nodes and a portal rather than React nodes in state.** A page's
 * actions are not static markup: the leads screen's "Add lead" needs the
 * screen's `openCreate`, its permission check and its pending flag, and its
 * search box owns a debounce. Lifting those into shell state would mean either
 * hoisting each screen's hooks into the shell, or storing elements in a
 * provider and re-rendering the whole shell on every keystroke.
 *
 * A portal moves only the DOM. Each control stays mounted inside the page that
 * declared it, keeps its own state, context and event handlers, and re-renders
 * on its own — while painting inside the bar. That is what makes this work for
 * 78 screens without any of them changing how they manage state.
 *
 * Mounted in `AppShell` above both the bar and `children`, so the bar's nodes
 * exist before any page tries to fill them.
 */
export function PageActionSlotsProvider({ children }: { children: React.ReactNode }) {
  const [nodes, setNodes] = useState<SlotNodes>(EMPTY_NODES);

  const register = useCallback((slot: PageActionSlot, node: HTMLElement | null) => {
    // Bail when the node has not actually changed. The bar's refs are stable
    // by construction (`PageActionBar` memoises each one), so this is the
    // second line of defence rather than the first: it absorbs StrictMode's
    // double invocation and any future caller that forgets.
    setNodes((current) => (current[slot] === node ? current : { ...current, [slot]: node }));
  }, []);

  const value = useMemo(() => ({ present: true, nodes, register }), [nodes, register]);

  return (
    <PageActionSlotsContext.Provider value={value}>{children}</PageActionSlotsContext.Provider>
  );
}

export function usePageActionSlots(): PageActionSlotsValue {
  return useContext(PageActionSlotsContext);
}
