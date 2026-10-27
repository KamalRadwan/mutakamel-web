"use client";

import type { ReactNode } from "react";
import { CircleX, Inbox, Plus, Sprout } from "lucide-react";
import { Button, cn } from "@/design-system";

type EmptyStageIconKind = "inbox" | "sprout" | "closed";

function emptyStageBadge(icon: EmptyStageIconKind): {
  badgeClass: string;
  glyph: ReactNode;
} {
  if (icon === "sprout") {
    return {
      badgeClass: "bg-entity-company-surface text-entity-company-fg",
      glyph: <Sprout className="size-5" aria-hidden="true" />,
    };
  }
  if (icon === "closed") {
    return {
      badgeClass: "bg-count-danger-surface text-count-danger-fg",
      glyph: <CircleX className="size-5" aria-hidden="true" />,
    };
  }
  return {
    badgeClass: "bg-count-zero-surface text-count-zero-fg",
    glyph: <Inbox className="size-5" aria-hidden="true" />,
  };
}

export function CrmBoardEmptyStage({
  title,
  hint,
  icon = "inbox",
  quickAddLabel,
  onQuickAdd,
  className,
}: {
  title: string;
  hint: string;
  icon?: EmptyStageIconKind;
  quickAddLabel?: string;
  onQuickAdd?: () => void;
  className?: string;
}) {
  const { badgeClass, glyph } = emptyStageBadge(icon);
  const canQuickAdd = Boolean(onQuickAdd && quickAddLabel);

  return (
    <div
      className={cn(
        "flex min-h-40 flex-1 flex-col items-center justify-center gap-3 rounded-card border-[1.5px] border-dashed border-line-control bg-card/70 px-5 py-8 text-center",
        className,
      )}
    >
      <span
        data-testid="empty-stage-icon-badge"
        className={cn(
          "inline-flex size-12 shrink-0 items-center justify-center rounded-card",
          badgeClass,
        )}
      >
        {glyph}
      </span>

      <div className="flex flex-col items-center gap-1">
        <p className="text-tab font-bold text-foreground">{title}</p>
        <p className="max-w-[220px] text-caption leading-relaxed text-muted-foreground">
          {hint}
        </p>
      </div>

      {canQuickAdd && (
        <Button
          type="button"
          variant="outline"
          onClick={onQuickAdd}
          className="mt-1 h-[34px] gap-1.5 rounded-lg border border-line-control bg-card px-3.5 font-bold text-primary shadow-2xs not-disabled:hover:bg-count-active-surface"
        >
          <Plus className="size-3.5" aria-hidden="true" />
          <span className="text-caption">{quickAddLabel}</span>
        </Button>
      )}
    </div>
  );
}
