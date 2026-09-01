"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Badge, Button, StatusBadge, type ColumnDef } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatDate } from "@/lib/format/date";
import { localizedName } from "@/lib/format/localized";
import type { OpportunityStage } from "../hooks/pipeline-types";
import type { OpportunityListItem } from "../hooks/useOpportunitiesList";

interface OpportunityColumnOptions {
  stageById: Map<string, OpportunityStage>;
  onDelete: (item: OpportunityListItem) => void;
}

// The table's column set. Headers arrive translated — DataTable never touches
// the dictionary. Customer and Owner render ids on purpose: GET /opportunities
// returns the raw entity with no display names, and fabricating one is banned —
// see docs/design/views.md#opportunities-pipeline.
export function useOpportunityColumns({
  stageById,
  onDelete,
}: OpportunityColumnOptions): ColumnDef<OpportunityListItem>[] {
  const { t, lang } = useI18n();

  const columns: ColumnDef<OpportunityListItem>[] = [
    {
      id: "title",
      sortable: true,
      header: t.crmOpportunities.title,
      // The first column routes into the detail screen — a real link, so the
      // address stays copyable. See docs/design/detail-screens.md#routes.
      cell: (item) => (
        <Link
          href={`/crm/opportunities/${encodeURIComponent(item.id)}`}
          className="rounded-xs font-medium text-foreground hover:underline"
        >
          {item.title}
        </Link>
      ),
    },
    {
      id: "customer",
      header: t.crmOpportunities.customer,
      cell: (item) => (
        <Link
          href={`/crm/customer-profiles/${encodeURIComponent(item.customerProfileId)}`}
          aria-label={t.crmOpportunities.viewCustomer}
          className="inline-flex items-center gap-1 text-brand-700 hover:underline dark:text-brand-300"
        >
          <ExternalLink className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="max-w-32 truncate font-mono text-2xs">{item.customerProfileId}</span>
        </Link>
      ),
    },
    {
      id: "stage",
      header: t.crmOpportunities.stage,
      cell: (item) => {
        const stage = stageById.get(item.stageId);
        return <Badge tone="neutral">{stage ? localizedName(stage, lang) : item.stageId}</Badge>;
      },
    },
    { id: "status", header: t.common.status, cell: (item) => <StatusBadge value={item.status} kind="OpportunityStatus" /> },
    {
      id: "owner",
      header: t.crmOpportunities.owner,
      cell: (item) =>
        item.ownerUserId ? (
          <span className="font-mono text-2xs">{item.ownerUserId}</span>
        ) : (
          <span className="text-muted-foreground">{t.crmOpportunities.notProvided}</span>
        ),
    },
    {
      id: "expectedClose",
      header: t.crmOpportunities.expectedClose,
      sortable: true,
      sortField: "expectedCloseDate",
      cell: (item) => (item.expectedCloseDate ? formatDate(item.expectedCloseDate, lang) : t.crmOpportunities.notProvided),
    },
    {
      id: "actions",
      header: t.common.actions,
      align: "end",
      sticky: "end",
      cell: (item) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDelete(item)}
          aria-label={`${t.common.delete}: ${item.title}`}
        >
          {t.common.delete}
        </Button>
      ),
    },
  ];

  return columns;
}
