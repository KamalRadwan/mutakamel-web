"use client";

import { Check, Sparkles } from "lucide-react";
import { Button, cn } from "@/design-system";
import { localizedName } from "@/lib/format/localized";
import type { useLeadBoard } from "./useLeadBoard";

type Board = ReturnType<typeof useLeadBoard>;

export function LeadBoardQuickDropDock({ board }: { board: Board }) {
  const { t, lang, stages, draggingLead, dropOnStage, isMovePending, canUpdate } = board;
  if (!draggingLead) return null;
  return (
    <div className="fixed inset-x-0 bottom-4 z-(--z-sticky-header) mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-popover px-4 py-2.5 text-popover-foreground shadow-pop">
      <div className="flex items-center gap-2 text-xs font-semibold text-warning">
        <Sparkles className="size-4" aria-hidden="true" />
        <span>{t.crmLeads.executive.quickDropStage}</span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {stages.map((st) => {
          const isCurrent = st.id === draggingLead.stageId;
          const isTerm = st.flag === "CONVERTED";
          const isQual = st.flag === "QUALIFIED";
          const isDisq = st.flag === "DISQUALIFIED";
          return (
            <Button
              key={st.id}
              type="button"
              variant="ghost"
              size="xs"
              disabled={isCurrent || isMovePending || !canUpdate(draggingLead)}
              onClick={() => dropOnStage(st)}
              className={cn(
                "inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold transition-all",
                isCurrent
                  ? "border-border bg-muted/50 text-muted-foreground"
                  : isTerm
                    ? "border-primary bg-primary/20 text-primary hover:bg-primary/30"
                    : isQual
                      ? "border-success bg-success/20 text-success hover:bg-success/30"
                      : isDisq
                        ? "border-destructive/70 bg-destructive/20 text-destructive hover:bg-destructive/30"
                        : "border-border bg-card text-foreground hover:bg-muted",
              )}
            >
              {isQual && <Check className="size-3" aria-hidden="true" />}
              {isTerm && <Sparkles className="size-3" aria-hidden="true" />}
              <span>
                {isTerm
                  ? t.crmLeads.executive.convertToCustomer
                  : localizedName(st, lang)}
              </span>
            </Button>
          );
        })}
      </div>
    </div>
  );
}
