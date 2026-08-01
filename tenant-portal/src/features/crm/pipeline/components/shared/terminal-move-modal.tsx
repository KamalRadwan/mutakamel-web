"use client";

import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useState } from "react";
import type { OpportunityRecord, StageFlag } from "../../models/pipeline-types";
import { useI18n } from "@/i18n/I18nContext";

interface TerminalMoveModalProps {
  isOpen: boolean;
  onClose: () => void;
  opportunity: OpportunityRecord | null;
  targetFlag: StageFlag;
  onConfirm: (reason: string) => void;
}

export function TerminalMoveModal({ isOpen, onClose, opportunity, targetFlag, onConfirm }: TerminalMoveModalProps) {
    const { t, lang } = useI18n();
  const [reason, setReason] = useState("");

  if (!opportunity) return null;

  const isWon = targetFlag === "WON";
  const title = isWon ? t.crm.opportunityClosedSuccessfull : t.crm.lossOfOpportunity;
  const description = isWon 
    ? lang === "ar" ? `أنت على وشك إغلاق فرصة "${opportunity.title}" بنجاح. يمكنك إضافة ملاحظات الإغلاق أدناه.` : `You are about to successfully close the opportunity "${opportunity.title}". You can add closing notes below.`
    : lang === "ar" ? `أنت على وشك تحديد فرصة "${opportunity.title}" كخسارة. يرجى تحديد سبب الخسارة أدناه.` : `You are about to mark the opportunity "${opportunity.title}" as lost. Please specify the reason for the loss below.`;

  const handleConfirm = () => {
    onConfirm(reason);
    setReason("");
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="flex flex-col gap-4 p-4">
        <p className="text-sm text-gray-600 dark:text-gray-300">
          {description}
        </p>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold text-gray-800 dark:text-gray-200">
            {isWon ? t.crm.additionalNotesOptional : t.crm.reasonForLossRequired}
          </label>
          <textarea
            className="w-full p-2 border rounded-md dark:bg-gray-800 dark:border-gray-700 dark:text-white"
            rows={4}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={isWon ? t.crm.writeYourCommentsHere : t.crm.whyDidWeLoseThisOpportuni}
          />
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="ghost" onClick={onClose}>
            {t.crm.cancellation}</Button>
          <Button 
            variant={isWon ? "primary" : "danger"} 
            onClick={handleConfirm}
            disabled={!isWon && reason.trim() === ""}
          >
            {t.crm.toBeSure}{isWon ? t.crm.winning : t.crm.loss}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
