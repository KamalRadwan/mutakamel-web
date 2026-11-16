"use client";

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  IdentifierText,
} from "@/design-system";

export interface CompactStatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  tone: "brand" | "positive" | "caution" | "negative";
  icon: React.ReactNode;
  headline?: string;
  lines: string[];
  correlationId?: string;
  correlationLabel?: string;
  primaryLabel: string;
  primaryVariant?: "primary" | "destructive";
  onPrimary: () => void;
  primaryLoading?: boolean;
  secondaryLabel?: string;
  onSecondary?: () => void;
  closeLabel: string;
}

const ICON_BADGE_BY_TONE: Record<CompactStatusDialogProps["tone"], string> = {
  brand: "bg-info-subtle text-info-subtle-foreground",
  positive: "bg-success-subtle text-success-subtle-foreground",
  caution: "bg-warning-subtle text-warning-subtle-foreground",
  negative: "bg-destructive-subtle text-destructive-subtle-foreground",
};

export function CompactStatusDialog({
  open,
  onOpenChange,
  title,
  tone,
  icon,
  headline,
  lines,
  correlationId,
  correlationLabel,
  primaryLabel,
  primaryVariant = "primary",
  onPrimary,
  primaryLoading,
  secondaryLabel,
  onSecondary,
  closeLabel,
}: CompactStatusDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => (primaryLoading ? undefined : onOpenChange(next))}>
      <DialogContent size="lg" closeLabel={closeLabel} className="gap-0 p-0 sm:p-0">
        <DialogHeader className="flex flex-row items-center gap-3 border-b border-border px-5 py-4 pe-14">
          <span
            className={`flex size-10 shrink-0 items-center justify-center rounded-md ${ICON_BADGE_BY_TONE[tone]}`}
          >
            {icon}
          </span>
          <DialogTitle className="text-base font-semibold text-foreground">{title}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-2 px-5 py-4">
          {headline ? (
            <p className="text-sm font-medium text-foreground">
              <bdi dir="auto">{headline}</bdi>
            </p>
          ) : null}
          <DialogDescription asChild>
            <div className="flex flex-col gap-1.5 text-sm text-muted-foreground">
              {lines.map((line, idx) => (
                <p key={idx}>{line}</p>
              ))}
            </div>
          </DialogDescription>
          {correlationId && correlationLabel ? (
            <p className="flex flex-wrap items-baseline gap-1.5 pt-1 text-xs text-muted-foreground">
              <span>{correlationLabel}:</span>
              <IdentifierText>{correlationId}</IdentifierText>
            </p>
          ) : null}
        </div>

        <DialogFooter className="border-t border-border px-5 py-3">
          {secondaryLabel && onSecondary ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onSecondary}
              disabled={primaryLoading}
            >
              {secondaryLabel}
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant={primaryVariant}
            onClick={onPrimary}
            loading={primaryLoading}
          >
            {primaryLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
