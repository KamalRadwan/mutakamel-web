/**
 * Writes keys into the address bar's query; `null` removes one.
 *
 * Built from the query as it is NOW and written through the History API, not
 * `router.replace` with a render's `useSearchParams`: the router commits a URL
 * only when its transition renders, so two writes in one event — or a screen's
 * own filter write followed by a view switch — would each start from the same
 * old query, and the later one would drop the earlier. Next keeps
 * `useSearchParams` and `usePathname` in step with `replaceState`, and a query
 * change costs no server round trip. See docs/design/views.md#view-state.
 */
export function replaceSearchParams(updates: Readonly<Record<string, string | null>>): void {
  const params = new URLSearchParams(window.location.search);
  for (const [key, value] of Object.entries(updates)) {
    if (value === null) params.delete(key);
    else params.set(key, value);
  }
  const query = params.toString();
  window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`);
}
