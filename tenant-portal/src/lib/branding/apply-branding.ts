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
 * Applies what is safe to apply and reports what was refused.
 *
 * `fontFamily` is deliberately **not** applied. The portal loads exactly two
 * webfonts (`src/app/fonts.ts`); assigning an arbitrary family name would
 * silently resolve to a system fallback and read as a rendering bug rather than
 * a brand. Shipping the tenant's font needs a font-delivery route that does not
 * exist yet.
 */
export function applyBrandingTokens(branding: PublicBranding): BrandingOutcome {
  if (branding.tabTitle) document.title = branding.tabTitle;
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
  return { kind: "applied" };
}
