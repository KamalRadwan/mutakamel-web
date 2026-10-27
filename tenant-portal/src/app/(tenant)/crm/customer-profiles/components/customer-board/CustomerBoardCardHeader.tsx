"use client";

import { Building2, UserRound } from "lucide-react";
import { Button, cn } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import { CrmCardExpandButton } from "../../../shared/components/board/CrmCardIconButton";
import { CustomerProfileCardMenu } from "../customer-card/CustomerProfileCardMenu";
import type { CustomerBoardCardProps } from "./customer-board-types";

export function CustomerBoardCardHeader({ item, canUpdate, canDelete, onOpen,
  onDelete, moveTargets, onMove, onCardChange, expanded, onToggleExpanded }: CustomerBoardCardProps) {
  const { t } = useI18n();
  const labels = t.crmLeads.card;
  const company = item.profileType === "CORPORATE";
  const title = company ? item.companyName || item.displayName : item.displayName;
  return (
    <div className="flex items-center justify-between gap-2">
      <Button type="button" variant="ghost" size="sm" onClick={onOpen}
        className="flex h-auto min-w-0 flex-1 items-center justify-start gap-2.5 p-0 text-start not-disabled:hover:bg-transparent">
        <span aria-hidden="true" className={cn("flex size-[31px] shrink-0 items-center justify-center rounded-lg",
          company ? "bg-entity-company-surface text-entity-company-fg" : "bg-entity-person-surface text-entity-person-fg")}>
          {company ? <Building2 className="size-4" /> : <UserRound className="size-4" />}
        </span>
        <span className="min-w-0 truncate text-card-title font-semibold text-foreground"><bdi>{title}</bdi></span>
      </Button>
      <div className="flex shrink-0 items-center gap-1">
        <CrmCardExpandButton expanded={expanded} onClick={onToggleExpanded}
          label={expanded ? t.crmCustomerProfiles.ui.board.collapse_card : t.crmCustomerProfiles.ui.board.expand_card_details} />
        <span className="contents [&>button]:size-[26px] [&>button]:rounded-md [&>button]:border [&>button]:border-line-card [&>button]:bg-surface-subtle [&>button]:p-0 [&>button]:text-muted-foreground">
          <CustomerProfileCardMenu cardColor={item.cardColor} onOpen={onOpen}
            onDelete={canDelete ? onDelete : undefined} moveTargets={canUpdate ? moveTargets : undefined}
            onMove={canUpdate ? onMove : undefined}
            onColorChange={canUpdate ? (cardColor) => onCardChange({ cardColor }) : undefined}
            labels={{ trigger: formatTemplate(labels.more, { name: item.displayName }), open: labels.open,
              delete: t.common.delete, moveTo: t.views.moveTo, cardColor: labels.cardColor,
              colorNone: labels.colorNone, colorNames: labels.colors, selected: labels.colorSelected }} />
        </span>
      </div>
    </div>
  );
}
