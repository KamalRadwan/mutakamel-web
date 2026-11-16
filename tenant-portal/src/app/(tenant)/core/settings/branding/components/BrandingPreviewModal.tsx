"use client";

import { useState, type CSSProperties } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  ToggleGroup,
  ToggleGroupItem,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import {
  BRAND_RAMP_STEPS,
  deriveBrandRamp,
  evaluateBrandColor,
  formatOklch,
  type BrandRamp,
} from "@/lib/branding/brand-ramp";
import {
  BRANDING_ASSET_PUBLIC_PATH,
  isValidBrandingHexColor,
  type BrandingFormValues,
} from "../branding-contract";

type PreviewThemeMode = "light" | "dark";

const SYSTEM_BRAND_HUE = 258;
const SYSTEM_BRAND_RAMP = deriveBrandRamp(SYSTEM_BRAND_HUE);

function initialPreviewMode(): PreviewThemeMode {
  if (typeof document !== "undefined" && document.documentElement.classList.contains("dark")) {
    return "dark";
  }
  return "light";
}

function buildPreviewSurfaceStyle(
  ramp: BrandRamp,
  mode: PreviewThemeMode,
): CSSProperties {
  const variables: Record<string, string> = {};
  for (const step of BRAND_RAMP_STEPS) {
    variables[`--color-brand-${step}`] = formatOklch(ramp[step]);
  }
  if (mode === "dark") {
    variables["--background"] = "var(--color-ink-1000)";
    variables["--foreground"] = "var(--color-ink-100)";
    variables["--card"] = "var(--color-ink-950)";
    variables["--card-foreground"] = "var(--color-ink-100)";
    variables["--muted"] = "var(--color-ink-900)";
    variables["--muted-foreground"] = "var(--color-ink-400)";
    variables["--border"] = "var(--color-ink-800)";
    variables["--input"] = "var(--color-ink-700)";
    variables["--primary"] = "var(--color-brand-400)";
    variables["--primary-foreground"] = "var(--color-ink-1000)";
    variables["--ring"] = "var(--color-brand-400)";
  } else {
    variables["--background"] = "var(--color-ink-50)";
    variables["--foreground"] = "var(--color-ink-950)";
    variables["--card"] = "white";
    variables["--card-foreground"] = "var(--color-ink-950)";
    variables["--muted"] = "var(--color-ink-100)";
    variables["--muted-foreground"] = "var(--color-ink-600)";
    variables["--border"] = "var(--color-ink-200)";
    variables["--input"] = "var(--color-ink-300)";
    variables["--primary"] = "var(--color-brand-600)";
    variables["--primary-foreground"] = "white";
    variables["--ring"] = "var(--color-brand-500)";
  }
  return variables as CSSProperties;
}

export interface BrandingPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  values: BrandingFormValues;
  hasLogo: boolean;
  hasIcon: boolean;
  assetVersion: number;
}

export function BrandingPreviewModal(props: BrandingPreviewModalProps) {
  if (!props.open) return null;
  return <BrandingPreviewModalOpen {...props} />;
}

