"use client";

import { ImageIcon } from "lucide-react";
import { Button, cn } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { BRANDING_ASSET_PUBLIC_PATH, type BrandingAssetKind } from "../branding-contract";
import { formatBrandingAssetLimits } from "../branding-image-validation";

export interface BrandingAssetCardProps {
  kind: BrandingAssetKind;
  title: string;
  hasAsset: boolean;
  assetVersion: number;
  isUploading: boolean;
  error: string | null;
  canManage: boolean;
  disabled: boolean;
  onOpenUpload: () => void;
}

/**
 * Compact branding asset tile.
 *
 * Stored bytes stream from Core's same-origin public binary route so storage
 * keys and credentials never reach the browser.
 */
export function BrandingAssetCard({
  kind,
  title,
  hasAsset,
  assetVersion,
  isUploading,
  error,
  canManage,
  disabled,
  onOpenUpload,
}: BrandingAssetCardProps) {
  const { t, lang } = useI18n();

  return (
    <div className="flex flex-col justify-between gap-2.5 rounded-md border border-border bg-surface-subtle p-3">
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex shrink-0 items-center justify-center rounded-sm border border-border bg-card p-1.5",
            kind === "logo" ? "h-14 w-20" : "size-14",
          )}
        >
          {hasAsset ? (
            // eslint-disable-next-line @next/next/no-img-element -- same-origin Core binary route capped server-side.
            <img
              src={`${BRANDING_ASSET_PUBLIC_PATH[kind]}?v=${assetVersion}`}
              alt={title}
              className="max-h-full max-w-full object-contain"
            />
          ) : (
            <ImageIcon className="size-4 text-muted-foreground" aria-hidden="true" />
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <p className="text-xs text-muted-foreground">
            {formatBrandingAssetLimits(kind, t, lang)}
          </p>
          {!hasAsset && (
            <p className="text-xs text-muted-foreground">{t.coreBilling.brandingNoAsset}</p>
          )}
        </div>

        {canManage && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            loading={isUploading}
            disabled={disabled || isUploading}
            onClick={onOpenUpload}
          >
            {hasAsset
              ? t.coreSettings.brandingUi.replaceAsset
              : t.coreSettings.brandingUi.uploadAsset}
          </Button>
        )}
      </div>

      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
