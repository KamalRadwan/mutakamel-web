"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n/I18nContext";
import type { OpportunityStageDefinition } from "../../pipelines/pipeline-contract";
import type { OpportunityStageFormInput } from "../opportunity-stage-contract";
import { useOpportunityStages } from "./useOpportunityStages";
import { useOpportunityStageFeedback } from "./useOpportunityStageFeedback";

export function useOpportunityStagesScreen() {
  const data = useOpportunityStages();
  const { t } = useI18n();
  const router = useRouter();
  const feedback = useOpportunityStageFeedback(data.reload);
  const [drawerStage, setDrawerStage] = useState<OpportunityStageDefinition | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<OpportunityStageDefinition | null>(null);
  const busy = data.isSubmitting || data.pendingId !== null;

  return {
    ...data, feedback, drawerStage, isDrawerOpen, pendingDelete, busy,
    openCreate: () => { if (data.canManage && !busy) { feedback.clear(); setDrawerStage(null); setIsDrawerOpen(true); } },
    openEdit: (stage: OpportunityStageDefinition) => { if (data.canManage && !busy) { feedback.clear(); setDrawerStage(stage); setIsDrawerOpen(true); } },
    openDelete: (stage: OpportunityStageDefinition) => { if (data.canManage && !busy && !stage.isSystem && !feedback.blocked) { feedback.clear(); setPendingDelete(stage); } },
    changeDrawerOpen: (open: boolean) => { if (!busy && (!open || data.canManage)) setIsDrawerOpen(open); },
    changeDeleteOpen: (open: boolean) => { if (!open && !busy) setPendingDelete(null); },
    openDetail: (stage: OpportunityStageDefinition) => { if (!busy) router.push(`/crm/opportunity-stages/${stage.id}`); },
    clearSearch: () => data.setSearchQuery(""),
    submit: async (input: OpportunityStageFormInput) => {
      if (!data.canManage || feedback.blocked || busy) return;
      const result = drawerStage ? await data.update(drawerStage, input) : await data.create(input);
      if (feedback.report(result, drawerStage ? t.crmOpportunityStages.updated : t.crmOpportunityStages.created)) setIsDrawerOpen(false);
      else if (result.error?.status === 404) { setIsDrawerOpen(false); await data.reload(); }
    },
    confirmDelete: async () => {
      if (!data.canManage || !pendingDelete || feedback.blocked || busy) return;
      const result = await data.remove(pendingDelete.id);
      setPendingDelete(null);
      feedback.report(result, t.crmOpportunityStages.deleted);
    },
  };
}
