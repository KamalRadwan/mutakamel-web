"use client";

import Link from "next/link";
import { Trash2 } from "lucide-react";
import { Badge, type BadgeProps, Button, cn, focusRing, resolveStatusRole, type ColumnDef } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { localizedName, localizedValue } from "@/lib/format/localized";
import type { LeadItem, LeadStage } from "../hooks/useLeads";

const ROLE_TONE: Record<string, NonNullable<BadgeProps["tone"]>> = {
  positive: "positive",
  negative: "negative",
  caution: "caution",
  pending: "neutral",
};

interface LeadColumnOptions {
  stageById: Map<string, LeadStage>;
  canDelete: (lead: LeadItem) => boolean;
  onDelete: (lead: LeadItem) => void;
}

// The table's column set. Headers arrive translated — DataTable never touches
// the dictionary. See docs/design/patterns.md#datatable.
export function useLeadColumns({ stageById, canDelete, onDelete }: LeadColumnOptions): ColumnDef<LeadItem>[] {
  const { t, lang } = useI18n();

  return [
    {
      id: "name",
      header: t.crmLeads.name,
      // The first column is the route into the detail screen — see
      // docs/design/detail-screens.md#routes. A real `<Link>` rather than a
      // row-click handler, so the address is copyable and middle-clickable.
      cell: (item) => (
        <div>
          <Link
            href={`/crm/leads/${item.id}`}
            className={cn("rounded-xs font-medium text-foreground hover:underline", focusRing)}
          >
            {item.leadName}
          </Link>
          <p className="text-2xs text-muted-foreground">{item.company}</p>
        </div>
      ),
    },
    {
      id: "contact",
      header: t.crmLeads.contact,
      cell: (item) => (
        <div dir="ltr">
          <p>{item.email || t.crmLeads.unavailable}</p>
          {item.phone && <p className="text-2xs text-muted-foreground">{item.phone}</p>}
        </div>
      ),
    },
    {
      id: "stage",
      header: t.crmLeads.stage,
      cell: (item) => {
        const stage = stageById.get(item.stageId);
        const role = stage ? resolveStatusRole("LeadStageFlag", stage.flag) : undefined;
        return (
          <Badge tone={role ? ROLE_TONE[role] : "neutral"}>
            {stage ? localizedName(stage, lang) : item.stageId}
          </Badge>
        );
      },
    },
    {
      id: "source",
      header: t.crmLeads.source,
      cell: (item) => localizedValue(item.sourceNameAr, item.sourceNameEn, lang) || t.crmLeads.unavailable,
    },
    {
      id: "actions",
      header: t.common.actions,
      align: "end",
      sticky: "end",
      cell: (item) =>
        canDelete(item) ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(item)}
            aria-label={`${t.common.delete}: ${item.leadName}`}
          >
            <Trash2 className="size-4 text-destructive" aria-hidden="true" />
          </Button>
        ) : null,
    },
  ];
}
