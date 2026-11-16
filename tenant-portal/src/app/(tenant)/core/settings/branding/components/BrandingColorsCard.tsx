"use client";

import type { Ref } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  cn,
  DegradedBanner,
  Field,
  Input,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { BrandRampVerdict } from "@/lib/branding/brand-ramp";
import { isValidBrandingHexColor, type BrandingFormValues } from "../branding-contract";

export interface BrandingColorsCardProps {
  values: BrandingFormValues;
  fieldErrors: Partial<Record<keyof BrandingFormValues, string>>;
  contrast: BrandRampVerdict | null;
  canManage: boolean;
  disabled: boolean;
  primaryColorRef: Ref<HTMLInputElement>;
  secondaryColorRef: Ref<HTMLInputElement>;
  onChange: (patch: Partial<BrandingFormValues>) => void;
}

export function BrandingColorsCard({
  values,
  fieldErrors,
  contrast,
  canManage,
  disabled,
  primaryColorRef,
  secondaryColorRef,
  onChange,
}: BrandingColorsCardProps) {
  const { t } = useI18n();

  const primaryTrimmed = values.primaryColor.trim();
  const primaryIsValidHex = isValidBrandingHexColor(primaryTrimmed);
  const secondaryTrimmed = values.secondaryColor.trim();
  const secondaryIsValidHex = isValidBrandingHexColor(secondaryTrimmed);

  // Parsing errors stay on the field; low-contrast fallback only applies to a
  // syntactically valid hex colour whose derived OKLCH ramp fails WCAG gates.
  const showContrastFallback =
    !fieldErrors.primaryColor && contrast !== null && !contrast.passes;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.coreBilling.brandingColors}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            showLabel
            label={t.coreBilling.brandingPrimaryColor}
            error={fieldErrors.primaryColor}
            readOnly={!canManage}
          >
            <div className="flex items-center gap-2">
              <span
                aria-hidden="true"
                data-testid="branding-primary-swatch"
                className={cn(
                  "size-7 shrink-0 rounded-md border",
                  primaryIsValidHex
                    ? "border-border"
                    : primaryTrimmed === ""
                      ? "border-border bg-primary"
                      : "border-dashed border-destructive bg-muted",
                )}
                style={primaryIsValidHex ? { backgroundColor: primaryTrimmed } : undefined}
              />
              <Input
                ref={primaryColorRef}
                size="sm"
                dir="ltr"
                className="font-mono"
                value={values.primaryColor}
                maxLength={9}
                readOnly={!canManage}
                disabled={disabled}
                placeholder="#2563eb"
                onChange={(event) => onChange({ primaryColor: event.target.value })}
              />
            </div>
          </Field>

          <Field
            showLabel
            label={t.coreBilling.brandingSecondaryColor}
            hint={t.coreBilling.brandingSecondaryColorHint}
            error={fieldErrors.secondaryColor}
            readOnly={!canManage}
          >
            <div className="flex items-center gap-2">
              <span
                aria-hidden="true"
                data-testid="branding-secondary-swatch"
                className={cn(
                  "size-7 shrink-0 rounded-md border",
                  secondaryIsValidHex
                    ? "border-border"
                    : secondaryTrimmed === ""
                      ? "border-border bg-secondary"
                      : "border-dashed border-destructive bg-muted",
                )}
                style={secondaryIsValidHex ? { backgroundColor: secondaryTrimmed } : undefined}
              />
              <Input
                ref={secondaryColorRef}
                size="sm"
                dir="ltr"
                className="font-mono"
                value={values.secondaryColor}
                maxLength={9}
                readOnly={!canManage}
                disabled={disabled}
                placeholder="#64748b"
                onChange={(event) => onChange({ secondaryColor: event.target.value })}
              />
            </div>
          </Field>
        </div>

        {showContrastFallback && (
          <DegradedBanner message={t.coreBilling.brandingContrastFallback} />
        )}
      </CardContent>
    </Card>
  );
}
