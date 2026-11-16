"use client";

import { Button, Field, Input } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import { ASSET_FILE_MAX_BYTES, ASSET_MIME_TYPES } from "../../template-assets-contract";
import type { useQuotationImageUpload } from "../hooks/useQuotationImageUpload";

export function QuotationImageUpload({ upload }: { upload: NonNullable<ReturnType<typeof useQuotationImageUpload>> }) {
  const { t } = useI18n();
  const copy = t.coreOperations.templates;
  const error = upload.feedback && upload.feedback !== "assetUploaded" ? copy[upload.feedback] : undefined;

  return <div className="flex max-w-full flex-wrap items-end gap-2">
    <Field label={copy.assetFile} showLabel error={error}
      hint={formatTemplate(copy.assetFileHint, { max: String(ASSET_FILE_MAX_BYTES / 1024 / 1024) })}>
      <Input key={upload.key} type="file" accept={ASSET_MIME_TYPES.join(",")}
        disabled={upload.disabled || upload.busy || upload.pending} onChange={upload.select} />
    </Field>
    <Button type="button" size="sm" variant="outline" loading={upload.busy}
      disabled={upload.disabled || upload.busy || (!upload.file && !upload.pending)} onClick={upload.submit}>
      {upload.pending ? t.common.retry : copy.assetUpload}
    </Button>
    {upload.pending && <p className="w-full text-sm" role="status">{copy.assetUploadUnconfirmed}</p>}
    {upload.feedback === "assetUploaded" && <p className="w-full text-sm" role="status">{copy.assetUploaded}</p>}
  </div>;
}
