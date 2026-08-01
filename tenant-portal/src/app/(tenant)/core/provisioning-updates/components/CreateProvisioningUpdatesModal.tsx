"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

interface CreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { version: string; releaseNotes: string; targetComponent: string }) => void;
}

export function CreateProvisioningUpdatesModal({ isOpen, onClose, onSubmit }: CreateModalProps) {
  const [version, setVersion] = useState("v2.5.1");
  const [targetComponent, setTargetComponent] = useState("Core Database Schema");
  const [releaseNotes, setReleaseNotes] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!version || !releaseNotes) return;
    onSubmit({ version, releaseNotes, targetComponent });
    setReleaseNotes("");
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="جدولة تحديث نظام للمستأجر (Provisioning Update)" maxWidth="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Input label="رقم الإصدار (Version)" value={version} onChange={(e) => setVersion(e.target.value)} required />
          <Input label="المكون المستهدف" value={targetComponent} onChange={(e) => setTargetComponent(e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">ملاحظات الإصدار (Release Notes)</label>
          <textarea
            rows={3}
            value={releaseNotes}
            onChange={(e) => setReleaseNotes(e.target.value)}
            className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
            required
          />
        </div>
        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="ghost" onClick={onClose}>إلغاء</Button>
          <Button type="submit" variant="primary">جدولة التحديث</Button>
        </div>
      </form>
    </Modal>
  );
}
