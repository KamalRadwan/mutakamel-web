"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";

interface CreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { widgetName: string; widgetType: "chart" | "kpi_card" | "table" | "gauge"; dataSourceApi: string; size: "1x1" | "2x1" | "2x2" | "3x2" }) => void;
}

export function CreateTradeDashboardWidgetsModal({ isOpen, onClose, onSubmit }: CreateModalProps) {
  const [widgetName, setWidgetName] = useState("");
  const [widgetType, setWidgetType] = useState<"chart" | "kpi_card" | "table" | "gauge">("chart");
  const [dataSourceApi, setDataSourceApi] = useState("/api/tenant/trade/v1/analytics/");
  const [size, setSize] = useState<"1x1" | "2x1" | "2x2" | "3x2">("2x2");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!widgetName) return;
    onSubmit({ widgetName, widgetType, dataSourceApi, size });
    setWidgetName("");
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="إضافة ودجت جديدة لكتالوج التجارية" maxWidth="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="اسم الويدجت" placeholder="مثال: مؤشر المخزون المتاح" value={widgetName} onChange={(e) => setWidgetName(e.target.value)} required />
        <div className="grid grid-cols-2 gap-3">
          <Select
            label="نوع العرض Widget Type"
            value={widgetType}
            onChange={(e) => setWidgetType(e.target.value as typeof widgetType)}
            options={[
              { label: "رسم بياني (Chart)", value: "chart" },
              { label: "بطاقة مؤشر (KPI Card)", value: "kpi_card" },
              { label: "جدول بيانات (Table)", value: "table" },
              { label: "عداد قياس (Gauge)", value: "gauge" },
            ]}
          />
          <Select
            label="الأبعاد Size"
            value={size}
            onChange={(e) => setSize(e.target.value as typeof size)}
            options={[
              { label: "1x1 (مربع صغير)", value: "1x1" },
              { label: "2x1 (مستطيل أفقي)", value: "2x1" },
              { label: "2x2 (مربع كبير)", value: "2x2" },
              { label: "3x2 (شاشة عريضة)", value: "3x2" },
            ]}
          />
        </div>
        <Input label="رابط مصدر البيانات (Data Source API)" value={dataSourceApi} onChange={(e) => setDataSourceApi(e.target.value)} required />
        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="ghost" onClick={onClose}>إلغاء</Button>
          <Button type="submit" variant="primary">حفظ الويدجت</Button>
        </div>
      </form>
    </Modal>
  );
}
