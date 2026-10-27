"use client";

import Link from "next/link";
import { Building2, ExternalLink, UserRound } from "lucide-react";
import {
  Button,
  Checkbox,
  cardColorBorder,
  cardColorFill,
  cn,
  type CardColor,
  type MoveToTarget,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import { crmActivityState } from "../../../shared/crm-activity-tone";
import { CrmCardStartBar } from "../../../shared/components/board/CrmCardStartBar";
import { crmBoardCardClass } from "../../../shared/components/board/board-classes";
import type {
  PartyDocumentCountVisibility,
  PartyDocumentCounts,
} from "../../../shared/party-document-counts-contract";
import { CustomerProfileCardMenu } from "../customer-card/CustomerProfileCardMenu";
import { CustomerGridCardBody } from "./CustomerGridCardBody";
import { CustomerGridCardFooter } from "./CustomerGridCardFooter";
import { CustomerGridDocumentCounts } from "./CustomerGridDocumentCounts";
import type {
  CustomerProfileCardPatch,
  CustomerProfileItem,
  CustomerProfileStatus,
} from "./customer-grid-types";

const ARABIC_SCRIPT_PATTERN = /[\u0600-\u06FF]/u;

function usesArabicScript(value: string): boolean {
  return ARABIC_SCRIPT_PATTERN.test(value);
}

interface CustomerGridCardProps {
  item: CustomerProfileItem;
  documentCounts?: PartyDocumentCounts;
  documentCountVisibility?: PartyDocumentCountVisibility;
  isSelected: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  moveTargets: readonly MoveToTarget[];
  onToggleSelect: () => void;
  onOpen: () => void;
  onOpenQuickModal?: () => void;
  onOpenActivities?: () => void;
  onDelete?: () => void;
  onMoveStatus: (status: CustomerProfileStatus) => void;
  onCardChange: (patch: CustomerProfileCardPatch) => void;
}

export function CustomerGridCard({
  item,
  documentCounts,
  documentCountVisibility,
  isSelected,
  canUpdate,
  canDelete,
  moveTargets,
  onToggleSelect,
  onOpen,
  onOpenQuickModal,
  onOpenActivities,
  onDelete,
  onMoveStatus,
  onCardChange,
}: CustomerGridCardProps) {
  const { t } = useI18n();
  const cardDict = t.crmLeads.card;

  const title = item.displayName;
  const arabicTitle = usesArabicScript(title);
  const isCorporate = item.profileType === "CORPORATE";
  const isBlacklisted = item.status === "BLACKLISTED";
  const activityState = crmActivityState(item.nextActivity);

  return (
    <article
      data-testid="customer-grid-card"
      className={cn(
        crmBoardCardClass,
        "h-full",
        item.cardColor && cardColorBorder(item.cardColor),
        isSelected && "border-primary ring-2 ring-primary/15",
      )}
    >
      <CrmCardStartBar
        state={activityState}
        neutral={isBlacklisted}
        colorClass={item.cardColor ? cardColorFill(item.cardColor) : undefined}
      />

      {/* Row 1: Selection + Entity Icon Badge + Customer Name + Standalone Link + Menu */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <Checkbox
            checked={isSelected}
            onCheckedChange={onToggleSelect}
            aria-label={`${t.views.selectItem}: ${title}`}
            className="shrink-0"
          />

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onOpen}
            className="flex h-auto min-w-0 flex-1 items-center justify-start gap-2.5 p-0 text-start not-disabled:hover:bg-transparent"
          >
            <span
              className={cn(
                "flex size-[31px] shrink-0 items-center justify-center rounded-lg",
                isCorporate
                  ? "bg-entity-company-surface text-entity-company-fg"
                  : "bg-entity-person-surface text-entity-person-fg",
              )}
              aria-hidden="true"
            >
              {isCorporate ? (
                <Building2 className="size-4" aria-hidden="true" />
              ) : (
                <UserRound className="size-4" aria-hidden="true" />
              )}
            </span>
            <span
              className={
                arabicTitle
                  ? "min-w-0 truncate font-arabic text-base font-extrabold text-foreground group-hover:text-primary"
                  : "min-w-0 truncate text-card-title font-bold text-foreground group-hover:text-primary"
              }
            >
              <bdi>{title}</bdi>
            </span>
          </Button>
        </div>

        <div
          className="flex shrink-0 items-center gap-0.5"
          onClick={(event) => event.stopPropagation()}
        >
          <Button
            variant="ghost"
            size="xs"
            asChild
            className="size-6 shrink-0 rounded-md p-0 text-muted-foreground hover:text-foreground"
          >
            <Link
              href={`/crm/customer-profiles/${encodeURIComponent(item.id)}`}
              title={t.crmLeads.executive.openStandalonePage}
              aria-label={t.crmLeads.executive.openStandalonePage}
            >
              <ExternalLink className="size-3.5" aria-hidden="true" />
            </Link>
          </Button>

          <CustomerProfileCardMenu
            cardColor={item.cardColor}
            onOpen={onOpen}
            onDelete={canDelete && onDelete ? onDelete : undefined}
            moveTargets={canUpdate ? moveTargets : undefined}
            onMove={
              canUpdate
                ? (status) => onMoveStatus(status as CustomerProfileStatus)
                : undefined
            }
            onColorChange={
              canUpdate
                ? (cardColor: CardColor | null) => onCardChange({ cardColor })
                : undefined
            }
            labels={{
              trigger: formatTemplate(cardDict.more, { name: title }),
              open: cardDict.open,
              delete: t.common.delete,
              moveTo: t.views.moveTo,
              cardColor: cardDict.cardColor,
              colorNone: cardDict.colorNone,
              colorNames: cardDict.colors,
              selected: cardDict.colorSelected,
            }}
          />
        </div>
      </div>

      <CustomerGridCardBody
        item={item}
        canEdit={canUpdate}
        onOpenQuickModal={onOpenQuickModal}
      />

      <div className="mt-auto flex flex-col gap-2.5 pt-0.5">
        <CustomerGridDocumentCounts
          customerId={item.id}
          partyId={item.partyId}
          counts={documentCounts}
          visibility={documentCountVisibility}
        />

        <div className="h-px w-full bg-line-card" aria-hidden="true" />

        <CustomerGridCardFooter
          item={item}
          canUpdate={canUpdate}
          onOpenQuickModal={onOpenQuickModal}
          onOpenActivities={onOpenActivities}
          onCardChange={onCardChange}
        />
      </div>
    </article>
  );
}
