"use client";

import Link from "next/link";
import { Button, DegradedBanner } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { useOpportunityStageFeedback } from "../hooks/useOpportunityStageFeedback";

type Feedback = ReturnType<typeof useOpportunityStageFeedback>;

export function OpportunityStageRecovery({ feedback, actionsOnly = false }: { feedback: Feedback; actionsOnly?: boolean }) {
  const { t } = useI18n();
  if (!feedback.message) return null;
  const inUse = feedback.failure?.code === "OPPORTUNITY_STAGE_IN_USE";
  return (
    <div className="flex flex-col gap-2" role={actionsOnly ? undefined : "status"}>
      {!actionsOnly && <DegradedBanner message={feedback.message} />}
      <div className="flex flex-wrap items-center gap-2">
        {inUse && <Button asChild variant="outline" size="sm"><Link href="/crm/pipelines">{t.crmOpportunityStages.managePipelines}</Link></Button>}
        {(feedback.blocked || feedback.failure?.status === 404) && <Button variant="outline" size="sm" loading={feedback.reconciling} onClick={() => void feedback.reconcile()}>{t.crmOpportunityStages.reconcile}</Button>}
      </div>
    </div>
  );
}
