"use client";

import { forwardRef, useImperativeHandle, useRef, useState, type ReactNode } from "react";
import { cn } from "../lib/cn";
import { screenUploadFiles, type UploadScreeningLabels } from "../lib/upload-screening";
import { Button } from "./Button";

export interface ImageUploadTileHandle {
  /** Opens the native picker, for a separate "Replace image" control. */
  openPicker: () => void;
}

export interface ImageUploadTileProps {
  /** Accessible name, e.g. "Add item image". The tile content is decorative. */
  label: string;
  /** MIME allowlist, exact values. */
  accept: readonly string[];
  maxSizeBytes: number;
  /** Renders the byte cap for `labels.tooLarge`; caller formats through Intl. */
  formatBytes: (bytes: number) => string;
  labels: Pick<UploadScreeningLabels, "tooLarge" | "wrongType">;
  /** Receives one file that passed the MIME and size checks. */
  onFileAdded: (file: File) => void;
  /** Already-translated messages for a file this tile rejected. */
  onReject: (messages: string[]) => void;
  disabled?: boolean;
  /** Marks the tile busy while the caller's upload is in flight. */
  busy?: boolean;
  /** Id of the element holding the tile's status or error. */
  describedBy?: string;
  className?: string;
  /** The tile face: an icon, a preview or a thumbnail. */
  children: ReactNode;
}

/**
 * A square image tile that is itself the picker: click, Enter or Space opens
 * the native file dialog, and an image dropped onto it is admitted the same
 * way. One file at a time, screened by the same MIME and size checks as
 * `FileUpload`.
 *
 * The tile is a `Button`, not a `<label>` like the `FileUpload` drop zone,
 * because it has a name of its own ("Add item image") and its face is an
 * image: a label's content would become the input's name.
 */
export const ImageUploadTile = forwardRef<ImageUploadTileHandle, ImageUploadTileProps>(
  function ImageUploadTile(
    {
      label,
      accept,
      maxSizeBytes,
      formatBytes,
      labels,
      onFileAdded,
      onReject,
      disabled,
      busy,
      describedBy,
      className,
      children,
    },
    ref,
  ) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [dragging, setDragging] = useState(false);

    useImperativeHandle(ref, () => ({ openPicker: () => inputRef.current?.click() }), []);

    function admit(incoming: FileList | null) {
      if (!incoming || disabled) return;
      // The tile holds one image; any extra dropped file is ignored rather
      // than rejected, so the first one is never lost to a count error.
      const { accepted, rejected } = screenUploadFiles(Array.from(incoming).slice(0, 1), {
        accept,
        maxSizeBytes,
        formatBytes,
        labels,
      });
      if (accepted[0]) onFileAdded(accepted[0]);
      if (rejected.length > 0) onReject(rejected);
    }

    return (
      <>
        <Button
          variant="ghost"
          aria-label={label}
          aria-describedby={describedBy}
          aria-busy={busy || undefined}
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
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
            "relative h-auto shrink-0 overflow-visible p-0 not-disabled:hover:bg-transparent",
            dragging && "ring-2 ring-primary ring-offset-2 ring-offset-background",
            className,
          )}
        >
          {children}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept={accept.join(",")}
          disabled={disabled}
          tabIndex={-1}
          aria-hidden="true"
          className="sr-only"
          onChange={(event) => {
            admit(event.target.files);
            // Without this, re-picking the same file fires no change event.
            event.target.value = "";
          }}
        />
      </>
    );
  },
);
