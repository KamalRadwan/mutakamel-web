"use client";

import { DateTime, DetailSection, Timeline, type TimelineEvent } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { Language } from "@/i18n/useLanguage";
import { localizedValue } from "@/lib/format/localized";
import { formatTemplate } from "@/lib/format/template";
import type {
  OpportunityStageHistoryEntry,
  OpportunityStageSnapshot,
} from "../../opportunity-contract";

/**
 * Stage history — MASTER-PLAN 8.10.
 *
 * The rows arrive newest-first from the server and are rendered in that order:
 * `Timeline` never sorts, and re-sorting here would disagree with the server on
 * rows sharing a timestamp.
 *
 * **Tone is an outcome, never a category.** A move into WON is `positive` and
 * into LOST is `negative` because those are results; every other move takes no
 * hue at all, which is the rule stated on `Timeline` itself and in
 * tokens.md#non-outcome-values--never-a-hue.
 */
export function OpportunityStageTimeline({
  entries,
}: {
  entries: OpportunityStageHistoryEntry[];
}) {
  const { t, lang } = useI18n();

  const events: TimelineEvent[] = entries.map((entry) => ({
    id: entry.id,
    title: formatTemplate(t.crmOpportunityDetail.stageMoved, {
      from: snapshotLabel(entry.fromStageSnapshot, lang, t.detail.notRecorded),
      to: snapshotLabel(entry.toStageSnapshot, lang, t.detail.notRecorded),
    }),
    description: entry.reason ?? undefined,
    timestamp: entry.changedAt ? (
      <DateTime value={entry.changedAt} precision="datetime" />
    ) : (
      t.detail.notRecorded
    ),
    actor: entry.changedByUserId ?? undefined,
    tone: outcomeTone(entry.toStageSnapshot),
  }));

  return (
    <DetailSection
      title={t.crmOpportunityDetail.historyTitle}
      description={t.crmOpportunityDetail.historyDescription}
    >
      <Timeline
        label={t.crmOpportunityDetail.historyTitle}
        events={events}
        emptyTitle={t.crmOpportunityDetail.historyEmptyTitle}
        emptyDescription={t.crmOpportunityDetail.historyEmptyDescription}
      />
    </DetailSection>
  );
}

function snapshotLabel(
  snapshot: OpportunityStageSnapshot | null,
  lang: Language,
  fallback: string,
): string {
  if (!snapshot) return fallback;
  const stage = localizedValue(snapshot.stageNameAr, snapshot.stageNameEn, lang);
  const pipeline = localizedValue(
    snapshot.pipelineNameAr,
    snapshot.pipelineNameEn,
    lang,
  );
  if (stage.length === 0) return fallback;
  // The pipeline name is only worth showing when it changed — the transfer
  // case — but the snapshot cannot see the other side, so both are always
  // named. That keeps a cross-pipeline move legible instead of reading as two
  // identically-named stages.
  return pipeline.length > 0 ? `${pipeline} · ${stage}` : stage;
}

function outcomeTone(
  snapshot: OpportunityStageSnapshot | null,
): TimelineEvent["tone"] {
  if (snapshot?.flag === "WON") return "positive";
  if (snapshot?.flag === "LOST") return "negative";
  return undefined;
}
