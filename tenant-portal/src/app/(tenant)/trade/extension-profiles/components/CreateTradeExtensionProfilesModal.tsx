"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

interface CreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { extensionName: string; pluginId: string; moduleTarget: string; version: string }) => void;
}

export function CreateTradeExtensionProfilesModal({ isOpen, onClose, onSubmit }: CreateModalProps) {
  const [extensionName, setExtensionName] = useState("");
  const [pluginId, setPluginId] = useState("ext-custom-plugin");
  const [moduleTarget, setModuleTarget] = useState("trade-app");
  const [version, setVersion] = useState("v1.0.0");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!extensionName) return;
    onSubmit({ extensionName, pluginId, moduleTarget, version });
    setExtensionName("");
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="إضافة بروفايل ملحق وسيع موديول التجارة (Extension Profile)" maxWidth="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="اسم الملحق التوسعي" placeholder="مثال: ملحق حساب نقاط الولاء" value={extensionName} onChange={(e) => setExtensionName(e.target.value)} required />
        <Input label="معرف الملحق Plugin ID" value={pluginId} onChange={(e) => setPluginId(e.target.value)} required />
        <div className="grid grid-cols-2 gap-3">
          <Input label="المكون المستهدف Target" value={moduleTarget} onChange={(e) => setModuleTarget(e.target.value)} required />
          <Input label="الإصدار Version" value={version} onChange={(e) => setVersion(e.target.value)} required />
        </div>
        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="ghost" onClick={onClose}>إلغاء</Button>
          <Button type="submit" variant="primary">حفظ الملحق</Button>
        </div>
      </form>
    </Modal>
  );
}
