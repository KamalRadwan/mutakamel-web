"use client";

import { useId, useRef, useState } from "react";
import { AlertTriangle, Paperclip, Upload, X } from "lucide-react";
import { formatTemplate } from "@/lib/format/template";
import { cn } from "../lib/cn";
import { iconSize } from "../lib/icons";
import { focusRing } from "../lib/variants";
import { Button } from "./Button";
import { Progress } from "./Progress";

export interface UploadFile {
  /** Stable across renders. The caller owns it; the component never mints one. */
  id: string;
  file: File;
  status: "ready" | "uploading" | "failed";
  /**
   * Real bytes-transferred percentage, 0-100, or omitted.
   *
   * **Omitted is the normal case, and the bar is indeterminate.** `fetch`
   * reports no upload progress and this app calls `fetch` in exactly one file
   * — see docs/build/DECISIONS.md#d14--fileupload-has-no-progress-bar--assumed.
   * Never drive this from a timer: a bar that fills without bytes moving is
   * the fabricated-success failure in
   * docs/design/anti-patterns.md#13-fake-data-and-fake-success.
   */
  progress?: number;
  /** Already-translated failure reason. */
  error?: string;
  /** Object URL for an image preview. The caller creates and revokes it. */
  previewUrl?: string;
}

export interface FileUploadLabels {
  /** e.g. "Drop files here, or browse". */
  instruction: string;
  browse: string;
  /** e.g. "PNG, JPEG or WebP up to {max}". */
  constraint: string;
  remove: string;
  uploading: string;
  /** e.g. "{name} is {size}, over the {max} limit". */
  tooLarge: string;
  /** e.g. "{name} is not an accepted file type". */
  wrongType: string;
  /** e.g. "Only {max} files can be attached". */
  tooMany: string;
}

export interface FileUploadProps {
  files: UploadFile[];
  /** Receives only the files that passed the MIME and size checks. */
  onFilesAdded: (files: File[]) => void;
  onRemove: (id: string) => void;
  /** Already-translated messages for files this component rejected. */
  onReject?: (messages: string[]) => void;
  /** MIME allowlist, exact values — e.g. `["image/png", "image/jpeg"]`. */
  accept: string[];
  /**
   * Hard cap in bytes. Backend caps: branding 2MB, party image 2MB, template
   * asset 5MiB, CRM attachment **25MiB**.
   *
   * This comment said 26MiB until 2026-08-31 (Q42). 26MiB is a real number but
   * a different limit — the Gateway's whole-body ceiling of 27,262,976 bytes,
   * which covers the file *plus* its multipart envelope. The per-file cap is
   * `MAX_SIZE_BYTES[BUCKETS.ATTACHMENTS]` = 25 * 1024 * 1024. Enforcing 26 here
   * admits a file the Gateway takes and crm-app then answers 413.
   */
  maxSizeBytes: number;
  maxFiles?: number;
  /** Renders the byte cap for `constraint` and `tooLarge`; caller formats through Intl. */
  formatBytes: (bytes: number) => string;
  disabled?: boolean;
  /** Compact picker button; uses the same validation and upload queue. */
  variant?: "dropzone" | "button";
  labels: FileUploadLabels;
  className?: string;
}

/**
 * Drag-and-drop plus click, with the MIME allowlist and size cap enforced
 * before anything reaches the caller.
 *
 * Rejections are returned as already-translated strings rather than rendered
 * here, so a screen can decide between an inline list and its own surface.
 */
