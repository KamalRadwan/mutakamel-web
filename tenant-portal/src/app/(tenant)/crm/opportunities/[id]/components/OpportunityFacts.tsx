"use client";

import { CopyButton, DateTime, DetailSection, Money } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import type { OpportunityDetail } from "../../opportunity-contract";

/**
 * The opportunity's own facts — money, dates, description, record metadata.
 *
 * The amount renders through `Money`, which formats the decimal **string** with
 * `Intl` and never converts it to a number. `formatCurrencyAmount` in
 * `pipeline-types.ts` predates that primitive and hardcodes `en-US` grouping;
 * this screen uses the primitive so the digits follow the active locale.
 */
export function OpportunityFacts({ item }: { item: OpportunityDetail }) {
  const { t } = useI18n();

  return (
    <>
      <DetailSection
        title={t.crmOpportunityDetail.factsTitle}
        emptyValueLabel={t.detail.notRecorded}
        fields={[
          { label: t.crmOpportunities.title, value: item.title },
          {
            label: t.crmOpportunityDetail.amount,
            value: item.amount ? (
              <Money value={item.amount} currency={item.currencyCode ?? undefined} />
            ) : null,
          },
          {
            label: t.crmOpportunities.importance,
            value: formatTemplate(t.crmOpportunities.importanceValue, {
              level: item.importance,
            }),
          },
          {
            label: t.crmOpportunityDetail.probability,
            value:
              item.probabilityPercent === null
                ? null
                : formatTemplate(t.crmOpportunityDetail.probabilityValue, {
                    percent: item.probabilityPercent,
                  }),
          },
          {
            label: t.crmOpportunities.expectedClose,
            value: item.expectedCloseDate ? (
              <DateTime value={item.expectedCloseDate} precision="date" />
            ) : null,
          },
          {
            label: t.crmLeadDetail.description,
            wide: true,
            value: item.description,
          },
        ]}
      />

      <DetailSection
        title={t.crmLeadDetail.recordTitle}
        emptyValueLabel={t.detail.notRecorded}
        fields={[
          {
            label: t.crmOpportunityDetail.opportunityId,
            value: (
              <span className="flex items-center gap-1">
                <span className="break-all font-mono text-xs" dir="ltr">
                  {item.id}
                </span>
                <CopyButton
                  value={item.id}
                  copyLabel={t.crmShared.copyId}
                  copiedLabel={t.crmShared.copied}
                  failedLabel={t.crmShared.copyFailed}
                />
              </span>
            ),
          },
          {
            label: t.crmLeadDetail.createdAt,
            value: <DateTime value={item.createdAt} precision="datetime" />,
          },
          {
            label: t.crmLeadDetail.updatedAt,
            value: <DateTime value={item.updatedAt} precision="datetime" />,
          },
          {
            label: t.crmOpportunityDetail.wonAt,
            value: item.wonAt ? (
              <DateTime value={item.wonAt} precision="datetime" />
            ) : null,
          },
          {
            label: t.crmOpportunityDetail.lostAt,
            value: item.lostAt ? (
              <DateTime value={item.lostAt} precision="datetime" />
            ) : null,
          },
          {
            label: t.crmOpportunityDetail.lostReason,
            wide: true,
            value: item.lostReason,
          },
        ]}
      />
    </>
  );
}
