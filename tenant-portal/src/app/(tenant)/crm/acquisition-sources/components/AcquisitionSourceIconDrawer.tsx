"use client";

import { useState } from "react";
import { FileUpload, FormDrawer, type UploadFile } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatNumber } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import {
  ACQUISITION_SOURCE_ICON_MAX_BYTES,
  ACQUISITION_SOURCE_ICON_MIME_TYPES,
  type AcquisitionSource,
} from "../acquisition-source-contract";

interface AcquisitionSourceIconDrawerProps {
  source: AcquisitionSource | null;
  isSubmitting: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (file: File) => Promise<boolean>;
}

const BYTES_PER_MEGABYTE = 1024 * 1024;

// POST /acquisition-sources/:id/icon. One file, multipart field `file`, ICO /
// PNG / JPEG, 2 MB. The three rejections the route distinguishes — 400, 413,
// 415 — arrive from the hook as three different messages; this drawer only
// renders whichever it was handed.
export function AcquisitionSourceIconDrawer({
  source,
  isSubmitting,
  error,
  onClose,
  onSubmit,
}: AcquisitionSourceIconDrawerProps) {
  const { t, lang } = useI18n();
  // Seeded once; the caller remounts this drawer per source it opens for.
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [rejections, setRejections] = useState<string[]>([]);

  const formatBytes = (bytes: number) =>
    formatTemplate(t.crmAcquisitionSources.iconMegabytes, {
      size: formatNumber(bytes / BYTES_PER_MEGABYTE, lang, {
        maximumFractionDigits: 1,
      }),
    });

  return (
    <FormDrawer
      open={source !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t.crmAcquisitionSources.iconTitle}
      description={t.crmAcquisitionSources.iconDescription}
      isDirty={files.length > 0}
      isSubmitting={isSubmitting}
      submitDisabled={files.length === 0}
      error={error ?? rejections[0]}
      onSubmit={() => {
        const first = files[0];
        if (!first) return;
        void onSubmit(first.file).then((ok) => {
          if (ok) setFiles([]);
        });
      }}
      labels={{
        submit: t.crmAcquisitionSources.iconUpload,
        cancel: t.common.cancel,
        discardTitle: t.common.discardTitle,
        discardDescription: t.common.discardDescription,
        discardConfirm: t.common.discardConfirm,
        discardCancel: t.common.cancel,
      }}
    >
      <FileUpload
        files={files}
        accept={[...ACQUISITION_SOURCE_ICON_MIME_TYPES]}
        maxSizeBytes={ACQUISITION_SOURCE_ICON_MAX_BYTES}
        maxFiles={1}
        disabled={isSubmitting}
        formatBytes={formatBytes}
        onFilesAdded={(accepted) => {
          setRejections([]);
          const next = accepted[0];
          if (!next) return;
          setFiles([
            { id: `${next.name}-${next.size}`, file: next, status: "ready" },
          ]);
        }}
        onRemove={() => setFiles([])}
        onReject={setRejections}
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
    </FormDrawer>
  );
}
