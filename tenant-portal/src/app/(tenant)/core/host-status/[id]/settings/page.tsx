"use client";

import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";

export default function HostStatusSettingsPage() {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-6 max-w-xl">
      <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">إعدادات شهادة SSL والتجديد التلقائي</h2>
      <Select
        label="مزود شهادة التشفير"
        options={[
          { label: "Let's Encrypt (Auto-Renew)", value: "letsencrypt" },
          { label: "Cloudflare Managed Certificate", value: "cloudflare" },
          { label: "Custom SSL Certificate Upload", value: "custom" },
        ]}
      />
      <Button variant="secondary">تجديد شهادة SSL فوراً</Button>
    </div>
  );
}
