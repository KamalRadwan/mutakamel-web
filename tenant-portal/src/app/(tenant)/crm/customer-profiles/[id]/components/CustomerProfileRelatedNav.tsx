"use client";

import Link from "next/link";
import {
  FileCheck,
  FileSpreadsheet,
  FileText,
  Target,
} from "lucide-react";
import { cn } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import {
  CUSTOMER_RELATED_KINDS,
  CUSTOMER_RELATED_ROUTES,
  type CustomerRelatedKind,
} from "../customer-profile-related-contract";
import { useCustomerProfileRelatedCounts } from "../hooks/useCustomerProfileRelatedCounts";

export interface CustomerProfileRelatedNavProps {
  customerProfileId: string | null;
  partyId: string | null;
  branchId: string | null;
}

const RELATED_PILL_VISUAL: Record<
  CustomerRelatedKind,
  {
    code: string;
    toneClass: string;
    icon: typeof Target;
  }
> = {
  opportunities: {
    code: "OPP",
    toneClass: "dossier-kpi-pill-indigo",
    icon: Target,
  },
  quotations: {
    code: "PQ",
    toneClass: "dossier-kpi-pill-amber",
    icon: FileText,
  },
  salesOrders: {
    code: "SO",
    toneClass: "dossier-kpi-pill-teal",
    icon: FileCheck,
  },
  invoices: {
    code: "INV",
    toneClass: "dossier-kpi-pill-violet",
    icon: FileSpreadsheet,
  },
};

export function CustomerProfileRelatedNav({
  customerProfileId,
  partyId,
  branchId,
}: CustomerProfileRelatedNavProps) {
  const { t } = useI18n();
  const { counts, permitted } = useCustomerProfileRelatedCounts(
    customerProfileId,
    partyId,
    branchId,
  );

  const visibleKinds = CUSTOMER_RELATED_KINDS.filter((kind) => permitted[kind]);
  if (visibleKinds.length === 0) return null;

  const labels: Record<CustomerRelatedKind, string> = {
    opportunities: t.crmLeadDetail.related.labels.opportunities,
    quotations: t.crmLeadDetail.related.labels.quotations,
    salesOrders: t.crmLeadDetail.related.labels.salesOrders,
    invoices: t.crmLeadDetail.related.labels.invoices,
  };

  function buildHref(kind: CustomerRelatedKind): string {
    const base = CUSTOMER_RELATED_ROUTES[kind];
    if (kind === "opportunities") {
      return customerProfileId
        ? `${base}?customerProfileId=${encodeURIComponent(customerProfileId)}`
        : base;
    }
    return partyId ? `${base}?partyId=${encodeURIComponent(partyId)}` : base;
  }

  return (
    <nav
      aria-label={t.crmLeadDetail.related.groupLabel}
      className="flex flex-wrap items-center gap-2"
    >
      {visibleKinds.map((kind) => {
        const visual = RELATED_PILL_VISUAL[kind];
        const Icon = visual.icon;
        const count = counts[kind];

        return (
          <Link
            key={kind}
            href={buildHref(kind)}
            className={cn("dossier-kpi-pill", visual.toneClass)}
          >
            <Icon className="size-3.5 shrink-0 opacity-85" aria-hidden="true" />
            <span>{labels[kind]}</span>
            <span className="rounded bg-black/5 px-1 font-mono text-[10px] font-bold opacity-80 dark:bg-white/10">
              {visual.code}
            </span>
            {count !== null && (
              <span className="dossier-kpi-pill-count tabular-nums">
                {count}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
