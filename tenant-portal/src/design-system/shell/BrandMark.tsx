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

  return (
    <Link
      href="/"
      aria-label={t.nav.brandHome}
      className={cn(
        // The fixed zone is a DESKTOP promise. Below `xl` the section menus are
        // gone anyway, and 250px of a 375px phone would leave the switcher and
        // the four account controls about 125px to share — so it shrinks to fit
        // its own contents and lets the tenant name truncate.
        "flex h-full w-auto max-w-40 shrink-0 items-center gap-2 border-e border-border px-3 xl:w-(--size-brand) xl:max-w-none",
        // Plain semantic names: this only ever renders inside GlobalNav, whose
        // `nav-surface` points them at the on-chrome values.
        "text-sm font-medium text-foreground hover:bg-accent",
        focusRing,
      )}
    >
      {logoUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- a same-origin Core route streaming tenant-owned bytes under the session cookie; next/image would add an optimizer hop and needs a remote pattern for a path that is already capped server-side.
        <img src={logoUrl} alt="" className="h-6 w-auto max-w-24 shrink-0 object-contain" />
      )}
      <span className="truncate">{name}</span>
    </Link>
  );
}
