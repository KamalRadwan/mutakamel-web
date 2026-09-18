"use client";

import type { ReactNode } from "react";
import {
  cardColorBorder,
  type CardColor,
  type MoveToTarget,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { localizedValue } from "@/lib/format/localized";
import { formatTemplate } from "@/lib/format/template";
import { crmActivityState } from "../../shared/crm-activity-tone";
import type { CustomerProfileItem } from "../hooks/useCustomerProfiles";
import type { CustomerProfileCardPatch } from "../customer-profile-card-contract";
import type {
  PartyDocumentCounts,
  PartyDocumentCountVisibility,
} from "../../shared/party-document-counts-contract";
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
  onCardChange: (
    item: CustomerProfileItem,
    patch: CustomerProfileCardPatch,
  ) => void;
  moveTargets?: (item: CustomerProfileItem) => readonly MoveToTarget[];
  onMove?: (item: CustomerProfileItem, status: string) => void;
  documentCountsByParty?: ReadonlyMap<string, PartyDocumentCounts>;
  documentCountVisibility?: PartyDocumentCountVisibility;
}

export interface CustomerProfileCardSlots {
  renderCard: (item: CustomerProfileItem) => ReactNode;
  renderCardViewCard: (item: CustomerProfileItem) => ReactNode;
  renderActions: (item: CustomerProfileItem) => ReactNode;
  renderFooter: (item: CustomerProfileItem) => ReactNode;
  renderCardViewFooter: (item: CustomerProfileItem) => ReactNode;
  cardClassName: (item: CustomerProfileItem) => string | undefined;
}

export function useCustomerProfileCardSlots({
  canUpdate,
  canDelete,
  onOpen,
  onDelete,
  onOpenActivities,
  onCardChange,
  moveTargets,
  onMove,
  documentCountsByParty,
  documentCountVisibility,
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
    renderCardViewCard: (item) => (
      <CustomerProfileCard item={item} variant="card" />
    ),

    renderActions: (item) => (
      <CustomerProfileCardMenu
        cardColor={item.cardColor}
        onOpen={() => onOpen(item)}
        onDelete={canDelete(item) && onDelete ? () => onDelete(item) : undefined}
        moveTargets={canUpdate(item) ? moveTargets?.(item) : undefined}
        onMove={
          canUpdate(item) && onMove
            ? (status: string) => onMove(item, status)
            : undefined
        }
        onColorChange={
          canUpdate(item)
            ? (cardColor: CardColor | null) =>
                onCardChange(item, { cardColor })
            : undefined
        }
        labels={{
          trigger: formatTemplate(card.more, { name: item.displayName }),
          open: card.open,
          delete: t.common.delete,
          moveTo: t.views.moveTo,
          cardColor: card.cardColor,
          colorNone: card.colorNone,
          colorNames: card.colors,
          selected: card.colorSelected,
        }}
      />
    ),

    renderFooter: (item) => (
      <CustomerProfileCardFooter
        nextActivity={item.nextActivity}
        onOpenActivities={() => onOpenActivities(item)}
        owner={item.owner}
        rating={item.rating}
        onRatingChange={(rating) => onCardChange(item, { rating })}
        isRatingDisabled={!canUpdate(item)}
        labels={{
          activity: activityLabel(item),
          owner: ownerLabel(item),
          group: card.rating,
          setStars: card.rateStars,
          clear: card.clearRating,
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
          counts={documentCountsByParty?.get(item.partyId)}
          countVisibility={documentCountVisibility}
          onRatingChange={(rating) => onCardChange(item, { rating })}
          isRatingDisabled={!canUpdate(item)}
          onOpenActivities={() => onOpenActivities(item)}
          labels={{
            activity: activityLabel(item),
            owner: ownerLabel(item),
            group: card.rating,
            setStars: card.rateStars,
            clear: card.clearRating,
            emailAction: formatTemplate(card.emailAction, {
              value: item.email ?? "",
            }),
            websiteAction:
              t.crmCustomerProfiles.create.companyWebsite +
              ": " +
              (item.companyWebsite ?? ""),
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
              {
                name: [item.country, item.city].filter(Boolean).join(" · "),
              },
            ),
            primary: card.primary,
            position: formatTemplate(card.position, {
              name: item.primaryContact?.jobTitle ?? "",
            }),
            quotations: formatTemplate(card.quotations, {
              count:
                documentCountsByParty?.get(item.partyId)?.quotations ?? "—",
            }),
            salesOrders: formatTemplate(card.salesOrders, {
              count:
                documentCountsByParty?.get(item.partyId)?.salesOrders ?? "—",
            }),
            invoices: formatTemplate(card.invoices, {
              count:
                documentCountsByParty?.get(item.partyId)?.invoices ?? "—",
            }),
          }}
        />
      );
    },

    cardClassName: (item) => cardColorBorder(item.cardColor) || undefined,
  };
}