export function FileUpload({
  files,
  onFilesAdded,
  onRemove,
  onReject,
  accept,
  maxSizeBytes,
  maxFiles,
  formatBytes,
  disabled,
  variant = "dropzone",
  labels,
  className,
}: FileUploadProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function admit(incoming: FileList | null) {
    if (!incoming || disabled) return;
    const candidates = Array.from(incoming);
    const accepted: File[] = [];
    const rejected: string[] = [];

    for (const file of candidates) {
      if (!accept.includes(file.type)) {
        rejected.push(formatTemplate(labels.wrongType, { name: file.name }));
        continue;
      }
      if (file.size > maxSizeBytes) {
        rejected.push(
          formatTemplate(labels.tooLarge, {
            name: file.name,
            size: formatBytes(file.size),
            max: formatBytes(maxSizeBytes),
          }),
        );
        continue;
      }
      if (maxFiles !== undefined && files.length + accepted.length >= maxFiles) {
        rejected.push(formatTemplate(labels.tooMany, { max: maxFiles }));
        continue;
      }
      accepted.push(file);
    }

    if (accepted.length > 0) onFilesAdded(accepted);
    if (rejected.length > 0) onReject?.(rejected);
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {variant === "button" && (
        <Button type="button" variant="outline" size="sm" disabled={disabled}
          className="self-start" onClick={() => inputRef.current?.click()}>
          <Upload className={iconSize({ size: "sm" })} aria-hidden="true" />
          {labels.browse}
        </Button>
      )}
      {/* The drop zone is a label, not a button: it must both open the picker
          on click and stay a valid drop target, and a <button> wrapping a file
          input is neither. The input keeps its own focus ring so keyboard
          users get the native picker. */}
      <label
        hidden={variant === "button"}
        htmlFor={inputId}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          admit(event.dataTransfer.files);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-md border border-dashed border-border",
          "bg-card px-4 py-6 text-center transition-colors hover:bg-accent",
          "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background",
          dragging && "border-primary bg-accent",
          disabled && "pointer-events-none opacity-50",
          variant === "button" && "hidden",
        )}
      >
        <Upload className={cn(iconSize({ size: "xl" }), "text-muted-foreground")} aria-hidden="true" />
        <span className="text-sm text-foreground">{labels.instruction}</span>
        <span className="text-xs text-muted-foreground">
          {formatTemplate(labels.constraint, { max: formatBytes(maxSizeBytes) })}
        </span>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          multiple={maxFiles !== 1}
          accept={accept.join(",")}
          disabled={disabled}
          aria-label={labels.browse}
          onChange={(event) => {
            admit(event.target.files);
            // Without this, re-picking the same file fires no change event.
            event.target.value = "";
          }}
          className={cn("sr-only", focusRing)}
        />
      </label>

      {files.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {files.map((entry) => (
            <li
              key={entry.id}
              className="flex items-center gap-2 rounded-sm border border-border bg-card p-2"
            >
              {entry.previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- an object URL for a file the user just picked; next/image needs a remote or static source and would give this no benefit.
                <img
                  src={entry.previewUrl}
                  alt=""
                  className="size-8 shrink-0 rounded-xs object-cover"
                />
              ) : (
                <Paperclip
                  className={cn(iconSize({ size: "lg" }), "text-muted-foreground")}
                  aria-hidden="true"
                />
              )}

              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="truncate text-xs text-foreground">{entry.file.name}</span>
                {entry.status === "uploading" ? (
                  // Indeterminate unless the caller supplies REAL progress.
                  // See UploadFile.progress and DECISIONS.md D14.
                  <Progress
                    value={entry.progress ?? null}
                    label={formatTemplate(labels.uploading, { name: entry.file.name })}
                  />
                ) : entry.status === "failed" ? (
                  <span className="flex items-center gap-1 text-xs text-destructive">
                    <AlertTriangle className={iconSize({ size: "xs" })} aria-hidden="true" />
                    {entry.error}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {formatBytes(entry.file.size)}
                  </span>
                )}
              </div>

              <Button
                variant="ghost"
                size="xs"
                disabled={disabled}
                aria-label={formatTemplate(labels.remove, { name: entry.file.name })}
                onClick={() => onRemove(entry.id)}
                className="shrink-0 cursor-pointer"
              >
                <X className={iconSize({ size: "sm" })} aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
