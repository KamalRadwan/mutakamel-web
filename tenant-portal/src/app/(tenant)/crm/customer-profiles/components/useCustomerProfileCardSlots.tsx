"use client";

import type { ReactNode } from "react";
import type { MoveToTarget } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { localizedValue } from "@/lib/format/localized";
import { formatTemplate } from "@/lib/format/template";
import { crmActivityState } from "../../shared/crm-activity-tone";
import type { CustomerProfileItem } from "../hooks/useCustomerProfiles";
import { CustomerProfileCard } from "./customer-card/CustomerProfileCard";
import { CustomerProfileCardFooter } from "./customer-card/CustomerProfileCardFooter";
import { CustomerProfileCardMenu } from "./customer-card/CustomerProfileCardMenu";
import { CustomerProfileCardViewFooter } from "./customer-card/CustomerProfileCardViewFooter";

export interface CustomerProfileCardSlotsOptions {
  canUpdate: (item: CustomerProfileItem) => boolean;
  canDelete: (item: CustomerProfileItem) => boolean;
  onOpen: (item: CustomerProfileItem) => void;
  onDelete?: (item: CustomerProfileItem) => void;
  onOpenActivities: (item: CustomerProfileItem) => void;
  moveTargets?: (item: CustomerProfileItem) => readonly MoveToTarget[];
  onMove?: (item: CustomerProfileItem, status: string) => void;
}

export interface CustomerProfileCardSlots {
  renderCard: (item: CustomerProfileItem) => ReactNode;
  renderActions: (item: CustomerProfileItem) => ReactNode;
  renderFooter: (item: CustomerProfileItem) => ReactNode;
  renderCardViewFooter: (item: CustomerProfileItem) => ReactNode;
  cardClassName: () => undefined;
}

export function useCustomerProfileCardSlots({
  canUpdate,
  canDelete,
  onOpen,
  onDelete,
  onOpenActivities,
  moveTargets,
  onMove,
}: CustomerProfileCardSlotsOptions): CustomerProfileCardSlots {
  const { t, lang } = useI18n();
  const card = t.crmLeads.card;

  function ownerName(item: CustomerProfileItem): string {
    return item.owner
      ? [item.owner.firstName, item.owner.lastName].filter(Boolean).join(" ")
      : "";
  }

  function ownerLabel(item: CustomerProfileItem): string {
    return formatTemplate(card.owner, { name: ownerName(item) });
  }

  function activityLabel(item: CustomerProfileItem): string {
    return formatTemplate(card.activityOpen, {
      state: card.activityStates[crmActivityState(item.nextActivity)],
    });
  }

  return {
    renderCard: (item) => <CustomerProfileCard item={item} />,

    renderActions: (item) => (
      <CustomerProfileCardMenu
        onOpen={() => onOpen(item)}
        onDelete={canDelete(item) && onDelete ? () => onDelete(item) : undefined}
        moveTargets={canUpdate(item) ? moveTargets?.(item) : undefined}
        onMove={
          canUpdate(item) && onMove
            ? (status: string) => onMove(item, status)
            : undefined
        }
        labels={{
          trigger: formatTemplate(card.more, { name: item.displayName }),
          open: card.open,
          delete: t.common.delete,
          moveTo: t.views.moveTo,
        }}
      />
    ),

    renderFooter: (item) => (
      <CustomerProfileCardFooter
        nextActivity={item.nextActivity}
        onOpenActivities={() => onOpenActivities(item)}
        owner={item.owner}
        labels={{
          activity: activityLabel(item),
          owner: ownerLabel(item),
        }}
      />
    ),

    renderCardViewFooter: (item) => {
      const sourceName = localizedValue(
        item.acquisitionSourceNameAr,
        item.acquisitionSourceNameEn,
        lang,
      );
      return (
        <CustomerProfileCardViewFooter
          item={item}
          sourceName={sourceName}
          onOpenActivities={() => onOpenActivities(item)}
          labels={{
            activity: activityLabel(item),
            owner: ownerLabel(item),
            emailAction: formatTemplate(card.emailAction, {
              value: item.email ?? "",
            }),
            contactEmailAction: formatTemplate(card.emailAction, {
              value: item.primaryContact?.email ?? "",
            }),
            source: formatTemplate(card.source, { name: sourceName }),
            salesperson: formatTemplate(card.salesperson, {
              name: ownerName(item),
            }),
            country: formatTemplate(
              item.profileType === "CORPORATE"
                ? card.companyCountry
                : card.individualCountry,
              { name: item.country },
            ),
            primary: card.primary,
            position: formatTemplate(card.position, {
              name: item.primaryContact?.jobTitle ?? "",
            }),
          }}
        />
      );
    },

    cardClassName: () => undefined,
  };
}
