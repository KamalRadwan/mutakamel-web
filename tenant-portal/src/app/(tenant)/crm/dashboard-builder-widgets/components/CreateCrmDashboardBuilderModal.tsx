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
  onSubmit: (data: { name: string; type: "chart_bar" | "chart_line" | "stat_card" | "funnel"; metric: string; refreshInterval: string }) => void;
}

export function CreateCrmDashboardBuilderModal({ isOpen, onClose, onSubmit }: CreateModalProps) {
    const { t } = useI18n();
  const [name, setName] = useState("");
  const [type, setType] = useState<"chart_bar" | "chart_line" | "stat_card" | "funnel">("chart_bar");
  const [metric, setMetric] = useState(t.crm.totalValueOfClosedTrades);
  const [refreshInterval, setRefreshInterval] = useState("5 mins");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    onSubmit({ name, type, metric, refreshInterval });
    setName("");
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t.crm.addAndManageTheWidgetInT} maxWidth="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label={t.crm.widgetName} placeholder={t.crm.exampleAChartOfMajorTrad} value={name} onChange={(e) => setName(e.target.value)} required />
        <div className="grid grid-cols-2 gap-3">
          <Select
            label={t.crm.drawingWidgetType}
            value={type}
            onChange={(e) => setType(e.target.value as any)}
            options={[
              { label: t.crm.barChart, value: "chart_bar" },
              { label: t.crm.lineChart, value: "chart_line" },
              { label: t.crm.statCard, value: "stat_card" },
              { label: t.crm.funnel, value: "funnel" },
            ]}
          />
          <Input label={t.crm.targetMetric} value={metric} onChange={(e) => setMetric(e.target.value)} required />
        </div>
        <Select
          label={t.crm.autoRefreshRate}
          value={refreshInterval}
          onChange={(e) => setRefreshInterval(e.target.value)}
          options={[
            { label: t.crm.realTime, value: "Real-time" },
            { label: t.crm.every5Minutes, value: "5 mins" },
            { label: t.crm.every15Minutes, value: "15 mins" },
          ]}
        />
        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="ghost" onClick={onClose}>{t.crm.cancellation}</Button>
          <Button type="submit" variant="primary">{t.crm.addTheWidget}</Button>
        </div>
      </form>
    </Modal>
  );
}
