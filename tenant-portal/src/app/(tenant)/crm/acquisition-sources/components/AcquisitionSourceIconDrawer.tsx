"use client";

import { Button, FileUpload, FormDrawer } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { localizedName } from "@/lib/format/localized";
import { useAcquisitionSourceIconForm } from "../hooks/useAcquisitionSourceIconForm";
import { SourceIconPreview } from "./SourceIconPreview";
import {
  ACQUISITION_SOURCE_ICON_MAX_BYTES,
  ACQUISITION_SOURCE_ICON_MIME_TYPES,
  type AcquisitionSource,
} from "../acquisition-source-contract";

interface AcquisitionSourceIconDrawerProps {
  source: AcquisitionSource | null;
  isSubmitting: boolean;
  isUncertain: boolean;
  reconcileOnly: boolean;
  onReconcile: () => Promise<void>;
  error: string | null;
  onClose: () => void;
  onSubmit: (file: File) => Promise<boolean>;
}

// POST /acquisition-sources/:id/icon. One file, multipart field `file`, ICO /
// PNG / JPEG, 2 MB. The three rejections the route distinguishes — 400, 413,
// 415 — arrive from the hook as three different messages; this drawer only
// renders whichever it was handed.
export function AcquisitionSourceIconDrawer({
  source,
  isSubmitting,
  isUncertain,
  reconcileOnly,
  onReconcile,
  error,
  onClose,
  onSubmit,
}: AcquisitionSourceIconDrawerProps) {
  const { t, lang } = useI18n();
  const form = useAcquisitionSourceIconForm(onSubmit, isSubmitting);

  return (
    <FormDrawer
      open={source !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t.crmAcquisitionSources.iconTitle}
      description={t.crmAcquisitionSources.iconDescription}
      isDirty={form.files.length > 0}
      isSubmitting={isSubmitting}
      submitDisabled={form.files.length === 0 || reconcileOnly}
      footerLeading={isUncertain ? <Button variant="outline" size="sm" onClick={() => void onReconcile()} disabled={isSubmitting}>{t.crmAcquisitionSources.reload}</Button> : undefined}
      error={error ?? form.error}
      onSubmit={() => void form.submit()}
      labels={{
        submit: t.crmAcquisitionSources.iconUpload,
        cancel: t.common.cancel,
        discardTitle: t.common.discardTitle,
        discardDescription: t.common.discardDescription,
        discardConfirm: t.common.discardConfirm,
        discardCancel: t.common.cancel,
      }}
    >
      {source && <div className="mb-4 flex items-center gap-3 rounded-md border border-border bg-muted p-3">
        <SourceIconPreview source={source} />
        <div><p className="text-xs text-muted-foreground">{t.crmAcquisitionSources.currentIcon}</p>
          <p className="text-sm text-foreground">{localizedName(source, lang)}</p></div>
      </div>}
      <FileUpload
        files={form.files}
        accept={[...ACQUISITION_SOURCE_ICON_MIME_TYPES, "", "application/octet-stream"]}
        maxSizeBytes={ACQUISITION_SOURCE_ICON_MAX_BYTES}
        maxFiles={1}
        disabled={isSubmitting || isUncertain}
        formatBytes={form.formatBytes}
        onFilesAdded={form.add}
        onRemove={form.remove}
        onReject={form.reject}
        labels={{
          instruction: t.crmAcquisitionSources.iconInstruction,
          browse: t.crmAcquisitionSources.iconBrowse,
          constraint: t.crmAcquisitionSources.iconConstraint,
          remove: t.crmAcquisitionSources.iconRemove,
          uploading: t.crmAcquisitionSources.iconUploading,
          tooLarge: t.crmAcquisitionSources.iconTooLargeTemplate,
          wrongType: t.crmAcquisitionSources.iconWrongTypeTemplate,
          tooMany: t.crmAcquisitionSources.iconTooManyTemplate,
        }}
      />
      <p className="text-xs text-muted-foreground">
        {t.crmAcquisitionSources.iconExtensionNote}
      </p>
      <p className="mt-2 text-xs text-muted-foreground">{t.crmAcquisitionSources.iconKept}</p>
    </FormDrawer>
  );
}
