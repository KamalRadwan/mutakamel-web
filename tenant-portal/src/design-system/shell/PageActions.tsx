"use client";

import { createPortal } from "react-dom";
import { usePageActionSlots, type PageActionSlot } from "./page-action-slots";

export interface PageActionsProps {
  /** Which region of the action bar these controls belong in. */
  slot: PageActionSlot;
  children: React.ReactNode;
}

/**
 * Sends a screen's own controls up into the page action bar.
 *
 * Written where the controls belong — inside the screen, next to the state they
 * read — and painted in the bar. A screen using it looks like this:
 *
 * ```tsx
 * <PageActions slot="view">
 *   <ViewSwitcher value={view} onChange={setView} … />
 * </PageActions>
 * ```
 *
 * `PageHeader` already does this for every screen's primary and secondary
 * actions, so most screens never call it directly; it is for the two controls
 * the header does not own — the search box and the view switcher.
 *
 * **Outside the shell it renders in place.** The `(fence)` screens, the login
 * route and every component test render without an action bar, and a
 * `PageHeader` there must still show its actions rather than quietly dropping
 * them. Inside the shell the opposite is required: for the one render before
 * the bar registers its nodes this must draw nothing, or every page load would
 * paint its actions in the body and then jump them into the bar.
 *
 * `present` is what separates the two — see `page-action-slots.tsx`.
 */
export function PageActions({ slot, children }: PageActionsProps) {
  const { present, nodes } = usePageActionSlots();
  if (!present) return <>{children}</>;
  const node = nodes[slot];
  if (!node) return null;
  return createPortal(children, node);
}
