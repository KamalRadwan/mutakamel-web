"use client";

import { Building2, Check, ExternalLink, Sparkles, UserRound } from "lucide-react";
import { Button, cn } from "@/design-system";
import { localizedName } from "@/lib/format/localized";
import type { LeadBoardQuickAddProps } from "./lead-board-types";
import { useLeadBoardQuickAdd } from "./useLeadBoardQuickAdd";
import { LeadBoardQuickAddIndividual } from "./LeadBoardQuickAddIndividual";
import { LeadBoardQuickAddCompany } from "./LeadBoardQuickAddCompany";
import { LeadRatingStars } from "./LeadRatingStars";

export function LeadBoardQuickAddCard(props: LeadBoardQuickAddProps) {
  const form = useLeadBoardQuickAdd(props);
  const { t, lang, stage, profileType, rating, isSubmitting, handleOpenFullModal, onCancel, handleQuickSave, changeProfileType, changeRating } = form;
  return (
    <div className="flex flex-col gap-2.5 rounded-card border border-line-card bg-card p-3 shadow-card">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1 text-xs font-semibold text-success">
          <Sparkles className="size-3.5 text-success" aria-hidden="true" />
          <span>
            {t.crmLeads.executive.quickAddInStage(localizedName(stage, lang))}
          </span>
        </span>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          onClick={handleOpenFullModal}
          className="inline-flex h-auto items-center gap-0.5 px-1 py-0 text-xs font-semibold text-success hover:bg-transparent hover:underline"
        >
          <span>{t.crmLeads.executive.fullModal}</span>
          <ExternalLink className="size-2.5" aria-hidden="true" />
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
        <Button
          type="button"
          variant="ghost"
          size="xs"
          onClick={() => changeProfileType("INDIVIDUAL")}
          className={cn(
            "flex items-center justify-center gap-1 rounded-md py-1 text-xs font-semibold transition-all",
            profileType === "INDIVIDUAL"
              ? "bg-card text-primary shadow-2xs"
              : "text-muted-foreground",
          )}
        >
          <UserRound className="size-3.5" aria-hidden="true" />
          <span>{t.crmLeads.executive.individual}</span>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          onClick={() => changeProfileType("CORPORATE")}
          className={cn(
            "flex items-center justify-center gap-1 rounded-md py-1 text-xs font-semibold transition-all",
            profileType === "CORPORATE"
              ? "bg-card text-primary shadow-2xs"
              : "text-muted-foreground",
          )}
        >
          <Building2 className="size-3.5" aria-hidden="true" />
          <span>{t.crmLeads.executive.company}</span>
        </Button>
      </div>

      {profileType === "INDIVIDUAL" ? (
        <LeadBoardQuickAddIndividual form={form} />
      ) : (
        <LeadBoardQuickAddCompany form={form} />
      )}

      <div className="flex items-center justify-between gap-2 pt-1">
        <LeadRatingStars rating={rating} canUpdate={!isSubmitting} onRate={changeRating} />

        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={onCancel}
            disabled={isSubmitting}
            className="rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-muted"
          >
            {t.crmLeads.executive.cancel}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="xs"
            disabled={isSubmitting}
            onClick={() => void handleQuickSave()}
            className="inline-flex items-center gap-1 rounded-lg bg-card px-3 py-1 text-xs font-semibold text-primary hover:bg-surface-subtle disabled:opacity-50"
          >
            <Check className="size-3.5" aria-hidden="true" />
            <span>{t.crmLeads.executive.save}</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
