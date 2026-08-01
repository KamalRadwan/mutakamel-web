"use client";

import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useState } from "react";
import type { OpportunityRecord, StageFlag } from "../../models/pipeline-types";

interface TerminalMoveModalProps {
  isOpen: boolean;
  onClose: () => void;
  opportunity: OpportunityRecord | null;
  targetFlag: StageFlag;
  onConfirm: (reason: string) => void;
}

export function TerminalMoveModal({ isOpen, onClose, opportunity, targetFlag, onConfirm }: TerminalMoveModalProps) {
  const [reason, setReason] = useState("");

  if (!opportunity) return null;

  const isWon = targetFlag === "WON";
  const title = isWon ? "إغلاق الفرصة بنجاح (فوز)" : "خسارة الفرصة";
  const description = isWon 
    ? `أنت على وشك إغلاق فرصة "${opportunity.title}" بنجاح. يمكنك إضافة ملاحظات الإغلاق أدناه.`
    : `أنت على وشك تحديد فرصة "${opportunity.title}" كخسارة. يرجى تحديد سبب الخسارة أدناه.`;

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
            {isWon ? "ملاحظات إضافية (اختياري)" : "سبب الخسارة (مطلوب)"}
          </label>
          <textarea
            className="w-full p-2 border rounded-md dark:bg-gray-800 dark:border-gray-700 dark:text-white"
            rows={4}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={isWon ? "اكتب ملاحظاتك هنا..." : "لماذا خسرنا هذه الفرصة؟"}
          />
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="ghost" onClick={onClose}>
            إلغاء
          </Button>
          <Button 
            variant={isWon ? "primary" : "danger"} 
            onClick={handleConfirm}
            disabled={!isWon && reason.trim() === ""}
          >
            تأكيد {isWon ? "الفوز" : "الخسارة"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
