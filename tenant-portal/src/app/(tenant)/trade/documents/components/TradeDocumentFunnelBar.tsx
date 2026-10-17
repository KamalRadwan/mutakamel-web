"use client";

import * as React from "react";
import { FilterX } from "lucide-react";
import { Button, IdentifierText } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";

export type TradeFunnelTone = "blue" | "emerald" | "amber" | "rose" | "violet";

export interface TradeFunnelStepItem {
  status: string;
  label: string;
  count: number;
  tone: TradeFunnelTone;
}

export interface TradeDocumentFunnelBarProps {
  steps: TradeFunnelStepItem[];
  activeStatus: string;
  onSelectStatus: (status: string) => void;
}

const STEP_TONE_CLASS: Record<TradeFunnelTone, string> = {
  blue: "trade-funnel-step-blue",
  emerald: "trade-funnel-step-emerald",
  amber: "trade-funnel-step-amber",
  rose: "trade-funnel-step-rose",
  violet: "trade-funnel-step-violet",
};

export function TradeDocumentFunnelBar({
  steps,
  activeStatus,
  onSelectStatus,
}: TradeDocumentFunnelBarProps) {
  const { t } = useI18n();
  const td = t.tradeDocuments;

  return (
    <div className="trade-funnel-bar" role="region" aria-label={td.executive.funnelTitle}>
      <span className="px-2 text-xs font-semibold text-muted-foreground">
        {td.executive.funnelTitle}
      </span>
      <div className="flex flex-1 flex-wrap items-center gap-1.5">
        {steps.map((step) => {
          const isActive = activeStatus === step.status;
          return (
            <Button
              key={step.status}
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onSelectStatus(isActive ? "" : step.status)}
              aria-pressed={isActive}
              className={`trade-funnel-step ${STEP_TONE_CLASS[step.tone]} ${
                isActive ? "active" : ""
              }`}
            >
              <span>{step.label}</span>
              <span className="trade-funnel-count">
                <IdentifierText>{String(step.count)}</IdentifierText>
              </span>
            </Button>
          );
        })}
      </div>
      {activeStatus !== "" ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onSelectStatus("")}
          className="text-xs text-muted-foreground"
        >
          <FilterX className="me-1 h-3.5 w-3.5" aria-hidden />
          {td.executive.clearFilter}
        </Button>
      ) : null}
    </div>
  );
}
