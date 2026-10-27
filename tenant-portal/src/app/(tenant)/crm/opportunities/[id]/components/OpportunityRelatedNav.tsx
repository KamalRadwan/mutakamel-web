"use client";

import Link from "next/link";
import { Building2, FileText, HandCoins, Receipt, UserRound } from "lucide-react";
import {
  Badge,
  buttonVariantClasses,
  cn,
  hasPermission,
  iconSize,
} from "@/design-system";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import type { OpportunityDetail } from "../../opportunity-contract";
import {
  OPPORTUNITY_DOCUMENT_COUNT_KINDS,
  type OpportunityDocumentCountKind,
} from "../../opportunity-document-counts-contract";
import { buildPartyDocumentHref } from "../../../shared/party-document-counts-contract";
import { useOpportunityDocumentCounts } from "../../hooks/useOpportunityDocumentCounts";

const DOCUMENT_ICONS: Record<OpportunityDocumentCountKind, typeof FileText> = {
  quotations: FileText,
  salesOrders: HandCoins,
  invoices: Receipt,
};

export function OpportunityRelatedNav({ item }: { item: OpportunityDetail }) {
  const { t } = useI18n();
  const { user } = useTenantAuth();
  const copy = t.crmLeadDetail.related;
  const permissions = user?.permissions ?? [];
  const documentCounts = useOpportunityDocumentCounts(
    [item],
    item.branchId,
    Boolean(item.customerPartyId),
  );
  const canReadCustomer = hasPermission(
    permissions,
    "crm.customer_profiles.read",
    true,
  );
  const canReadLead = Boolean(item.leadId) && hasPermission(
    permissions,
    "crm.leads.read",
    true,
  );
  const visibleDocuments = item.customerPartyId
    ? OPPORTUNITY_DOCUMENT_COUNT_KINDS.filter(
        (kind) => documentCounts.visible[kind],
      )
    : [];

  if (!canReadCustomer && !canReadLead && visibleDocuments.length === 0) return null;

  const countedLabel = (name: string, count: string) =>
    formatTemplate(copy.labelWithCount, { name, count });

  return (
    <nav aria-label={copy.groupLabel} className="flex items-center gap-1">
      {canReadCustomer && (
        <Link
          href={`/crm/customer-profiles/${encodeURIComponent(item.customerProfileId)}`}
          className={cn(buttonVariantClasses("ghost", "sm"), "gap-1.5")}
          aria-label={t.nav.customerProfiles}
        >
          <Building2 className={iconSize({ size: "sm" })} aria-hidden="true" />
          <span className="hidden truncate xl:inline">{t.nav.customerProfiles}</span>
        </Link>
      )}
      {canReadLead && item.leadId && (
        <Link
          href={`/crm/leads/${encodeURIComponent(item.leadId)}`}
          className={cn(buttonVariantClasses("ghost", "sm"), "gap-1.5")}
          aria-label={t.nav.leads}
        >
          <UserRound className={iconSize({ size: "sm" })} aria-hidden="true" />
          <span className="hidden truncate xl:inline">{t.nav.leads}</span>
        </Link>
      )}
      {visibleDocuments.map((kind) => {
        const Icon = DOCUMENT_ICONS[kind];
        const count = item.customerPartyId
          ? documentCounts.countsByParty.get(item.customerPartyId)?.[kind] ?? null
          : null;
        return (
          <Link
            key={kind}
            href={buildPartyDocumentHref(kind, item.customerPartyId)}
            className={cn(buttonVariantClasses("ghost", "sm"), "gap-1.5")}
            aria-label={
              count === null
                ? copy.labels[kind]
                : countedLabel(copy.labels[kind], String(count))
            }
          >
            <Icon className={iconSize({ size: "sm" })} aria-hidden="true" />
            <span className="hidden truncate xl:inline">{copy.labels[kind]}</span>
            <Badge tone="neutral" aria-hidden="true">
              {count === null ? (documentCounts.isLoading ? "…" : "—") : String(count)}
            </Badge>
          </Link>
        );
      })}
    </nav>
  );
}
