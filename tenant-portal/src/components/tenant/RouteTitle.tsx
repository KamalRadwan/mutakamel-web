"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import { routeTitleKey } from "@/lib/navigation/route-title";

/**
 * Gives every route its own translated document title.
 *
 * Before this, all 132 routes shared the single `metadata` block in
 * `src/app/layout.tsx`: every tab in a user's window read "Tenant Portal -
 * Mutakamel Crowd Capital", in English, in an otherwise Arabic product. Tabs
 * were indistinguishable, browser history was unusable, and a bookmark
 * recorded nothing about what had been bookmarked.
 *
 * It runs on the client because it has to. `export const metadata` is a
 * server-only declaration and 122 of the 125 pages are `"use client"`, so
 * nearly none of them *can* carry one; and language lives in `localStorage`,
 * so even a server that could would have no way to know which language to
 * render. The root layout still declares a static Arabic default and a
 * `title.template`, which is what a crawler and the first painted frame see —
 * this refines it per route and re-runs when the language toggles.
 *
 * `null` render: it is an effect, not UI.
 */
export function RouteTitle() {
  const { t } = useI18n();
  const pathname = usePathname();

  useEffect(() => {
    const key = routeTitleKey(pathname);
    const page = key
      ? (t.nav as Record<string, string | undefined>)[key]
      : undefined;

    document.title = page
      ? formatTemplate(t.metadata.titleTemplate, { page, portal: t.common.portalName })
      : formatTemplate(t.metadata.title, {
          portal: t.common.portalName,
          app: t.common.appName,
        });
    // `t` is the whole dictionary object, which changes identity exactly when
    // the language does — that is what makes the title follow the toggle.
  }, [pathname, t]);

  return null;
}