function BrandingPreviewModalOpen({
  onOpenChange,
  values,
  hasLogo,
  hasIcon,
  assetVersion,
}: BrandingPreviewModalProps) {
  const { t } = useI18n();
  const [mode, setMode] = useState<PreviewThemeMode>(initialPreviewMode);

  const effectiveAppName = values.appName.trim() || t.common.appName;
  const effectiveTabTitle =
    values.tabTitle.trim() || values.appName.trim() || t.common.portalName;
  const monogram = effectiveAppName.trim().charAt(0).toUpperCase() || "M";

  const trimmedPrimary = values.primaryColor.trim();
  const verdict = trimmedPrimary ? evaluateBrandColor(trimmedPrimary) : null;
  const usesCustomRamp = verdict !== null && verdict.passes;
  const activeRamp = usesCustomRamp ? verdict.ramp : SYSTEM_BRAND_RAMP;

  const trimmedSecondary = values.secondaryColor.trim();
  const hasSecondaryColor = isValidBrandingHexColor(trimmedSecondary);

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent size="lg" closeLabel={t.common.close}>
        <div className="flex items-center justify-between gap-2 pe-9">
          <DialogHeader>
            <DialogTitle className="text-base">
              {t.coreSettings.brandingUi.previewTitle}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {t.coreSettings.brandingUi.previewTitle}
            </DialogDescription>
          </DialogHeader>

          <ToggleGroup
            type="single"
            size="xs"
            value={mode}
            onValueChange={(next) => {
              if (next === "light" || next === "dark") setMode(next);
            }}
          >
            <ToggleGroupItem value="light" className="px-2.5 text-xs">
              {t.coreSettings.brandingUi.previewLight}
            </ToggleGroupItem>
            <ToggleGroupItem value="dark" className="px-2.5 text-xs">
              {t.coreSettings.brandingUi.previewDark}
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        <section
          aria-label={t.coreSettings.brandingUi.previewTitle}
          data-preview-theme={mode}
          data-preview-palette={usesCustomRamp ? "custom" : "system"}
          style={buildPreviewSurfaceStyle(activeRamp, mode)}
          className="overflow-hidden rounded-lg border border-border bg-background text-foreground"
        >
          {/* Simulated browser tab strip */}
          <div className="flex items-center gap-2 border-b border-border bg-muted px-3 pt-1.5">
            <div
              data-testid="branding-preview-tab"
              className="inline-flex max-w-60 items-center gap-1.5 rounded-t-sm border border-b-0 border-border bg-card px-2.5 py-1 text-xs font-medium text-card-foreground"
            >
              {hasIcon ? (
                // eslint-disable-next-line @next/next/no-img-element -- same-origin Core binary route.
                <img
                  src={`${BRANDING_ASSET_PUBLIC_PATH.icon}?v=${assetVersion}`}
                  alt=""
                  className="size-3.5 shrink-0 object-contain"
                />
              ) : (
                <span
                  aria-hidden="true"
                  className="flex size-3.5 shrink-0 items-center justify-center rounded-xs bg-gradient-logo text-xs font-semibold text-white"
                >
                  {monogram}
                </span>
              )}
              <span className="truncate">{effectiveTabTitle}</span>
            </div>
          </div>

          {/* Fixed Ocean Navy global shell bar */}
          <div data-testid="branding-preview-header">
            <div className="h-(--size-brand-strip) w-full bg-gradient-brand-strip" aria-hidden="true" />
            <div className="flex h-10 items-center justify-between gap-2 bg-gradient-header px-3">
              <div className="flex min-w-0 items-center gap-2">
                {hasLogo ? (
                  // eslint-disable-next-line @next/next/no-img-element -- same-origin Core binary route.
                  <img
                    src={`${BRANDING_ASSET_PUBLIC_PATH.logo}?v=${assetVersion}`}
                    alt=""
                    className="h-6 w-auto max-w-20 shrink-0 rounded-sm object-contain"
                  />
                ) : (
                  <span
                    aria-hidden="true"
                    className="flex size-6 shrink-0 items-center justify-center rounded-sm bg-gradient-logo text-xs font-semibold text-white"
                  >
                    {monogram}
                  </span>
                )}
                <span className="truncate text-sm font-semibold text-nav-foreground-strong">
                  {effectiveAppName}
                </span>
              </div>

              {hasSecondaryColor && (
                <span
                  aria-hidden="true"
                  data-testid="branding-preview-secondary-swatch"
                  className="size-3.5 shrink-0 rounded-xs border border-white/30"
                  style={{ backgroundColor: trimmedSecondary }}
                />
              )}
            </div>
          </div>

          {/* Non-interactive sign-in preview surface (no real form or inputs) */}
          <div className="bg-background p-4">
            <div className="mx-auto flex max-w-xs flex-col gap-2.5 rounded-lg border border-border bg-card p-3.5 text-card-foreground shadow-card">
              <div className="flex items-center gap-2">
                {hasLogo ? (
                  // eslint-disable-next-line @next/next/no-img-element -- same-origin Core binary route.
                  <img
                    src={`${BRANDING_ASSET_PUBLIC_PATH.logo}?v=${assetVersion}`}
                    alt=""
                    className="h-6 w-auto max-w-20 shrink-0 rounded-sm object-contain"
                  />
                ) : (
                  <span
                    aria-hidden="true"
                    className="flex size-6 shrink-0 items-center justify-center rounded-sm bg-gradient-logo text-xs font-semibold text-white"
                  >
                    {monogram}
                  </span>
                )}
                <span className="truncate text-sm font-semibold text-card-foreground">
                  {effectiveAppName}
                </span>
              </div>

              <div aria-hidden="true" className="flex flex-col gap-2">
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-card-foreground">
                    {t.coreSettings.brandingUi.previewEmailLabel}
                  </span>
                  <div
                    dir="ltr"
                    className="flex h-7 items-center rounded-sm border border-input bg-background px-2.5 text-xs text-muted-foreground"
                  >
                    user@company.com
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-card-foreground">
                    {t.coreSettings.brandingUi.previewPasswordLabel}
                  </span>
                  <div
                    dir="ltr"
                    className="flex h-7 items-center rounded-sm border border-input bg-background px-2.5 text-xs text-muted-foreground"
                  >
                    ••••••••
                  </div>
                </div>

                <div
                  data-testid="branding-preview-signin"
                  className="flex h-8 select-none items-center justify-center rounded-sm bg-primary px-3 text-xs font-medium text-primary-foreground"
                >
                  {t.coreSettings.brandingUi.previewSignInAction}
                </div>
              </div>
            </div>
          </div>
        </section>

        {verdict !== null && !verdict.passes ? (
          <p role="status" className="text-xs text-muted-foreground">
            {t.coreBilling.brandingContrastFallback}
          </p>
        ) : (
          !usesCustomRamp && (
            <p className="text-xs text-muted-foreground">
              {t.coreSettings.brandingUi.previewSystemPaletteActive}
            </p>
          )
        )}

        <DialogFooter>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {t.common.close}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
