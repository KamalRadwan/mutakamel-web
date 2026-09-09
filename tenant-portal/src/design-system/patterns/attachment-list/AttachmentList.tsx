"use client";

import { Download, Paperclip, Trash2 } from "lucide-react";
import { formatTemplate } from "@/lib/format/template";
import { cn } from "../../lib/cn";
import { iconSize } from "../../lib/icons";
import { Button } from "../../primitives/Button";
import { FileUpload, type FileUploadProps } from "../../primitives/FileUpload";
import { Skeleton } from "../../primitives/Skeleton";
import { EmptyState } from "../empty-state/EmptyState";

export interface Attachment {
  id: string;
  /** The stored file name, rendered verbatim. */
  name: string;
  /** Already formatted by the caller through Intl — never a raw byte count. */
  size: string;
  /** Already formatted by the caller — a `DateTime` node is fine here. */
  uploadedAt: React.ReactNode;
  uploadedBy?: string;
}

export interface AttachmentListLabels {
  title: string;
  emptyTitle: string;
  emptyDescription?: string;
  /** e.g. "Download {name}". */
  download: string;
  /** e.g. "Delete {name}". */
  delete: string;
  upload: FileUploadProps["labels"];
}

export interface AttachmentListProps
  extends Pick<
    FileUploadProps,
    "files" | "onFilesAdded" | "onRemove" | "onReject" | "accept" | "maxSizeBytes" | "maxFiles" | "formatBytes" | "disabled"
  > {
  attachments: Attachment[];
  isLoading?: boolean;
  onDownload: (attachment: Attachment) => void;
  /** Omit where the caller's `capabilities` response says delete is not permitted. */
  onDelete?: (attachment: Attachment) => void;
  /** Suppresses the drop zone entirely — READ_ONLY, DUNNING, or no write capability. */
  canUpload?: boolean;
  /** Button above the list, or the default drop zone below it. */
  uploadVariant?: FileUploadProps["variant"];
  labels: AttachmentListLabels;
  className?: string;
  density?: "standard" | "compact";
}

/**
 * Stored attachments plus the upload affordance, in one block.
 *
 * Delete is a **plain control here, not a confirmation**. The confirmation is
 * the caller's: an attachment on a record with dependents is a
 * `DeletionBlockerDialog`, an ordinary one is a `ConfirmActionModal`, and this
 * pattern cannot know which. It reports the intent and stops.
 */
export function AttachmentList({
  attachments,
  isLoading,
  onDownload,
  onDelete,
  canUpload = true,
  uploadVariant = "dropzone",
  labels,
  className,
  density = "standard",
  ...upload
}: AttachmentListProps) {
  return (
    <section className={cn("flex flex-col", density === "compact" ? "gap-2" : "gap-3", className)} aria-label={labels.title}>
      {canUpload && uploadVariant === "button" && (
        <FileUpload {...upload} variant="button" labels={labels.upload} />
      )}
      {isLoading ? (
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      ) : attachments.length === 0 ? (
        <EmptyState title={labels.emptyTitle} description={labels.emptyDescription} className={density === "compact" ? "py-4" : undefined} />
      ) : (
        <ul className="flex flex-col gap-1.5">
          {attachments.map((attachment) => (
            <li
              key={attachment.id}
              className={cn("flex items-center gap-2 rounded-sm border border-border bg-card", density === "compact" ? "p-1.5" : "p-2")}
            >
              <Paperclip
                className={cn(iconSize({ size: "lg" }), "text-muted-foreground")}
                aria-hidden="true"
              />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-xs text-foreground">{attachment.name}</span>
                <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="tabular-nums">{attachment.size}</span>
                  <span aria-hidden="true">·</span>
                  {attachment.uploadedAt}
                  {attachment.uploadedBy && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="truncate">{attachment.uploadedBy}</span>
                    </>
                  )}
                </span>
              </div>
              <Button
                variant="ghost"
                size="xs"
                aria-label={formatTemplate(labels.download, { name: attachment.name })}
                onClick={() => onDownload(attachment)}
                className="shrink-0 cursor-pointer"
              >
                <Download className={iconSize({ size: "sm" })} aria-hidden="true" />
              </Button>
              {onDelete && (
                <Button
                  variant="ghost"
                  size="xs"
                  aria-label={formatTemplate(labels.delete, { name: attachment.name })}
                  onClick={() => onDelete(attachment)}
                  className="shrink-0 cursor-pointer text-destructive"
                >
                  <Trash2 className={iconSize({ size: "sm" })} aria-hidden="true" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canUpload && uploadVariant === "dropzone" && <FileUpload {...upload} labels={labels.upload} />}
    </section>
  );
}
