"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, FileUpload, type UploadFile } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatNumber } from "@/lib/format/number";
import {
  BRANDING_ASSET_MAX_BYTES,
  BRANDING_ASSET_MIME_TYPES,
  BRANDING_ASSET_PUBLIC_PATH,
  type BrandingAssetKind,
} from "../branding-contract";

export interface BrandingAssetCardProps {
  kind: BrandingAssetKind;
  title: string;
  hasAsset: boolean;
  assetVersion: number;
  isUploading: boolean;
  error: string | null;
  disabled: boolean;
  onUpload: (file: File) => void;
  onReject: (message: string) => void;
}

const BYTES_PER_MEGABYTE = 1024 * 1024;

/**
 * One branding asset: what is stored now, and the control that replaces it.
 *
 * The image is read back from the **public binary route**, not from a storage
 * key — the public payload carries no keys at all, and the bytes stream through
 * Core so no Storage credential ever reaches the browser.
 */
export function BrandingAssetCard({
  kind,
  title,
  hasAsset,
  assetVersion,
  isUploading,
  error,
  disabled,
  onUpload,
  onReject,
}: BrandingAssetCardProps) {
  const { t, lang } = useI18n();
  const [pending, setPending] = useState<UploadFile | null>(null);

  const formatBytes = (bytes: number) =>
    `${formatNumber(Math.round((bytes / BYTES_PER_MEGABYTE) * 10) / 10, lang, {
      maximumFractionDigits: 1,
    })} ${t.coreBilling.megabytes}`;

  const files: UploadFile[] = pending
    ? [
        {
          ...pending,
          status: isUploading ? "uploading" : error ? "failed" : pending.status,
          error: error ?? undefined,
        },
      ]
    : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {hasAsset ? (
          // eslint-disable-next-line @next/next/no-img-element -- a same-origin Core route that streams tenant-owned bytes; next/image would add an optimizer hop for an image already capped at 2 MB.
          <img
            src={`${BRANDING_ASSET_PUBLIC_PATH[kind]}?v=${assetVersion}`}
            alt={title}
            className="h-16 w-auto max-w-full rounded-sm border border-border bg-card object-contain p-1"
          />
        ) : (
          <p className="text-xs text-muted-foreground">{t.coreBilling.brandingNoAsset}</p>
        )}

        <FileUpload
          files={files}
          accept={BRANDING_ASSET_MIME_TYPES}
          maxSizeBytes={BRANDING_ASSET_MAX_BYTES}
          maxFiles={1}
          disabled={disabled || isUploading}
          formatBytes={formatBytes}
          onFilesAdded={(added) => {
            const file = added[0];
            if (!file) return;
            setPending({ id: `${kind}-${file.name}`, file, status: "ready" });
            onUpload(file);
          }}
          onRemove={() => setPending(null)}
          onReject={(messages) => {
            setPending(null);
            if (messages[0]) onReject(messages[0]);
          }}
          labels={{
            instruction: t.coreBilling.uploadInstruction,
            browse: t.coreBilling.uploadBrowse,
            constraint: t.coreBilling.uploadConstraint,
            remove: t.coreBilling.uploadRemove,
            uploading: t.coreBilling.uploadInProgress,
            tooLarge: t.coreBilling.uploadTooLarge,
            wrongType: t.coreBilling.uploadWrongType,
            tooMany: t.coreBilling.uploadTooMany,
          }}
        />

        {error && !pending && <p className="text-xs text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
