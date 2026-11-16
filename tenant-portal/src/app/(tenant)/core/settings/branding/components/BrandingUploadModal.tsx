"use client";

import { ImageIcon, Upload } from "lucide-react";
import {
  Button,
  cn,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatNumber } from "@/lib/format/number";
import { BRANDING_ASSET_PUBLIC_PATH, type BrandingAssetKind } from "../branding-contract";
import {
  BRANDING_ASSET_MIME_TYPES,
  formatBrandingAssetLimits,
  formatBrandingAssetSize,
} from "../branding-image-validation";
import { useBrandingUploadModal } from "../hooks/useBrandingUploadModal";

export interface BrandingUploadModalProps {
  open: boolean;
  kind: BrandingAssetKind | null;
  hasLogo: boolean;
  hasIcon: boolean;
  assetVersion: number;
  isUploading: boolean;
  serverError: string | null;
  onClearServerError: (kind: BrandingAssetKind) => void;
  onUpload: (kind: BrandingAssetKind, file: File) => Promise<boolean>;
  onClose: () => void;
}

export function BrandingUploadModal(props: BrandingUploadModalProps) {
  if (!props.open || !props.kind) return null;
  return <BrandingUploadModalOpen key={props.kind} {...props} kind={props.kind} />;
}

interface BrandingUploadModalOpenProps extends Omit<BrandingUploadModalProps, "kind"> {
  kind: BrandingAssetKind;
}

function BrandingUploadModalOpen({
  kind,
  hasLogo,
  hasIcon,
  assetVersion,
  isUploading,
  serverError,
  onClearServerError,
  onUpload,
  onClose,
}: BrandingUploadModalOpenProps) {
  const { t, lang } = useI18n();
  const hasAsset = kind === "logo" ? hasLogo : hasIcon;
  const assetLabel = kind === "logo" ? t.coreBilling.brandingLogo : t.coreBilling.brandingIcon;
  const modalTitle =
    kind === "logo"
      ? t.coreSettings.brandingUi.uploadLogoTitle
      : t.coreSettings.brandingUi.uploadIconTitle;

  const { setFileInputNode, ...modal } = useBrandingUploadModal({
    kind,
    isUploading,
    serverError,
    onClearServerError: () => onClearServerError(kind),
    onUpload,
    onClose,
  });

  const dimensionSummary = modal.dimensions
    ? ` • ${formatNumber(modal.dimensions.width, lang, { maximumFractionDigits: 0 })}×${formatNumber(modal.dimensions.height, lang, { maximumFractionDigits: 0 })} px`
    : "";

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) modal.requestClose();
      }}
    >
      <DialogContent
        size="md"
        showCloseButton={!isUploading}
        closeLabel={t.common.close}
        aria-busy={isUploading || undefined}
        onEscapeKeyDown={(event) => {
          if (isUploading) event.preventDefault();
        }}
        onPointerDownOutside={(event) => {
          if (isUploading) event.preventDefault();
        }}
        onInteractOutside={(event) => {
          if (isUploading) event.preventDefault();
        }}
      >
        <DialogHeader className="pe-8">
          <DialogTitle className="text-base">{modalTitle}</DialogTitle>
          <DialogDescription className="text-xs">
            {formatBrandingAssetLimits(kind, t, lang)}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                {t.coreSettings.brandingUi.currentAsset}
              </span>
              <div className="flex h-24 items-center justify-center rounded-md border border-border bg-surface-subtle p-2">
                {hasAsset ? (
                  // eslint-disable-next-line @next/next/no-img-element -- same-origin Core binary route.
                  <img
                    src={`${BRANDING_ASSET_PUBLIC_PATH[kind]}?v=${assetVersion}`}
                    alt={assetLabel}
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <span className="text-center text-xs text-muted-foreground">
                    {t.coreBilling.brandingNoAsset}
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                {t.coreSettings.brandingUi.selectedFile}
              </span>
              <div className="flex h-24 flex-col items-center justify-center gap-1 rounded-md border border-border bg-surface-subtle p-2">
                {modal.previewUrl && modal.selectedFile ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element -- local object URL created from validated File. */}
                    <img
                      src={modal.previewUrl}
                      alt={modal.selectedFile.name}
                      className="max-h-12 max-w-full object-contain"
                    />
                    <span className="max-w-full truncate text-xs text-muted-foreground">
                      {`${modal.selectedFile.name} • ${formatBrandingAssetSize(modal.selectedFile.size, t, lang)}${dimensionSummary}`}
                    </span>
                  </>
                ) : (
                  <ImageIcon className="size-4 text-muted-foreground" aria-hidden="true" />
                )}
              </div>
            </div>
          </div>

          <div
            onDragOver={modal.handleDragOver}
            onDragLeave={modal.handleDragLeave}
            onDrop={modal.handleDrop}
            className={cn(
              "flex flex-col items-center gap-2 rounded-md border border-dashed px-3 py-3 text-center transition-colors",
              modal.isDragActive ? "border-ring bg-selected" : "border-border bg-card",
            )}
          >
            <Input
              ref={setFileInputNode}
              type="file"
              accept={BRANDING_ASSET_MIME_TYPES.join(",")}
              aria-label={modalTitle}
              disabled={isUploading}
              className="sr-only"
              onChange={modal.handleInputChange}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isUploading}
              onClick={modal.openFilePicker}
            >
              <Upload className="size-3.5" aria-hidden="true" />
              {modal.selectedFile
                ? t.coreSettings.brandingUi.chooseAnotherFile
                : t.coreSettings.brandingUi.chooseFile}
            </Button>
            <p className="text-xs text-muted-foreground">
              {t.coreBilling.brandingAssetImmediateHint}
            </p>
          </div>

          {modal.activeError && (
            <div
              role="alert"
              className="rounded-md border border-destructive bg-destructive-subtle px-3 py-2 text-xs text-destructive-subtle-foreground"
            >
              {modal.activeError}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={isUploading}
            onClick={modal.requestClose}
          >
            {t.common.cancel}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="primary"
            loading={isUploading}
            disabled={!modal.canSubmit}
            onClick={() => void modal.submit()}
          >
            {t.coreSettings.brandingUi.uploadAsset}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
