"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/ToastContext";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Save } from "lucide-react";

export default function WidgetGeneralPage() {
  const toast = useToast();
  const [widgetName, setWidgetName] = useState("حركة الإيرادات اليومية حسب الفرع (Daily Sales Trend)");
  const [widgetType, setWidgetType] = useState("chart");
  const [dataSourceApi, setDataSourceApi] = useState("/api/tenant/trade/v1/analytics/daily-revenue");
  const [size, setSize] = useState("2x2");

  const handleInlineSave = (e: React.FormEvent) => {
    e.preventDefault();
    toast.saved();
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-6">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">التعديل المباشر للويدجت التجارية</h2>
          <p className="text-xs text-slate-500">قم بتحديث اسم الويدجت ورابط الـ API فورياً</p>
        </div>
      </div>

      <form onSubmit={handleInlineSave} className="space-y-4 max-w-2xl">
        <Input label="اسم الويدجت" value={widgetName} onChange={(e) => setWidgetName(e.target.value)} required />
        <Input label="مصدر البيانات API" value={dataSourceApi} onChange={(e) => setDataSourceApi(e.target.value)} required />
        <div className="grid grid-cols-2 gap-4">
          <Select
            label="نوع العرض"
            value={widgetType}
            onChange={(e) => setWidgetType(e.target.value)}
            options={[
              { label: "رسم بياني (Chart)", value: "chart" },
              { label: "بطاقة مؤشر (KPI Card)", value: "kpi_card" },
            ]}
          />
          <Select
            label="الأبعاد"
            value={size}
            onChange={(e) => setSize(e.target.value)}
            options={[
              { label: "2x2", value: "2x2" },
              { label: "1x1", value: "1x1" },
            ]}
          />
        </div>

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
