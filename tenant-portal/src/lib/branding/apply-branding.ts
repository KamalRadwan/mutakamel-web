import {
  BRAND_RAMP_STEPS,
  evaluateBrandColor,
  formatOklch,
  type BrandContrastPairId,
} from "./brand-ramp";
import type { PublicBranding } from "./public-branding";

// Writes tenant branding into the token layer at runtime (MASTER-PLAN 6.17).
//
// Three semantic tokens read the brand ramp, all declared in
// `src/app/globals.css`: `--primary`, `--ring` and `--sidebar-active`. None of
// them is written here — overriding `--color-brand-*` on `:root` moves all
// three at once, in both themes, which is the whole reason the ramp is the
// indirection layer.
//
// `--color-chrome` is written beside the ramp and is the one brand colour that
// is not a step of it: the light theme's nav bar. It has to move with the hue
// for the same reason the marker on it does — a tenant who sets green and gets
// the system's navy bar has a bar belonging to somebody else's product.
//
// The override is an inline style on the root element, so it outranks the
// stylesheet without a second `:root` rule and without `!important`.

export type BrandingOutcome =
  /** No `primaryColor` set — the system brand is the tenant's brand. */
  | { kind: "systemDefault" }
  | { kind: "applied" }
  /** The value was not a hex colour the DTO's `@IsHexColor()` would have produced. */
  | { kind: "rejectedInvalid" }
  /** Derivable, but it breaks a token pair. The system brand stays. */
  | { kind: "rejectedContrast"; failures: BrandContrastPairId[] };

/**
 * Points the tab icon at the tenant's own, when they have uploaded one.
 *
 * `iconUrl` is not a free-form string: `parsePublicBranding` rejects anything
 * that is not exactly `PUBLIC_BRANDING_ICON_PATH`, so this can only ever be a
 * same-origin path served by Core. `img-src 'self'` already covers it, and a
 * compromised upstream cannot aim it off-origin.
 *
 * The `type` attribute is REMOVED rather than updated. Next's app-dir
 * convention emits `type="image/svg+xml"` for `src/app/icon.svg`, and the
 * tenant's upload may be a PNG or an ICO; leaving a contradicting type on the
 * element is worse than leaving the browser to sniff the bytes it fetched.
 *
 * A tenant whose icon 404s degrades to `/favicon.ico`, which redirects to the
 * system `icon.svg` — the same place they started.
 */
function applyBrandingIcon(iconUrl: string): void {
  const existing = document.querySelector<HTMLLinkElement>('link[rel~="icon"]');
  const link = existing ?? document.createElement("link");
  link.rel = "icon";
  link.href = iconUrl;
  link.removeAttribute("type");
  if (!existing) document.head.appendChild(link);
}

/**
 * Applies what is safe to apply and reports what was refused.
 *
 * `fontFamily` is deliberately **not** applied. The portal loads exactly three
 * webfonts (`src/app/fonts.ts` — Plex Sans, Plex Sans Arabic, Plex Mono);
 * assigning an arbitrary family name would silently resolve to a system
 * fallback and read as a rendering bug rather than a brand. Shipping the
 * tenant's font needs a font-delivery route that does not exist yet.
 *
 * Note the ordering: title and icon are applied BEFORE the `primaryColor`
 * guard. They are independent of the colour, and a tenant who uploaded an icon
 * but never set a brand colour must still get their icon — returning
 * `systemDefault` first would have silently skipped both.
 */
export function applyBrandingTokens(branding: PublicBranding): BrandingOutcome {
  if (branding.tabTitle) document.title = branding.tabTitle;
  if (branding.iconUrl) applyBrandingIcon(branding.iconUrl);
  if (!branding.primaryColor) return { kind: "systemDefault" };

  const verdict = evaluateBrandColor(branding.primaryColor);
  if (!verdict) return { kind: "rejectedInvalid" };
  if (!verdict.passes) {
    return { kind: "rejectedContrast", failures: verdict.failures.map((failure) => failure.id) };
  }

  const root = document.documentElement;
  for (const step of BRAND_RAMP_STEPS) {
    root.style.setProperty(`--color-brand-${step}`, formatOklch(verdict.ramp[step]));
  }
  root.style.setProperty("--color-chrome", formatOklch(verdict.chrome));
  return { kind: "applied" };
}
