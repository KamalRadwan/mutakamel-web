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
  onConfirm: (reason: string) => Promise<boolean>;
  isSubmitting: boolean;
  error: string | null;
}

export function TerminalMoveModal({
  isOpen,
  onClose,
  opportunity,
  targetFlag,
  onConfirm,
  isSubmitting,
  error,
}: TerminalMoveModalProps) {
    const { t, lang } = useI18n();
  const [reason, setReason] = useState("");

  if (!opportunity) return null;

  const isWon = targetFlag === "WON";
  const title = isWon ? t.crm.opportunityClosedSuccessfull : t.crm.lossOfOpportunity;
  const description = isWon 
    ? lang === "ar" ? `أنت على وشك إغلاق فرصة "${opportunity.title}" بنجاح. يمكنك إضافة ملاحظات الإغلاق أدناه.` : `You are about to successfully close the opportunity "${opportunity.title}". You can add closing notes below.`
    : lang === "ar" ? `أنت على وشك تحديد فرصة "${opportunity.title}" كخسارة. يرجى تحديد سبب الخسارة أدناه.` : `You are about to mark the opportunity "${opportunity.title}" as lost. Please specify the reason for the loss below.`;

  const handleConfirm = async () => {
    if (await onConfirm(reason)) setReason("");
  };

  const close = () => {
    if (isSubmitting) return;
    setReason("");
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={close} closeDisabled={isSubmitting} title={title}>
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
            maxLength={1000}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={isWon ? t.crm.writeYourCommentsHere : t.crm.whyDidWeLoseThisOpportuni}
          />
        </div>

        {error ? (
          <p
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
          >
            {error}
          </p>
        ) : null}

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="ghost" onClick={close} disabled={isSubmitting}>
            {t.crm.cancellation}</Button>
          <Button 
            variant={isWon ? "primary" : "danger"} 
            onClick={handleConfirm}
            disabled={isSubmitting || (!isWon && reason.trim() === "")}
          >
            {t.crm.toBeSure}{isWon ? t.crm.winning : t.crm.loss}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
