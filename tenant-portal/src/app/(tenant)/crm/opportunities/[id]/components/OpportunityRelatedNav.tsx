"use client";

import Link from "next/link";
import { BriefcaseBusiness, Building2, FileText, HandCoins, Receipt } from "lucide-react";
import { Badge, Button, cn, iconSize, swatchSurfacePalette } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import { formatNumber } from "@/lib/format/number";
import { PARTY_DOCUMENT_COUNT_KINDS, buildPartyDocumentHref, type PartyDocumentCountKind } from "../../../shared/party-document-counts-contract";
import type { OpportunityDetail } from "../../opportunity-contract";
import { useCustomerBusinessCounts } from "../hooks/useCustomerBusinessCounts";

const PRESENTATION = {
  opportunities: { Icon: BriefcaseBusiness, tone: "blue" }, quotations: { Icon: FileText, tone: "purple" },
  salesOrders: { Icon: HandCoins, tone: "green" }, invoices: { Icon: Receipt, tone: "amber" },
} as const;

/** Exactly one party-scoped related-record row, available only after persistence. */
export function OpportunityRelatedNav({ item }: { item: OpportunityDetail }) {
  const { t, lang } = useI18n();
  const { states, reload } = useCustomerBusinessCounts(item.customerPartyId, item.branchId);
  const copy = t.crmOpportunityDetail.form;
  const labels: Record<PartyDocumentCountKind, string> = { ...t.crmLeadDetail.related.labels, opportunities: t.crmOpportunities.heading };
  return (
    <section className="flex flex-wrap items-center gap-2 rounded-card border border-line-card bg-card p-2 shadow-card" aria-label={copy.customerBusiness}>
      <div className="me-auto flex min-w-0 items-center gap-2 px-1">
        <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", swatchSurfacePalette("blue").iconBoxIdle)}><Building2 className="size-4" aria-hidden="true" /></span>
        <div className="min-w-0"><p className="text-sm font-semibold">{copy.customerBusiness} · {item.customerDisplayName ?? t.detail.notRecorded}</p><p className="text-xs text-muted-foreground">{copy.customerBusinessScope}</p></div>
      </div>
      <nav className="flex flex-wrap items-center gap-2" aria-label={t.crmLeadDetail.related.groupLabel}>
        {PARTY_DOCUMENT_COUNT_KINDS.map((kind) => {
          const { Icon, tone } = PRESENTATION[kind];
          const state = states[kind];
          const label = labels[kind];
          const count = state.status === "ready" ? formatNumber(state.count, lang) : state.status === "loading" ? "…" : "—";
          const status = state.status === "denied" ? copy.countDenied : state.status === "unavailable" ? copy.countUnavailable : state.status === "loading" ? t.common.loading : count;
          const ariaLabel = formatTemplate(t.crmLeadDetail.related.labelWithCount, { name: label, count: status });
          const content = <><Icon className={iconSize({ size: "sm" })} aria-hidden="true" /><span>{label}</span><Badge tone="neutral" aria-hidden="true">{count}</Badge></>;
          const classes = cn("inline-flex h-8 items-center gap-2 rounded-lg border px-3 text-xs font-medium", swatchSurfacePalette(tone).badge);
          if (state.status === "denied" || !item.customerPartyId) return <span key={kind} className={cn(classes, "opacity-60")} aria-label={ariaLabel} title={status}>{content}</span>;
          return <Link key={kind} href={buildPartyDocumentHref(kind, item.customerPartyId)} className={classes} aria-label={ariaLabel} title={status}>{content}</Link>;
        })}
      </nav>
      {PARTY_DOCUMENT_COUNT_KINDS.some((kind) => states[kind].status === "unavailable") && <Button size="xs" variant="ghost" onClick={reload}>{t.common.retry}</Button>}
    </section>
  );
}
