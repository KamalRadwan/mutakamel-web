"use client";

import { DateTime, DetailSection, Money, Timeline, type TimelineEvent } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import { TradeStatusBadge } from "../../documents/components/TradeStatusBadge";
import type { QuotationDetail } from "../quotation-contract";

/**
 * The revision history, newest first.
 *
 * `Timeline` never sorts — the caller decides, and auditing a quotation reads
 * newest-first. The tone is the revision's **outcome**: accepted is positive,
 * rejected and cancelled negative, and draft and sent take no hue because they
 * are positions in a process rather than results.
 */
export function QuotationRevisionsPanel({ quotation }: { quotation: QuotationDetail }) {
  const { t } = useI18n();

  const events: TimelineEvent[] = [...quotation.revisions]
    .sort((left, right) => right.revisionNumber - left.revisionNumber)
    .map((revision) => ({
      id: revision.id,
      title: formatTemplate(t.tradeDocuments.quotations.revisionNumber, {
        number: revision.revisionNumber,
      }),
      tone: revisionTone(revision.status),
      timestamp: <DateTime value={revision.validUntil} precision="date" />,
      description: (
        <span className="flex flex-wrap items-center gap-2">
          <TradeStatusBadge kind="TradeQuotationRevisionStatus" value={revision.status} />
          <Money
            value={revision.grandTotal}
            currency={quotation.currencyCode}
            minimumFractionDigits={2}
            maximumFractionDigits={8}
          />
          {revision.id === quotation.acceptedRevisionId ? (
            <span>{t.tradeDocuments.quotations.acceptedRevision}</span>
          ) : null}
          {revision.id === quotation.currentRevisionId ? (
            <span>{t.tradeDocuments.quotations.currentRevision}</span>
          ) : null}
        </span>
      ),
    }));

  return (
    <DetailSection
      title={t.tradeDocuments.quotations.revisions}
      description={t.tradeDocuments.quotations.revisionDescription}
      emptyValueLabel={t.tradeDocuments.notRecorded}
      columns={1}
    >
      <Timeline
        events={events}
        label={t.tradeDocuments.quotations.revisions}
        emptyTitle={t.tradeDocuments.quotations.noLines}
      />
    </DetailSection>
  );
}

function revisionTone(status: string): TimelineEvent["tone"] {
  if (status === "ACCEPTED") return "positive";
  if (status === "REJECTED" || status === "CANCELLED") return "negative";
  return undefined;
}
