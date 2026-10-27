"use client";

import Link from "next/link";
import { FileText, HandCoins, Receipt, Target } from "lucide-react";
import { Badge, buttonVariantClasses, cn, iconSize } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import {
  CUSTOMER_RELATED_KINDS,
  buildCustomerRelatedHref,
  type CustomerRelatedKind,
} from "../customer-profile-related-contract";
import { useCustomerProfileRelatedCounts } from "../hooks/useCustomerProfileRelatedCounts";

export interface CustomerProfileRelatedNavProps {
  customerProfileId: string | null;
  partyId: string | null;
  branchId: string | null;
}

const ICONS: Record<CustomerRelatedKind, typeof Target> = {
  opportunities: Target,
  quotations: FileText,
  salesOrders: HandCoins,
  invoices: Receipt,
};

const KPI_PILL_TONES: Record<CustomerRelatedKind, string> = {
  opportunities: "dossier-kpi-pill dossier-kpi-opp",
  quotations: "dossier-kpi-pill dossier-kpi-quo",
  salesOrders: "dossier-kpi-pill dossier-kpi-ord",
  invoices: "dossier-kpi-pill dossier-kpi-inv",
};

export function CustomerProfileRelatedNav({
  customerProfileId,
  partyId,
  branchId,
}: CustomerProfileRelatedNavProps) {
  const { t } = useI18n();
  const copy = t.crmLeadDetail.related;
  const { counts, permitted, isLoading } = useCustomerProfileRelatedCounts(
    customerProfileId,
    partyId,
    branchId,
  );

  const visibleKinds = CUSTOMER_RELATED_KINDS.filter((kind) => permitted[kind]);
  if (visibleKinds.length === 0) return null;

  return (
    <nav
      aria-label={copy.groupLabel}
      className="flex flex-wrap items-center gap-2"
    >
      {visibleKinds.map((kind) => {
        const Icon = ICONS[kind];
        const count = counts[kind];

        return (
          <Link
            key={kind}
            href={buildCustomerRelatedHref(kind, partyId)}
            className={cn(
              buttonVariantClasses("ghost", "sm"),
              KPI_PILL_TONES[kind],
            )}
            aria-label={
              count === null
                ? copy.labels[kind]
                : formatTemplate(copy.labelWithCount, {
                    name: copy.labels[kind],
                    count: String(count),
                  })
            }
          >
            <Icon className={iconSize({ size: "sm" })} aria-hidden="true" />
            <span className="hidden truncate sm:inline">
              {copy.labels[kind]}
            </span>
            <Badge
              tone="neutral"
              className="dossier-kpi-num"
              aria-hidden="true"
            >
              {count === null ? (isLoading ? "…" : "—") : String(count)}
            </Badge>
          </Link>
        );
      })}
    </nav>
  );
}

