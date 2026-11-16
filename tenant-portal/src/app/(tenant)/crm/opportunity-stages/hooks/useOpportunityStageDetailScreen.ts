"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n/I18nContext";
import type { OpportunityStageFormInput } from "../opportunity-stage-contract";
import { useOpportunityStageDetail } from "./useOpportunityStageDetail";
import { useOpportunityStageFeedback } from "./useOpportunityStageFeedback";

export function useOpportunityStageDetailScreen(id: string) {
  const data = useOpportunityStageDetail(id);
  const { t } = useI18n();
  const router = useRouter();
  const feedback = useOpportunityStageFeedback(data.reload);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  return {
    ...data, feedback, isEditOpen, isDeleteOpen,
    openEdit: () => { if (data.canManage && !data.isSubmitting) { feedback.clear(); setIsEditOpen(true); } },
    changeEditOpen: (open: boolean) => { if (!data.isSubmitting && (!open || data.canManage)) setIsEditOpen(open); },
    openDelete: () => { if (data.canManage && !data.isSubmitting && !data.stage?.isSystem && !feedback.blocked) { feedback.clear(); setIsDeleteOpen(true); } },
    changeDeleteOpen: (open: boolean) => { if (!data.isSubmitting && (!open || data.canManage)) setIsDeleteOpen(open); },
    save: async (input: OpportunityStageFormInput) => {
      if (!data.canManage || data.isSubmitting || feedback.blocked) return;
      if (feedback.report(await data.save(input), t.crmOpportunityStages.updated)) setIsEditOpen(false);
    },
    confirmDelete: async () => {
      if (!data.canManage || data.isSubmitting || feedback.blocked) return;
      const result = await data.remove();
      setIsDeleteOpen(false);
      if (feedback.report(result, t.crmOpportunityStages.deleted)) router.push("/crm/opportunity-stages");
    },
  };
}
