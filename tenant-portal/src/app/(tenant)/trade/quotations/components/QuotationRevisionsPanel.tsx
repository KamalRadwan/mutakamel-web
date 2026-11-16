"use client";

import { FileSpreadsheet } from "lucide-react";
import {
  Badge,
  DateTime,
  HistorySection,
  Money,
  type HistoryDiffRow,
  type HistoryTone,
  type HistoryTreeNode,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import { TradeStatusBadge } from "../../documents/components/TradeStatusBadge";
import type { QuotationDetail, QuotationRevision } from "../quotation-contract";

function revisionTone(status: string): HistoryTone {
  if (status === "ACCEPTED") return "positive";
  if (status === "REJECTED" || status === "CANCELLED") return "negative";
  return "neutral";
}

function buildRevisionDiffs(
  revision: QuotationRevision,
  previous: QuotationRevision | undefined,
  currencyCode: string,
  labels: { status: string; grandTotal: string; validUntil: string },
): HistoryDiffRow[] {
  const hasPrevious = previous !== undefined;
  return [
    {
      key: "status",
      label: labels.status,
      showTransition: hasPrevious && previous.status !== revision.status,
      before: hasPrevious ? (
        <span className="line-through opacity-75">
          <TradeStatusBadge kind="TradeQuotationRevisionStatus" value={previous.status} />
        </span>
      ) : undefined,
      after: <TradeStatusBadge kind="TradeQuotationRevisionStatus" value={revision.status} />,
    },
    {
      key: "grandTotal",
      label: labels.grandTotal,
      showTransition: hasPrevious && previous.grandTotal !== revision.grandTotal,
      before: hasPrevious ? (
        <span className="text-danger-600 line-through dark:text-danger-300">
          <Money
            value={previous.grandTotal}
            currency={currencyCode}
            minimumFractionDigits={2}
            maximumFractionDigits={8}
          />
        </span>
      ) : undefined,
      after: (
        <Money
          value={revision.grandTotal}
          currency={currencyCode}
          minimumFractionDigits={2}
          maximumFractionDigits={8}
        />
      ),
    },
    {
      key: "validUntil",
      label: labels.validUntil,
      showTransition: hasPrevious && previous.validUntil !== revision.validUntil,
      before: hasPrevious ? (
        <span className="text-danger-600 line-through dark:text-danger-300">
          <DateTime value={previous.validUntil} precision="date" />
        </span>
      ) : undefined,
      after: <DateTime value={revision.validUntil} precision="date" />,
    },
  ];
}

/**
 * Quotation revision history rendered through the canonical `HistorySection`
 * 3-level template, newest first, with full `DetailSection` frame and
 * revision-over-revision field transitions.
 */
export function QuotationRevisionsPanel({ quotation }: { quotation: QuotationDetail }) {
  const { t } = useI18n();
  const byNumber = new Map<number, QuotationRevision>(
    quotation.revisions.map((rev) => [rev.revisionNumber, rev]),
  );

  const items: HistoryTreeNode[] = [...quotation.revisions]
    .sort((left, right) => right.revisionNumber - left.revisionNumber)
    .map((revision) => {
      const previous = byNumber.get(revision.revisionNumber - 1);
      const eventTimestamp =
        revision.acceptedAt ?? revision.sentAt ?? revision.rejectedAt ?? revision.validUntil;
      const hasDateTime = Boolean(
        revision.acceptedAt || revision.sentAt || revision.rejectedAt,
      );
      return {
        id: revision.id,
        timestamp: (
          <DateTime
            value={eventTimestamp}
            precision={hasDateTime ? "datetime" : "date"}
          />
        ),
        tone: revisionTone(revision.status),
        actionTitle: formatTemplate(t.tradeDocuments.quotations.revisionNumber, {
          number: revision.revisionNumber,
        }),
        actionIcon: FileSpreadsheet,
        referenceLabel: quotation.documentNumber ? `#${quotation.documentNumber}` : null,
        badges: (
          <span className="inline-flex flex-wrap items-center gap-1.5">
            <TradeStatusBadge kind="TradeQuotationRevisionStatus" value={revision.status} />
            <Money
              value={revision.grandTotal}
              currency={quotation.currencyCode}
              minimumFractionDigits={2}
              maximumFractionDigits={8}
            />
            {revision.id === quotation.acceptedRevisionId ? (
              <Badge tone="positive" size="sm">
                {t.tradeDocuments.quotations.acceptedRevision}
              </Badge>
            ) : null}
            {revision.id === quotation.currentRevisionId ? (
              <Badge tone="brand" size="sm">
                {t.tradeDocuments.quotations.currentRevision}
              </Badge>
            ) : null}
          </span>
        ),
        diffs: buildRevisionDiffs(revision, previous, quotation.currencyCode, {
          status: t.tradeDocuments.statusTitle,
          grandTotal: t.tradeDocuments.totals.grandTotal,
          validUntil: t.tradeDocuments.validUntil,
        }),
      };
    });

  return (
    <HistorySection
      title={t.tradeDocuments.quotations.revisions}
      description={t.tradeDocuments.quotations.revisionDescription}
      items={items}
      detailsLabel={t.audit.detailsOfChanges}
      emptyDetailsLabel={t.audit.detailsNotRecorded}
      expandAllLabel={t.audit.expandAll}
      collapseAllLabel={t.audit.collapseAll}
      emptyTitle={t.tradeDocuments.quotations.noLines}
    />
  );
}
