"use client";

import { Download, X } from "lucide-react";
import {
  Button,
  DegradedBanner,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Progress,
  cn,
  proseMeasure,
} from "@/design-system";

interface SearchExportLabelSet {
  trigger: string;
  menuLabel: string;
  /** "Rows on this screen (25)" — the honest name for the cheap export. */
  previewOption: string;
  /** "All matching rows (4,300)" — or the capped form when a bound bites. */
  allOption: string;
  /** Stated up front, not after the fact, when the cap will truncate. */
  capNotice: string | null;
  progressLabel: string;
  progressValueText: string;
  cancel: string;
  truncatedNotice: string | null;
  failureNotice: string | null;
  dismiss: string;
  /** No source returned rows, so there is nothing to write. */
  disabledReason: string;
}

interface SearchExportControlsProps {
  labels: SearchExportLabelSet;
  canExport: boolean;
  isExporting: boolean;
  progressPercent: number | null;
  onExportPreview: () => void;
  onExportAll: () => void;
  onCancel: () => void;
  onDismissNotice: () => void;
}

/**
 * The export control — MASTER-PLAN 13.22.
 *
 * Two named options rather than one "Export" button. A single control that
 * says "Export" and delivers whatever happened to be loaded is the specific
 * lie this task exists to avoid, so both the scope and the row count are in
 * the option's own label, and a bound that will truncate the file is stated
 * BEFORE the download rather than discovered in a spreadsheet afterwards.
 */
export function SearchExportControls({
  labels,
  canExport,
  isExporting,
  progressPercent,
  onExportPreview,
  onExportAll,
  onCancel,
  onDismissNotice,
}: SearchExportControlsProps) {
  return (
    <div className="flex flex-col items-stretch gap-2">
      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              disabled={!canExport || isExporting}
              aria-label={canExport ? undefined : labels.disabledReason}
            >
              <Download className="size-4" aria-hidden="true" />
              {labels.trigger}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
            <DropdownMenuLabel>{labels.menuLabel}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onExportPreview}>
              {labels.previewOption}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onExportAll}>
              {labels.allOption}
            </DropdownMenuItem>
            {labels.capNotice ? (
              <>
                <DropdownMenuSeparator />
                <p className={cn("px-2 py-1.5 text-xs text-muted-foreground", proseMeasure)}>
                  {labels.capNotice}
                </p>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>

        {isExporting ? (
          <Button variant="ghost" size="sm" onClick={onCancel}>
            <X className="size-4" aria-hidden="true" />
            {labels.cancel}
          </Button>
        ) : null}
      </div>

      {isExporting ? (
        <Progress
          value={progressPercent}
          label={labels.progressLabel}
          valueText={labels.progressValueText}
        />
      ) : null}

      {labels.truncatedNotice ? (
        <DegradedBanner message={labels.truncatedNotice} />
      ) : null}

      {labels.failureNotice ? (
        <div className="flex items-start gap-2">
          <DegradedBanner message={labels.failureNotice} className="grow" />
          <Button variant="ghost" size="sm" onClick={onDismissNotice}>
            {labels.dismiss}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
