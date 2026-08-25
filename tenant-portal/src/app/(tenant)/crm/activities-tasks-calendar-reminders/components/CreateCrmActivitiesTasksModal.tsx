"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { useI18n } from "@/i18n/I18nContext";

interface CreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { subject: string; leadOrCustomer: string; taskType: "call" | "meeting" | "demo" | "reminder"; dueDate: string }) => void;
}

export function CreateCrmActivitiesTasksModal({ isOpen, onClose, onSubmit }: CreateModalProps) {
    const { t } = useI18n();
  const [subject, setSubject] = useState("");
  const [leadOrCustomer, setLeadOrCustomer] = useState(t.crm.alAmalMedicalSuppliesCompa);
  const [taskType, setTaskType] = useState<"call" | "meeting" | "demo" | "reminder">("demo");
  const [dueDate, setDueDate] = useState("2026-07-29 10:00");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject) return;
    onSubmit({ subject, leadOrCustomer, taskType, dueDate });
    setSubject("");
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t.crm.scheduleANewCRMTaskCalend} maxWidth="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label={t.crm.taskTopic} placeholder={t.crm.exampleSubmittingATechnica} value={subject} onChange={(e) => setSubject(e.target.value)} required />
        <Input label={t.crm.associatedClient} value={leadOrCustomer} onChange={(e) => setLeadOrCustomer(e.target.value)} required />
        <div className="grid grid-cols-2 gap-3">
          <Select
            label={t.crm.typeOfEvent}
            value={taskType}
            onChange={(e) => setTaskType(e.target.value as typeof taskType)}
            options={[
              { label: t.crm.demo, value: "demo" },
              { label: t.crm.call, value: "call" },
              { label: t.crm.businessMeeting, value: "meeting" },
              { label: t.crm.generalReminder, value: "reminder" },
            ]}
          />
          <Input label={t.crm.dateAndTime} value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />
        </div>
        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="ghost" onClick={onClose}>{t.crm.cancellation}</Button>
          <Button type="submit" variant="primary">{t.crm.scheduleTheTask}</Button>
        </div>
      </form>
    </Modal>
  );
}
