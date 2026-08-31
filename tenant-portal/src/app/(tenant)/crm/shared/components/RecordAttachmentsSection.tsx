"use client";

import { useCallback, useState } from "react";
import {
  AmbiguousOutcomePanel,
  AttachmentList,
  ConfirmActionModal,
  DateTime,
  DetailSection,
  ErrorState,
  type Attachment,
  type UploadFile,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import { generateUUIDv7 } from "@/lib/uuid";
import type { CrmActionCapability } from "../crm-capabilities";
import { crmCapabilityAllowsOwner } from "../crm-capabilities";
import {
  CRM_ATTACHMENT_MAX_BYTES,
  CRM_ATTACHMENT_MIME_TYPES,
  crmAttachmentDownloadPath,
  type CrmAttachment,
  type CrmAttachmentSourceType,
} from "../attachments-contract";
import { formatFileSize } from "../format-file-size";
import { useCrmAttachments } from "../hooks/useCrmAttachments";
import { useAmbiguousOutcomeLabels } from "../hooks/useAmbiguousOutcomeLabels";
import { useCrmErrorText } from "../hooks/useCrmErrorText";
import { CrmScopeGate } from "./CrmScopeGate";

export interface RecordAttachmentsSectionProps {
  branchId: string | null;
  sourceType: CrmAttachmentSourceType;
  sourceId: string | null;
  /** The source record's owner — what the backend scope check reads. */
  sourceOwnerUserId: string | null;
  createCapability: CrmActionCapability | null;
  deleteCapability: CrmActionCapability | null;
  readOnly?: boolean;
}

/**
 * Attachments on one CRM record — MASTER-PLAN 8.25.
 *
 * The upload cap passed to `FileUpload` is **25 MiB**, the per-file bucket cap
 * in `MAX_SIZE_BYTES[BUCKETS.ATTACHMENTS]`. See `CRM_ATTACHMENT_MAX_BYTES` for
 * why the plan's "26 MiB" is a different limit.
 *
 * Download is a browser navigation, not a transport call: the route streams
 * bytes and the one `fetch` in this app reads every body as text first, which
 * would corrupt them. `Content-Disposition: attachment` means the page does not
 * navigate away.
 */
export function RecordAttachmentsSection({
  branchId,
  sourceType,
  sourceId,
  sourceOwnerUserId,
  createCapability,
  deleteCapability,
  readOnly = false,
}: RecordAttachmentsSectionProps) {
  const { t, lang } = useI18n();
  const describeError = useCrmErrorText();
  const ambiguousLabels = useAmbiguousOutcomeLabels();
  const attachments = useCrmAttachments({ branchId, sourceType, sourceId });
  const [queue, setQueue] = useState<UploadFile[]>([]);
  const [rejections, setRejections] = useState<string[]>([]);
  const [pendingDelete, setPendingDelete] = useState<CrmAttachment | null>(null);

  const canUpload =
    !readOnly && crmCapabilityAllowsOwner(createCapability, sourceOwnerUserId);
  const canDelete =
    !readOnly && crmCapabilityAllowsOwner(deleteCapability, sourceOwnerUserId);

  const formatBytes = useCallback(
    (bytes: number) => formatFileSize(bytes, lang),
    [lang],
  );

  // The backend takes exactly one file per request (`limits.files: 1`), so a
  // multi-file drop is uploaded one at a time rather than rejected.
  async function uploadAll(files: File[]) {
    for (const file of files) {
      const id = generateUUIDv7();
      setQueue((current) => [...current, { id, file, status: "uploading" }]);
      const uploaded = await attachments.upload(file);
      setQueue((current) =>
        uploaded
          ? current.filter((entry) => entry.id !== id)
          : current.map((entry) =>
              entry.id === id ? { ...entry, status: "failed" } : entry,
            ),
      );
      if (!uploaded) break;
    }
  }

  const uploadFailureText = attachments.uploadFailure
    ? t.crmAttachments.uploadFailures[attachments.uploadFailure]
    : null;
  const deleteErrorText = describeError(attachments.writeError);

  const rows: Attachment[] = attachments.attachments.map((attachment) => ({
    id: attachment.id,
    name: attachment.fileName,
    size: formatFileSize(attachment.sizeBytes, lang),
    uploadedAt: <DateTime value={attachment.createdAt} precision="datetime" />,
  }));

  return (
    <DetailSection
      title={t.attachments.title}
      description={formatTemplate(t.crmAttachments.constraint, {
        max: formatBytes(CRM_ATTACHMENT_MAX_BYTES),
      })}
    >
      {attachments.loadError?.status === 403 ? (
        <CrmScopeGate />
      ) : (
        <div className="flex flex-col gap-3">
          {uploadFailureText && (
            <ErrorState
              title={t.crmAttachments.uploadFailedTitle}
              description={uploadFailureText}
              onRetry={attachments.clearUploadFailure}
              retryLabel={t.common.dismiss}
            />
          )}

          {rejections.length > 0 && (
            <ErrorState
              title={t.crmAttachments.rejectedTitle}
              description={rejections.join(" ")}
              onRetry={() => setRejections([])}
              retryLabel={t.common.dismiss}
            />
          )}

          {deleteErrorText && (
            <ErrorState
              title={t.crmAttachments.deleteFailedTitle}
              description={deleteErrorText}
              onRetry={attachments.clearWriteError}
              retryLabel={t.common.dismiss}
            />
          )}

          {attachments.ambiguity && (
            <AmbiguousOutcomePanel
              operation={
                t.crmAttachments.operations[attachments.ambiguity.operation]
              }
              idempotencyKey={attachments.ambiguity.attempt.idempotencyKey}
              description={t.crmAttachments.ambiguousDescription}
              correlationId={attachments.ambiguity.error.correlationId}
              onRetry={() => void attachments.ambiguity?.replay()}
              onDismiss={attachments.dismissAmbiguity}
              labels={ambiguousLabels}
            />
          )}

          {attachments.loadError && !attachments.isLoading ? (
            <ErrorState
              title={t.crmAttachments.loadFailed}
              description={describeError(attachments.loadError) ?? undefined}
              onRetry={attachments.reload}
              retryLabel={t.common.retry}
            />
          ) : (
            <AttachmentList
              attachments={rows}
              isLoading={attachments.isLoading}
              canUpload={canUpload}
              onDownload={(attachment) => {
                window.location.href = crmAttachmentDownloadPath(attachment.id);
              }}
              onDelete={
                canDelete
                  ? (attachment) => {
                      const target = attachments.attachments.find(
                        ({ id }) => id === attachment.id,
                      );
                      if (target) setPendingDelete(target);
                    }
                  : undefined
              }
              files={queue}
              onFilesAdded={(files) => void uploadAll(files)}
              onRemove={(id) =>
                setQueue((current) => current.filter((entry) => entry.id !== id))
              }
              onReject={setRejections}
              accept={[...CRM_ATTACHMENT_MIME_TYPES]}
              maxSizeBytes={CRM_ATTACHMENT_MAX_BYTES}
              formatBytes={formatBytes}
              labels={{
                title: t.attachments.title,
                emptyTitle: t.attachments.emptyTitle,
                emptyDescription: t.attachments.emptyDescription,
                download: t.attachments.download,
                delete: t.attachments.delete,
                upload: t.fileUpload,
              }}
            />
          )}
        </div>
      )}

      <ConfirmActionModal
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title={t.crmAttachments.deleteTitle}
        description={formatTemplate(t.crmAttachments.deleteDescription, {
          name: pendingDelete?.fileName ?? "",
        })}
        confirmLabel={t.common.confirmDelete}
        cancelLabel={t.common.cancel}
        loading={attachments.pendingId !== null}
        onConfirm={() => {
          const target = pendingDelete;
          if (!target) return;
          void attachments.remove(target.id).then((removed) => {
            if (removed) setPendingDelete(null);
          });
        }}
      />
    </DetailSection>
  );
}
