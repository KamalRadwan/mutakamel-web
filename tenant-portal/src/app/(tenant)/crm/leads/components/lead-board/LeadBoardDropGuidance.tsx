"use client";

import { Check, Lock, AlertTriangle } from "lucide-react";
import { localizedName } from "@/lib/format/localized";
import type { LeadStage } from "../../lead-list-contract";
import type { useLeadBoard } from "./useLeadBoard";

type Board = ReturnType<typeof useLeadBoard>;

export function LeadBoardDropGuidance({ stage, board, isDraggingOver }: { stage: LeadStage; board: Board; isDraggingOver: boolean }) {
  const { t, lang, draggingLeadId, draggingLead } = board;
  const isTerminal = stage.flag === "CONVERTED";
  const isDisqualified = stage.flag === "DISQUALIFIED";
  const isQualified = stage.flag === "QUALIFIED";
  return <>
    {draggingLeadId && draggingLead?.stageId !== stage.id && !isTerminal && !isDisqualified && isDraggingOver && (
      <div className="flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-success bg-success/10 p-3 text-center">
        <span className="flex size-6 items-center justify-center rounded-full bg-success text-success-foreground">
          <Check className="size-3.5" aria-hidden="true" />
        </span>
        <span className="text-xs font-semibold text-success">
          {t.crmLeads.executive.releaseToMove(localizedName(stage, lang))}
        </span>
        <span className="text-xs text-success/90">
          {isQualified
            ? t.crmLeads.executive.qualifiedMoveHint
            : t.crmLeads.executive.stageMoveHint}
        </span>
      </div>
    )}

    {draggingLeadId && isDisqualified && (
      <div className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-destructive/50 bg-destructive/10 px-3 py-2 text-center text-xs font-semibold text-destructive">
        <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />
        <span>
          {t.crmLeads.executive.disqualifiedMoveHint}
        </span>
      </div>
    )}

    {draggingLeadId && isTerminal && (
      <div className="my-auto flex flex-col items-center justify-center gap-2 rounded-lg border border-primary/30 bg-card p-4 text-center shadow-xs">
        <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Lock className="size-4" aria-hidden="true" />
        </span>
        <p className="text-xs font-semibold text-foreground">
          {t.crmLeads.executive.protectedStage}
        </p>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {t.crmLeads.executive.protectedStageHint}
        </p>
      </div>
    )}

  </>;
}
