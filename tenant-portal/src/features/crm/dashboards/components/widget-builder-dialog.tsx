"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useI18n } from "@/i18n/I18nContext";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { BarChart3, Settings2, LayoutTemplate, Filter, Palette } from "lucide-react";
import { DashboardWidgetRenderer } from "./dashboard-widget-renderer";
import type { CrmDashboardWidget } from "../models/dashboard-types";

const DashboardVisualizationTypeEnum = ["METRIC_CARD", "PROGRESS_CARD", "TABLE", "LEADERBOARD", "LINE", "AREA", "LINE_AREA", "COLUMN", "BAR", "STACKED_BAR", "STACKED_BAR_100", "COMBO", "PIE", "DONUT", "SCATTER", "BUBBLE", "FUNNEL", "HEATMAP", "SEMI_CIRCLE_GAUGE", "THREE_QUARTER_GAUGE", "CIRCULAR_PROGRESS_GAUGE", "DETAILED_SPEEDOMETER"] as const;

const widgetFormSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  visualizationType: z.enum(DashboardVisualizationTypeEnum),
  dataSource: z.string().min(1, "Data Source is required"),
  displaySpec: z.object({
    numberFormat: z.enum(["standard", "percent", "compact", "money"]),
    showLegend: z.boolean().optional(),
    xLabel: z.string().optional(),
    yLabel: z.string().optional(),
    options: z.any().optional(),
  }),
});

type WidgetFormValues = z.infer<typeof widgetFormSchema>;

interface WidgetBuilderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultValues?: Partial<CrmDashboardWidget>;
  onSubmit: (values: WidgetFormValues) => Promise<void>;
}

export function WidgetBuilderDialog({ open, onOpenChange, defaultValues, onSubmit }: WidgetBuilderDialogProps) {
  const { lang } = useI18n();
  const isRtl = lang === "ar";
  const [activeTab, setActiveTab] = useState("basics");

  const form = useForm<WidgetFormValues>({
    resolver: zodResolver(widgetFormSchema),
    defaultValues: {
      name: defaultValues?.name || "",
      visualizationType: defaultValues?.visualizationType || "METRIC_CARD",
      dataSource: (defaultValues?.querySpec as any)?.dataSource || "LEADS",
      displaySpec: {
        numberFormat: (defaultValues?.displaySpec?.numberFormat as any) || "standard",
        showLegend: true,
      },
    } as any,
  });

  const previewWidget = form.watch();

  const handleSave = async (values: WidgetFormValues) => {
    await onSubmit(values);
    onOpenChange(false);
  };

  const title = defaultValues?.id ? (isRtl ? "Edit the widget" : "Edit Widget") : (isRtl ? "New widget" : "New Widget");

  return (
    <Modal isOpen={open} onClose={() => onOpenChange(false)} title={title} maxWidth="2xl">
      <div className={`flex flex-col md:flex-row h-[60vh] -mx-6 -my-6 ${isRtl ? "rtl" : "ltr"}`} dir={isRtl ? "rtl" : "ltr"}>
        {/* Left Pane - Form */}
        <div className="w-full md:w-1/2 flex flex-col border-r dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900 overflow-y-auto">
          <div className="flex border-b dark:border-gray-800 px-2 pt-2 gap-1 overflow-x-auto">
            {[
              { id: "basics", icon: Settings2, label: "Basics" },
              { id: "visual", icon: BarChart3, label: "Visual" },
              { id: "data", icon: LayoutTemplate, label: "Data" },
              { id: "filters", icon: Filter, label: "Filters" },
              { id: "appearance", icon: Palette, label: "Theme" },
            ].map(tab => (
              <button 
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.id ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"}`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>

          <form id="widget-form" onSubmit={form.handleSubmit(handleSave)} className="p-4 space-y-6 flex-1">
            {activeTab === "basics" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">{isRtl ? "the name" : "Name"}</label>
                  <Input {...form.register("name")} placeholder={isRtl ? "the name" : "Name"} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{isRtl ? "Data source" : "Data Source"}</label>
                  <select {...form.register("dataSource")} className="flex h-10 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm">
                    <option value="LEADS">Leads</option>
                    <option value="DEALS">Deals</option>
                    <option value="TICKETS">Tickets</option>
                    <option value="CALLS">Calls</option>
                  </select>
                </div>
              </div>
            )}

            {activeTab === "visual" && (
              <div className="grid grid-cols-2 gap-3">
                {DashboardVisualizationTypeEnum.map((type: string) => (
                  <button 
                    key={type}
                    type="button"
                    onClick={() => form.setValue("visualizationType", type as any)}
                    className={`p-3 border rounded-lg flex flex-col items-center justify-center gap-2 transition-all ${form.watch("visualizationType") === type ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400" : "border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800"}`}
                  >
                    <span className="text-xs font-medium text-center">{type.replace(/_/g, ' ')}</span>
                  </button>
                ))}
              </div>
            )}

            {activeTab === "data" && <p className="text-sm text-gray-500">Dimensions mapping coming soon.</p>}
            {activeTab === "filters" && <p className="text-sm text-gray-500">Filters builder coming soon.</p>}
            {activeTab === "appearance" && <p className="text-sm text-gray-500">Theme builder coming soon.</p>}
          </form>
        </div>

        {/* Right Pane - Live Preview */}
        <div className="w-full md:w-1/2 p-6 flex flex-col bg-gray-100/50 dark:bg-black/20">
          <h3 className="text-sm font-medium text-gray-500 mb-4">{isRtl ? "Live preview" : "Live Preview"}</h3>
          <div className="flex-1 bg-white dark:bg-gray-900 rounded-xl border dark:border-gray-800 shadow-sm overflow-hidden flex items-center justify-center">
            <div className="w-full h-full p-4 relative">
              <DashboardWidgetRenderer 
                widget={{
                  id: defaultValues?.id || "preview-id",
                  name: previewWidget.name || "Untitled Widget",
                  visualizationType: previewWidget.visualizationType as any,
                  querySpec: { dataSource: previewWidget.dataSource as any, filters: {} },
                  displaySpec: { 
                    numberFormat: previewWidget.displaySpec?.numberFormat as any,
                  },
                  meta: {},
                } as any} 
                result={{
                  value: 125000,
                  previousValue: 110000,
                  meta: { currency: "USD", unit: "MONEY" },
                  series: [{
                    key: "series-1",
                    label: "Series 1",
                    points: [
                      { key: "A", label: "A", value: 10 },
                      { key: "B", label: "B", value: 20 },
                      { key: "C", label: "C", value: 30 }
                    ]
                  }]
                } as any}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-2 border-t pt-4">
        <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
          {isRtl ? "cancellation" : "Cancel"}
        </Button>
        <Button type="submit" form="widget-form" disabled={form.formState.isSubmitting}>
          {isRtl ? "Save the application" : "Save Widget"}
        </Button>
      </div>
    </Modal>
  );
}
