import { Eye } from "lucide-react";
import { Button } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatNumber } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import { CrmActivityPill } from "../../../shared/components/board/CrmActivityPill";
import { CrmOwnerAvatar } from "../../../shared/components/board/CrmOwnerAvatar";
import { CrmRatingStars } from "../../../shared/components/board/CrmRatingStars";
import { crmBoardIconButtonClass } from "../../../shared/components/board/board-classes";
import type { OpportunityReadFields } from "../../opportunity-read-model";
import type { OpportunityBoardCardProps } from "./opportunity-board-types";
import { opportunityBoardActivityState, opportunityOwnerInitials } from "./opportunity-board-presentation";

export function OpportunityBoardCardFooter({ props, effective, canOpenActivities }: {
  props: OpportunityBoardCardProps;
  effective: OpportunityReadFields;
  canOpenActivities: boolean;
}) {
  const { t, lang } = useI18n();
  const flag = props.stage.flag;
  const terminal = flag === "WON" || flag === "LOST";
  const state = opportunityBoardActivityState(effective);
  const label = flag === "WON" || flag === "LOST" ? t.statusValues[`OpportunityStatus.${flag}`] : t.crmLeads.card.activityStates[state];
  const pill = <CrmActivityPill state={state} label={label} neutral={terminal} />;
  return (
    <>
      <div className="h-px w-full bg-line-card" aria-hidden="true" />
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1.5">
        <div className="flex min-w-0 max-w-full flex-wrap items-center gap-x-1.5 gap-y-1.5">
          <CrmRatingStars value={props.item.importance} ariaLabel={t.crmOpportunities.importance}
            onChange={props.canUpdate ? (importance) => props.onCardChange({ importance }) : undefined}
            starLabel={(level) => props.item.importance === level ? t.crmOpportunities.clearImportance
              : formatTemplate(t.crmOpportunities.setImportance, { level: formatNumber(level, lang) })} />
          {canOpenActivities ? (
            <Button type="button" variant="ghost" size="xs" onClick={props.onOpenActivities}
              aria-label={formatTemplate(t.crmLeads.card.activityOpen, { state: label })}
              title={t.activities.title} className="h-auto rounded-full p-0">{pill}</Button>
          ) : pill}
        </div>
        <div className="ms-auto flex shrink-0 items-center gap-1">
          <Button type="button" variant="ghost" size="xs" onClick={props.onOpenQuickModal}
            title={t.crmOpportunities.quickInspect} aria-label={t.crmOpportunities.quickInspect} className={crmBoardIconButtonClass}>
            <Eye className="size-3.5" aria-hidden="true" />
          </Button>
          <CrmOwnerAvatar initials={opportunityOwnerInitials(effective.ownerDisplayName)}
            name={effective.ownerDisplayName ?? undefined} imageUrl={effective.ownerAvatarUrl} />
        </div>
      </div>
    </>
  );
}
