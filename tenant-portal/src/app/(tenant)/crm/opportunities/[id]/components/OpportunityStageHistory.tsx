"use client";

import { ArrowRight, History } from "lucide-react";
import { Button, DateTime, ErrorState, Skeleton, mirrorInRtl } from "@/design-system";
import { UserProfileLink } from "@/components/people/UserProfileLink";
import { useUserProfiles } from "@/hooks/useUserProfiles";
import { useI18n } from "@/i18n/I18nContext";
import { localizedName } from "@/lib/format/localized";
import { CrmScopeGate } from "../../../shared/components/CrmScopeGate";
import type { OpportunityDetail } from "../../opportunity-contract";
import { useOpportunityStageHistory } from "../hooks/useOpportunityStageHistory";

export function OpportunityStageHistory({ item }: { item: OpportunityDetail }) {
  const { t, lang } = useI18n();
  const history = useOpportunityStageHistory(item.id, item.updatedAt);
  const people = useUserProfiles(history.items.flatMap((row) => row.changedByUserId ? [row.changedByUserId] : []), history.items.length > 0, Date.parse(item.updatedAt));
  const copy = t.crmOpportunityDetail.form;
  if (history.error?.status === 403) return <CrmScopeGate />;
  return <section className="grid gap-2" aria-label={copy.stageHistoryTitle}>
    <h3 className="flex items-center gap-2 text-sm font-semibold"><History className="size-4" aria-hidden="true" />{copy.stageHistoryTitle}</h3>
    {history.loading && history.items.length === 0 && <Skeleton className="h-20 rounded-lg" />}
    {history.error && <ErrorState title={t.crmOpportunities.loadFailed} onRetry={history.reload} retryLabel={t.common.retry} />}
    {!history.loading && !history.error && history.items.length === 0 && <p className="rounded-lg border border-dashed border-line-card p-4 text-sm text-muted-foreground">{copy.noStageHistory}</p>}
    <ol className="grid gap-2">{history.items.map((row) => <li key={row.id} className="grid gap-2 rounded-lg border border-line-card bg-surface-subtle p-3">
      <div className="flex flex-wrap items-center gap-2 text-sm"><span>{row.fromStageSnapshot ? localizedName({ nameAr: row.fromStageSnapshot.stageNameAr, nameEn: row.fromStageSnapshot.stageNameEn }, lang) : row.fromStatus === null ? copy.initialStage : copy.stageUnavailable}</span><ArrowRight className={`size-3.5 ${mirrorInRtl}`} aria-hidden="true" /><span className="font-medium">{row.toStageSnapshot ? localizedName({ nameAr: row.toStageSnapshot.stageNameAr, nameEn: row.toStageSnapshot.stageNameEn }, lang) : copy.stageUnavailable}</span><span className="ms-auto text-xs text-muted-foreground">{row.changedAt ? <DateTime value={row.changedAt} precision="datetime" /> : t.detail.notRecorded}</span></div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><span>{copy.changedBy}</span>{row.changedByUserId ? <UserProfileLink result={people.profiles.get(row.changedByUserId)} onRetry={people.retry} /> : <span>{t.detail.notRecorded}</span>}{row.reason && <p className="break-words">{row.reason}</p>}</div>
    </li>)}</ol>
    {history.nextCursor && <Button variant="outline" size="sm" loading={history.loading} onClick={history.loadMore}>{copy.loadMore}</Button>}
  </section>;
}
