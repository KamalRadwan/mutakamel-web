"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { formatTemplate } from "@/lib/format/template";
import { cn } from "../../lib/cn";
import { iconSize } from "../../lib/icons";
import { Button } from "../../primitives/Button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../primitives/Dialog";

export interface DeletionBlocker {
  id: string;
  /** Already translated — "Branches", "Team members", "Open opportunities". */
  label: string;
  /** Already formatted through `Intl` by the caller. Never a raw number here. */
  count?: string;
  /** A few of the blocking records by name. The caller truncates; this does not. */
  examples?: string[];
  /** Where the user goes to deal with them. */
  href?: string;
}

export interface DeletionBlockerDialogLabels {
  title: string;
  /** Explains that the record cannot be deleted until the listed items are dealt with. */
  description: string;
  /** Heading above the list, e.g. "What is blocking it". */
  blockersHeading: string;
  /** Template for a blocker's link, e.g. "View {label}". */
  view: string;
  close: string;
}

export interface DeletionBlockerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The record the user tried to delete. Already the display name. */
  recordName: string;
  blockers: DeletionBlocker[];
  labels: DeletionBlockerDialogLabels;
}

/**
 * The 409-with-reasons surface: a company that still has branches, a branch
 * that still has departments, a team that still has placed users.
 *
 * `ConfirmActionModal` cannot host this — it has one description string and no
 * slot for a list, so today those 409s render as a bare "failed" and the user
 * is left to guess what is holding the record. Task 4.10 turns that into "the
 * reason, never a bare failure".
 *
 * **There is no confirm button and no "delete anyway".** The backend has
 * already refused; offering an action that is guaranteed to fail is worse than
 * offering none — the same reasoning that keeps a retry off `NotFoundState`.
 */
export function DeletionBlockerDialog({
  open,
  onOpenChange,
  recordName,
  blockers,
  labels,
}: DeletionBlockerDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* One dismissal control, not two. The built-in corner X carries a
          hard-coded English "Close" in its sr-only span, so a second one would
          also be the only untranslated string in this dialog. */}
      <DialogContent size="lg" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle
              className={cn(iconSize({ size: "xl" }), "text-caution-700 dark:text-caution-400")}
              aria-hidden="true"
            />
            {labels.title}
          </DialogTitle>
          <DialogDescription>{labels.description}</DialogDescription>
        </DialogHeader>

        <p className="text-sm font-medium text-foreground">{recordName}</p>

        <section className="flex flex-col gap-2">
          <h3 className="text-xs font-medium text-muted-foreground">{labels.blockersHeading}</h3>
          <ul className="flex flex-col gap-1.5">
            {blockers.map((blocker) => (
              <li
                key={blocker.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-sm border border-border bg-card p-2"
              >
                <div className="flex min-w-0 flex-col">
                  <span className="text-xs font-medium text-foreground">
                    {blocker.label}
                    {blocker.count && (
                      <span className="ms-1 text-muted-foreground tabular-nums">
                        <bdi>{blocker.count}</bdi>
                      </span>
                    )}
                  </span>
                  {blocker.examples && blocker.examples.length > 0 && (
                    <span className="truncate text-xs text-muted-foreground">
                      {blocker.examples.join(", ")}
                    </span>
                  )}
                </div>
                {blocker.href && (
                  <Button variant="outline" size="xs" asChild className="shrink-0 cursor-pointer">
                    <Link href={blocker.href}>
                      {formatTemplate(labels.view, { label: blocker.label })}
                    </Link>
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </section>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="cursor-pointer">
            {labels.close}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
