"use client";

import Link from "next/link";
import { FileText, HandCoins, Receipt, Target } from "lucide-react";
import { Badge, buttonVariantClasses, cn, iconSize } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import {
  CUSTOMER_RELATED_KINDS,
  CUSTOMER_RELATED_ROUTES,
  type CustomerRelatedKind,
} from "../customer-profile-related-contract";
import { useCustomerProfileRelatedCounts } from "../hooks/useCustomerProfileRelatedCounts";

const ICONS: Record<CustomerRelatedKind, typeof Target> = {
  opportunities: Target,
  quotations: FileText,
  salesOrders: HandCoins,
  invoices: Receipt,
};

export interface CustomerProfileRelatedNavProps {
  customerProfileId: string;
  partyId: string;
  branchId: string;
}

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

  const visible = CUSTOMER_RELATED_KINDS.filter((kind) => permitted[kind]);
  if (visible.length === 0) return null;

  return (
    <nav aria-label={copy.groupLabel} className="flex items-center gap-1">
      {visible.map((kind) => {
        const Icon = ICONS[kind];
        const count = counts[kind];
        return (
          <Link
            key={kind}
            href={CUSTOMER_RELATED_ROUTES[kind]}
            className={cn(buttonVariantClasses("ghost", "sm"), "gap-1.5")}
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
            <span className="hidden truncate xl:inline">{copy.labels[kind]}</span>
            <Badge tone="neutral" aria-hidden="true">
              {count === null ? (isLoading ? "…" : "—") : String(count)}
            </Badge>
          </Link>
        );
      })}
    </nav>
  );
}
