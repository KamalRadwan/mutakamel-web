"use client";

/**
 * The signal that tells a mounted phone its own configuration changed.
 *
 * The widget reads `/me` once when it mounts, and it mounts in the portal's
 * root layout — so it outlives every screen that can change a phone. Without a
 * signal, enabling an extension leaves the dock absent until a full page
 * reload, which reads as "the feature is broken" rather than "the page is
 * stale".
 *
 * A DOM event rather than React state because the two sides share no ancestor
 * below the root layout: the settings and user screens sit in unrelated route
 * subtrees, and threading a token up through the layout would couple the
 * portal's shell to whichever screens happen to edit a phone. The portal
 * already uses this shape for cross-tree notices (`global-toast`).
 *
 * Same document only. A change made in another tab is not observed, which is
 * the same bound the rest of the portal's client state lives under.
 */
export const WEBPHONE_CHANGED_EVENT = "mutakamel.webphone.changed";

/**
 * Announce that the caller's own WebPhone may have changed.
 *
 * Call it after any successful WebPhone write — extension created, updated,
 * deleted, or the server configuration saved. It is deliberately unaware of
 * *what* changed: the widget re-reads `/me`, which is the only authority on
 * whether it should render and register.
 *
 * Safe to call from anywhere: outside a browser it does nothing.
 */
export function notifyWebphoneChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(WEBPHONE_CHANGED_EVENT));
}
