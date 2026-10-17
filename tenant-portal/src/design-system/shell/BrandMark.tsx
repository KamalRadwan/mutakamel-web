"use client";

import Link from "next/link";
import { useTenantBranding } from "@/context/BrandingContext";
import { useI18n } from "@/i18n/I18nContext";
import { cn } from "../lib/cn";
import { focusRing } from "../lib/variants";

/**
 * The global nav's inline-start zone — a fixed `--size-brand` (250px) block
 * holding the tenant's own logo and name, linking home.
 *
 * The old sidebar reserved its head for a logo and then never rendered one, so
 * a white-labelled tenant paid for branding that appeared on the login screen
 * and nowhere else. This is where it finally lands.
 *
 * `logoUrl` is a same-origin path to Core's `@Public()` logo route, not a
 * free-form URL: `parsePublicBranding` compares it against the exact constant
 * and rejects anything else, so a compromised upstream cannot point this
 * `<img>` at another host.
 *
 * The zone is a fixed width rather than `w-auto` because the menus that follow
 * it must start at the same x on every screen. A brand block that resized with
 * the tenant's name would move the whole nav for each tenant, and the first
 * menu's position is something a user learns once and then relies on.
 */
export function BrandMark() {
  const { t } = useI18n();
  const { appName, logoUrl } = useTenantBranding();
  // The product's own name until the tenant's arrives — never an empty block
  // while the branding request is in flight.
  const name = appName ?? t.common.appName;
  const monogram = name.trim().charAt(0).toUpperCase() || "M";

  return (
    <Link
      href="/"
      aria-label={t.nav.brandHome}
      className={cn(
        "flex h-full w-auto max-w-36 shrink-0 items-center gap-2 px-2.5 sm:max-w-44 lg:max-w-52 lg:px-3",
        "text-sm font-semibold tracking-tight text-white hover:bg-white/10 hover:text-white",
        focusRing,
      )}
    >
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- a same-origin Core route streaming tenant-owned bytes under the session cookie; next/image would add an optimizer hop and needs a remote pattern for a path that is already capped server-side.
        <img src={logoUrl} alt="" className="h-5 w-auto max-w-20 shrink-0 object-contain" />
      ) : (
        <span
          aria-hidden="true"
          className="flex size-5.5 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-blue-500 to-violet-600 text-2xs font-bold text-white shadow-[0_2px_6px_rgba(59,130,246,0.4)]"
        >
          {monogram}
        </span>
      )}
      <span className="truncate">{name}</span>
    </Link>
  );
}
