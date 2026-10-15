"use client";

import { Check, ChevronDown } from "lucide-react";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  cn,
  iconSize,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { localizedName } from "@/lib/format/localized";
import { formatTemplate } from "@/lib/format/template";
import type { LeadItem, LeadStage } from "../../hooks/useLeads";
import { LeadStageBadge } from "./LeadStageBadge";

export interface LeadStageCellProps {
  lead: LeadItem;
  stage: LeadStage | undefined;
  /** Every stage a lead may move to; a converted stage is never one. */
  targets: readonly LeadStage[];
  /** False without the update capability, and for a converted lead. */
  canMove: boolean;
  onMove: (stageId: string) => void;
}

/** The stage badge, opening a single-pointer stage move when the lead may move. */
export function LeadStageCell({ lead, stage, targets, canMove, onMove }: LeadStageCellProps) {
  const { t, lang } = useI18n();
  if (!canMove) return <LeadStageBadge stage={stage} />;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="xs"
          className="gap-1 px-1"
          aria-label={formatTemplate(t.crmLeadViews.changeStage, { name: lead.leadName })}
        >
          <LeadStageBadge stage={stage} />
          <ChevronDown className={cn(iconSize({ size: "sm" }), "text-muted-foreground")} aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>{t.views.moveTo}</DropdownMenuLabel>
        {targets.map((target) => (
          <DropdownMenuItem
            key={target.id}
            disabled={target.id === lead.stageId}
            onSelect={() => onMove(target.id)}
            className="justify-between gap-3"
          >
            <span>{localizedName(target, lang)}</span>
            {target.id === lead.stageId && (
              <Check className={iconSize({ size: "sm" })} aria-hidden="true" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
