import { NAV_SECTIONS } from "@/design-system";

/**
 * The `t.nav` key naming the page a pathname renders, or `null` when no
 * navigation entry owns it.
 *
 * Every route in this portal is a client component, so none of them can export
 * Next's `metadata` — `export const metadata` is a server-only declaration and
 * 122 of 125 pages start with `"use client"`. Language is a client fact here
 * too: it lives in `localStorage`, so the server cannot know it and a static
 * `metadata.title` could only ever be Arabic. Route titles therefore resolve
 * on the client, from this map, and follow the language toggle like every
 * other string.
 *
 * `NAV_SECTIONS` is reused rather than a second table being written beside it.
 * A parallel route→title map would drift from the sidebar the first time a
 * screen was renamed, and the sidebar label IS the page's name — the same
 * string, already translated in both dictionaries.
 *
 * Longest matching prefix wins, so `/crm/leads/<id>` inherits "Leads" from
 * `/crm/leads` while `/crm/leads` itself still resolves exactly. `"/"` matches
 * only itself: the prefix test appends a slash, and no path begins `//`.
 */
export function routeTitleKey(pathname: string): string | null {
  let best: { href: string; labelKey: string } | null = null;

  for (const section of NAV_SECTIONS) {
    for (const item of section.items) {
      const owns = pathname === item.href || pathname.startsWith(`${item.href}/`);
      if (!owns) continue;
      if (!best || item.href.length > best.href.length) best = item;
    }
  }

  return best?.labelKey ?? null;
}
