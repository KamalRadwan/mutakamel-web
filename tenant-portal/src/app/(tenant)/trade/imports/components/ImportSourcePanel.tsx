"use client";

import { useState } from "react";
import { Button, Field, FileUpload, Input, type UploadFile } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatNumber } from "@/lib/format/number";
import type { Language } from "@/i18n/useLanguage";
import {
  IMPORT_SOURCE_ACCEPT,
  IMPORT_SOURCE_MAX_BYTES,
} from "../import-contract";

interface ImportSourcePanelProps {
  lang: Language;
  sourceId: string;
  mappingId: string;
  onSourceIdChange: (value: string) => void;
  onMappingIdChange: (value: string) => void;
  onUpload: (file: File) => Promise<void>;
  onPreview: () => Promise<void>;
  pending: "upload" | "preview" | null;
  disabled: boolean;
  error: string | null;
}

/**
 * Upload a source file, then queue a preview against a mapping.
 *
 * The upload is the only multipart route in Trade: exactly one part named
 * `file`, up to 50 MiB, and it still needs an idempotency key (the transport
 * attaches one). The mapping id is typed rather than picked from a list
 * because listing mappings needs `trade.import.manage` while this screen needs
 * `trade.import.execute` — a user can hold one grant and not the other.
 */
export function ImportSourcePanel({
  lang,
  sourceId,
  mappingId,
  onSourceIdChange,
  onMappingIdChange,
  onUpload,
  onPreview,
  pending,
  disabled,
  error,
}: ImportSourcePanelProps) {
  const { t } = useI18n();
  const [file, setFile] = useState<UploadFile | null>(null);
  const [rejected, setRejected] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-3">
      <FileUpload
        files={file ? [file] : []}
        accept={IMPORT_SOURCE_ACCEPT}
        maxSizeBytes={IMPORT_SOURCE_MAX_BYTES}
        maxFiles={1}
        disabled={disabled || pending !== null}
        formatBytes={(bytes) => `${formatNumber(Math.round(bytes / 1024), lang)} KB`}
        onFilesAdded={(added) => {
          const next = added[0];
          if (!next) return;
          setRejected(null);
          setFile({ id: next.name, file: next, status: "uploading" });
          void onUpload(next).then(() => setFile({ id: next.name, file: next, status: "ready" }));
        }}
        onRemove={() => setFile(null)}
        onReject={(messages) => {
          setFile(null);
          setRejected(messages[0] ?? null);
        }}
        labels={{
          instruction: t.tradeAutomation.uploadInstruction,
          browse: t.tradeAutomation.uploadBrowse,
          constraint: t.tradeAutomation.uploadConstraint,
          remove: t.tradeAutomation.uploadRemove,
          uploading: t.tradeAutomation.uploadInProgress,
          tooLarge: t.tradeAutomation.uploadTooLarge,
          wrongType: t.tradeAutomation.uploadWrongType,
          tooMany: t.tradeAutomation.uploadTooMany,
        }}
      />

      <div className="grid gap-3 md:grid-cols-2">
        <Field
          label={t.tradeAutomation.sourceId}
          required
          hint={t.tradeAutomation.sourceIdHint}
          error={rejected ?? error ?? undefined}
        >
          <Input
            value={sourceId}
            disabled={disabled || pending !== null}
            onChange={(event) => onSourceIdChange(event.target.value)}
          />
        </Field>
        <Field label={t.tradeAutomation.mappingId} required hint={t.tradeAutomation.mappingIdHint}>
          <Input
            value={mappingId}
            disabled={disabled || pending !== null}
            onChange={(event) => onMappingIdChange(event.target.value)}
          />
        </Field>
      </div>

      <div className="flex justify-end">
        <Button
          variant="outline"
          disabled={disabled || pending !== null}
          loading={pending === "preview"}
          onClick={() => void onPreview()}
        >
          {t.tradeAutomation.queuePreview}
        </Button>
      </div>
    </div>
  );
}
