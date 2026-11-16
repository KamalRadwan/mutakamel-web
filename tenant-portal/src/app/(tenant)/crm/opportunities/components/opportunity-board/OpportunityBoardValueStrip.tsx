import { Banknote, Calendar, CirclePercent } from "lucide-react";
import { DateTime, Money, cn } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatNumber } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import type { OpportunityCardRecord } from "../../hooks/pipeline-types";
import { opportunityProbabilityClass } from "../opportunity-card/opportunity-card-presentation";

export function OpportunityBoardValueStrip({ item }: {
  item: Pick<OpportunityCardRecord, "amount" | "currencyCode" | "probabilityPercent" | "expectedCloseDate">;
}) {
  const { t, lang } = useI18n();
  if (!item.amount && item.probabilityPercent === null && !item.expectedCloseDate) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-1.5 rounded-md border border-line-card bg-surface-subtle px-2.5 py-1.5 text-caption">
      <div className="flex items-center gap-1.5 font-semibold text-success">
        <Banknote className="size-3.5 shrink-0" aria-hidden="true" />
        {item.amount ? <Money value={item.amount} currency={item.currencyCode ?? undefined} language={lang} /> : <span>—</span>}
      </div>
      <div className="flex flex-wrap items-center gap-2 text-caption text-muted-foreground">
        {item.probabilityPercent !== null && (
          <span className={cn("inline-flex items-center gap-0.5 whitespace-nowrap", opportunityProbabilityClass(item.probabilityPercent))}>
            <CirclePercent className="size-3" aria-hidden="true" />
            {formatTemplate(t.crmOpportunityDetail.probabilityValue, { percent: formatNumber(item.probabilityPercent, lang) })}
          </span>
        )}
        {item.expectedCloseDate && (
          <span className="inline-flex items-center gap-1 whitespace-nowrap">
            <Calendar className="size-3 shrink-0" aria-hidden="true" />
            <DateTime value={`${item.expectedCloseDate.slice(0, 10)}T00:00:00.000Z`} precision="date" language={lang} timeZone="UTC" />
          </span>
        )}
      </div>
    </div>
  );
}
