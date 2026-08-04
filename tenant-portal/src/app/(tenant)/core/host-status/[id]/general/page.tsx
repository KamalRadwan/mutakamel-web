"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/ToastContext";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Save } from "lucide-react";

export default function HostStatusGeneralPage() {
  const toast = useToast();
  const [fqdn, setFqdn] = useState("tenant.mutakamel.ai");
  const [subdomain, setSubdomain] = useState("tenant");
  const [ipAddress, setIpAddress] = useState("167.99.12.34");

  const handleInlineSave = (e: React.FormEvent) => {
    e.preventDefault();
    toast.saved();
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-6">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">التعديل المباشر للنطاق</h2>
          <p className="text-xs text-slate-500">قم بتحديث مسار الـ FQDN و IP الخادم مباشرة</p>
        </div>
      </div>

      <form onSubmit={handleInlineSave} className="space-y-4 max-w-2xl">
        <Input label="النطاق الكامل FQDN" value={fqdn} onChange={(e) => setFqdn(e.target.value)} required />
        <Input label="النطاق الفرعي Subdomain" value={subdomain} onChange={(e) => setSubdomain(e.target.value)} required />
        <Input label="عنوان السيرفر IP" value={ipAddress} onChange={(e) => setIpAddress(e.target.value)} required />

        <div className="pt-2">
          <Button type="submit" variant="primary">
            <Save className="w-4 h-4" />
            <span>حفظ التعديلات المباشرة</span>
          </Button>
        </div>
      </form>
    </div>
  );
}
