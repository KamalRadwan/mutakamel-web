"use client";

import Link from "next/link";
import { useTenantBranding } from "@/context/BrandingContext";
import { useI18n } from "@/i18n/I18nContext";
import { cn } from "../lib/cn";
import { focusRing } from "../lib/variants";

/**
 * The global nav's inline-start brand mark — a 34×34 `bg-gradient-logo` tile
 * paired with the tenant's name, linking home.
 *
 * `logoUrl` is a same-origin path to Core's `@Public()` logo route, not a
 * free-form URL: `parsePublicBranding` compares it against the exact constant
 * and rejects anything else, so a compromised upstream cannot point this
 * `<img>` at another host.
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
        "flex h-10 w-auto min-w-0 max-w-44 items-center gap-2.5 rounded-lg pe-1 font-semibold tracking-tight text-nav-foreground-strong transition-opacity hover:opacity-90 sm:max-w-52 lg:max-w-60",
        focusRing,
      )}
    >
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- a same-origin Core route streaming tenant-owned bytes under the session cookie; next/image would add an optimizer hop and needs a remote pattern for a path that is already capped server-side.
        <img
          src={logoUrl}
          alt=""
          className="h-[34px] w-auto max-w-24 shrink-0 rounded-[10px] object-contain"
        />
      ) : (
        <span
          aria-hidden="true"
          className="flex size-[34px] shrink-0 items-center justify-center rounded-[10px] bg-gradient-logo font-semibold text-white"
        >
          <span className="text-base leading-none">{monogram}</span>
        </span>
      )}
      <span className="min-w-0 truncate text-base">{name}</span>
    </Link>
  );
}
