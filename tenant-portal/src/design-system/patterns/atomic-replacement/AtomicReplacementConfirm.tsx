"use client";

import { useId, useState } from "react";
import { ChevronDown, Minus, Plus } from "lucide-react";
import { formatTemplate } from "@/lib/format/template";
import { cn } from "../../lib/cn";
import { iconSize } from "../../lib/icons";
import { Button } from "../../primitives/Button";
import { Checkbox } from "../../primitives/Checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../../primitives/Collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../primitives/Dialog";
import { Label } from "../../primitives/Label";
import { isEmptyDiff, type ReplacementDiff, type ReplacementItem } from "./replacement-diff";

export interface AtomicReplacementConfirmLabels {
  title: string;
  description: string;
  /** Templates taking `{count}`, already formatted through `Intl` by the caller. */
  addedHeading: string;
  removedHeading: string;
  unchangedHeading: string;
  noChanges: string;
  confirm: string;
  cancel: string;
  /** When set, the confirm is gated on a checkbox. Use it wherever anything is removed. */
  acknowledge?: string;
}

export interface AtomicReplacementConfirmProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  diff: ReplacementDiff;
  onConfirm: () => void;
  loading?: boolean;
  /** Formats a group count for its heading. Keeps `Intl` and its locale at the caller. */
  formatCount: (count: number) => string;
  labels: AtomicReplacementConfirmLabels;
}

function ItemGroup({
  heading,
  items,
  tone,
}: {
  heading: string;
  items: ReplacementItem[];
  tone: "added" | "removed";
}) {
  if (items.length === 0) return null;
  const Icon = tone === "added" ? Plus : Minus;

  return (
    <section className="flex flex-col gap-1">
      <h3
        className={cn(
          "text-xs font-medium",
          tone === "added"
            ? "text-positive-800 dark:text-positive-300"
            : "text-negative-800 dark:text-negative-300",
        )}
      >
        {heading}
      </h3>
      <ul className="flex flex-col gap-1">
        {items.map((item) => (
          <li
            key={item.id}
            className={cn(
              "flex items-start gap-2 rounded-sm border p-2 text-xs",
              tone === "added"
                ? "border-positive-200 bg-positive-100 dark:border-positive-800 dark:bg-positive-950"
                : "border-negative-200 bg-negative-100 dark:border-negative-800 dark:bg-negative-950",
            )}
          >
            <Icon className={cn(iconSize({ size: "sm" }), "mt-0.5")} aria-hidden="true" />
            <span className="flex min-w-0 flex-col">
              <span className="font-medium text-foreground">{item.label}</span>
              {item.hint && <span className="text-muted-foreground">{item.hint}</span>}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * The pre-write diff for a full-replacement `PUT`.
 *
 * `PUT /users/:id/team-memberships` (4.15) and
 * `PUT /users/:userId/scope-role-assignments` (4.21) replace the entire
 * collection atomically. The request body describes only the destination, so
 * **what is being taken away is invisible in the payload** — a user who edits a
 * list of eight and saves has no way to see that three assignments just
 * disappeared. These are the most destructive writes in Core, and they look
 * exactly like an ordinary save.
 *
 * This dialog is the thing that makes the removal visible **before** the write.
 * Additions and removals are always expanded; unchanged rows collapse, because
 * they are the part nobody needs to read.
 */
export function AtomicReplacementConfirm({
  open,
  onOpenChange,
  diff,
  onConfirm,
  loading,
  formatCount,
  labels,
}: AtomicReplacementConfirmProps) {
  const [acknowledged, setAcknowledged] = useState(false);
  const acknowledgeId = useId();

  const nothingChanges = isEmptyDiff(diff);
  const needsAcknowledgement = Boolean(labels.acknowledge) && diff.removed.length > 0;
  const blocked = loading || nothingChanges || (needsAcknowledgement && !acknowledged);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (loading) return;
        // The acknowledgement is per attempt. Carrying it across a reopen
        // would let a second, different removal inherit the first one's
        // consent.
        if (!next) setAcknowledged(false);
        onOpenChange(next);
      }}
    >
      <DialogContent size="lg" aria-busy={loading || undefined}>
        <DialogHeader>
          <DialogTitle>{labels.title}</DialogTitle>
          <DialogDescription>{labels.description}</DialogDescription>
        </DialogHeader>

        <div className="flex max-h-96 flex-col gap-3 overflow-y-auto">
          {nothingChanges ? (
            <p className="text-sm text-muted-foreground">{labels.noChanges}</p>
          ) : (
            <>
              <ItemGroup
                heading={formatTemplate(labels.removedHeading, { count: formatCount(diff.removed.length) })}
                items={diff.removed}
                tone="removed"
              />
              <ItemGroup
                heading={formatTemplate(labels.addedHeading, { count: formatCount(diff.added.length) })}
                items={diff.added}
                tone="added"
              />
            </>
          )}

          {diff.unchanged.length > 0 && (
            <Collapsible>
              <CollapsibleTrigger className="group text-xs text-muted-foreground hover:text-foreground">
                {formatTemplate(labels.unchangedHeading, { count: formatCount(diff.unchanged.length) })}
                <ChevronDown
                  className={cn(iconSize({ size: "sm" }), "group-data-[state=open]:rotate-180")}
                  aria-hidden="true"
                />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <ul className="flex flex-col gap-1 pt-1.5">
                  {diff.unchanged.map((item) => (
                    <li key={item.id} className="rounded-sm border border-border p-2 text-xs text-muted-foreground">
                      {item.label}
                    </li>
                  ))}
                </ul>
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>

        {needsAcknowledgement && labels.acknowledge && (
          <div className="flex items-start gap-2">
            <Checkbox
              id={acknowledgeId}
              checked={acknowledged}
              onCheckedChange={(next) => setAcknowledged(next === true)}
              disabled={loading}
              className="mt-0.5"
            />
            <Label htmlFor={acknowledgeId} className="cursor-pointer text-xs font-normal">
              {formatTemplate(labels.acknowledge, { count: formatCount(diff.removed.length) })}
            </Label>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="cursor-pointer"
          >
            {labels.cancel}
          </Button>
          <Button
            variant={diff.removed.length > 0 ? "destructive" : "primary"}
            onClick={onConfirm}
            loading={loading}
            disabled={blocked}
            className="cursor-pointer"
          >
            {labels.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
