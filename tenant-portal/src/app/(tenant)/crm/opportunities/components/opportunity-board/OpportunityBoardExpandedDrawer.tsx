import { ExternalLink, Eye, Loader2, Mail, MapPin } from "lucide-react";
import { Button, PermissionGate } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { localizedName } from "@/lib/format/localized";
import { AcquisitionSourceIcon } from "../../../shared/components/AcquisitionSourceIcon";
import { CrmPhoneActionsRow } from "../../../shared/components/CrmPhoneActionsRow";
import type { OpportunityBoardCardProps } from "./opportunity-board-types";
import type { useOpportunityBoardCard } from "./hooks/useOpportunityBoardCard";

export function OpportunityBoardExpandedDrawer({ props, card }: {
  props: OpportunityBoardCardProps;
  card: ReturnType<typeof useOpportunityBoardCard>;
}) {
  const { t, lang } = useI18n();
  if (card.isDetailForbidden) return <PermissionGate require="crm.opportunities.read" scoped denied>{null}</PermissionGate>;
  return (
    <div className="mt-1 space-y-2.5 rounded-lg border border-line-card bg-surface-subtle p-2.5 text-caption">
      {card.isLoadingDetail && (
        <div className="flex items-center gap-1.5 text-muted-foreground" role="status">
          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />{t.crmOpportunities.loadingDetails}
        </div>
      )}
      <div>
        <span className="block text-caption font-medium text-muted-foreground">{t.crmOpportunities.stage}</span>
        <span className="font-medium text-foreground">{localizedName(props.stage, lang)}</span>
      </div>
      {card.effective.primaryContact?.phones.slice(1).map((phone) => (
        <CrmPhoneActionsRow key={phone} phone={phone} country={card.effective.customerCountry} compact />
      ))}
      {card.primaryEmail && (
        <a href={`mailto:${card.primaryEmail}`} className="flex items-center gap-1.5 text-primary hover:underline">
          <Mail className="size-3 shrink-0" aria-hidden="true" /><span className="truncate">{card.primaryEmail}</span>
        </a>
      )}
      {card.location && (
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <MapPin className="size-3 shrink-0" aria-hidden="true" /><span className="truncate">{card.location}</span>
          {card.country?.flag && <span aria-hidden="true">{card.country.flag}</span>}
        </div>
      )}
      {card.effective.leadSourceName && (
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <AcquisitionSourceIcon source={{ iconUrl: card.effective.leadSourceIconUrl }} />
          <span className="truncate">{card.effective.leadSourceName}</span>
        </div>
      )}
      {card.effective.description && (
        <p className="line-clamp-3 rounded-md border border-line-card bg-card p-2 text-muted-foreground">{card.effective.description}</p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line-card pt-2">
        <Button type="button" variant="ghost" size="xs" onClick={props.onOpenQuickModal}
          className="h-auto gap-1 p-0 text-caption text-foreground hover:bg-transparent">
          <Eye className="size-3" aria-hidden="true" />{t.crmOpportunities.quick360}
        </Button>
        <Button type="button" variant="ghost" size="xs" onClick={props.onOpen}
          className="h-auto gap-1 p-0 text-caption text-primary hover:bg-transparent hover:underline">
          {t.crmOpportunities.fullDossier}<ExternalLink className="size-3" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
