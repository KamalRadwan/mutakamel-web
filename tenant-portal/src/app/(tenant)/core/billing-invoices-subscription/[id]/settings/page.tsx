"use client";

import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";

export default function BillingInvoiceSettingsPage() {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-6 max-w-xl">
      <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">إعدادات الدفع والتجديد التلقائي</h2>
      <Select
        label="طريقة الدفع الافتراضية"
        options={[
          { label: "بطاقة ائتمانية (Stripe / Visa)", value: "card" },
          { label: "محفظة المستأجر الداخلية", value: "wallet" },
          { label: "تحويل بنكي مباشر", value: "bank" },
        ]}
      />
      <Button variant="secondary">حفظ التفضيلات</Button>
    </div>
  );
}
