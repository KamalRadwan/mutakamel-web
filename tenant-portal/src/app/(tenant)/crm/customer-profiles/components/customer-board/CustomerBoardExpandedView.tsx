"use client";

import { useI18n } from "@/i18n/I18nContext";
import { AcquisitionSourceIcon } from "../../../shared/components/AcquisitionSourceIcon";
import type { AcquisitionSource } from "../../../acquisition-sources/acquisition-source-contract";
import type { CustomerProfileItem } from "../../hooks/useCustomerProfiles";
import { CustomerBoardExpandedContacts } from "./CustomerBoardExpandedContacts";
import { useCustomerBoardDetail } from "./useCustomerBoardDetail";

export function CustomerBoardExpandedView({ item, sources }: {
  item: CustomerProfileItem; sources: readonly AcquisitionSource[];
}) {
  const { t } = useI18n();
  const detail = useCustomerBoardDetail(item, sources);
  const ownerName = item.owner ? [item.owner.firstName, item.owner.lastName].filter(Boolean).join(" ") : "";
  return (
    <>
      <CustomerBoardExpandedContacts item={item} detail={detail} />
      <div className="grid grid-cols-2 gap-2">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-caption text-muted-foreground">{t.crmCustomerProfiles.ui.board.salesperson}</span>
          <div className="flex h-7 items-center rounded-md border border-line-card bg-surface-subtle px-2 text-caption">
            <span className="truncate">{ownerName || t.crmCustomerProfiles.ui.board.unassigned}</span>
          </div>
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-caption text-muted-foreground">{t.crmCustomerProfiles.ui.board.acquisition_source}</span>
          <div className="flex h-7 items-center gap-1.5 rounded-md border border-line-card bg-surface-subtle px-2 text-caption">
            {detail.sourceLabel ? <><AcquisitionSourceIcon source={{ iconUrl: detail.resolvedSourceIconUrl }} /><span className="truncate">{detail.sourceLabel}</span></>
              : <span className="truncate text-muted-foreground">{t.crmCustomerProfiles.ui.board.not_set}</span>}
          </div>
        </div>
      </div>
    </>
  );
}
