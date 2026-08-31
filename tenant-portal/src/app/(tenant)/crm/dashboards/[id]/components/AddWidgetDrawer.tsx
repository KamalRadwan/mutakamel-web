"use client";

import { useState } from "react";
import {
  Field,
  FormDrawer,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import type { WidgetDefinition } from "../../widget-contract";

interface AddWidgetDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  widgets: WidgetDefinition[];
  placedWidgetIds: ReadonlySet<string>;
  widgetsUnavailable: boolean;
  isSubmitting: boolean;
  atCapacity: boolean;
  error?: string;
  onSubmit: (widgetId: string) => void;
}

export function AddWidgetDrawer({
  open,
  onOpenChange,
  widgets,
  placedWidgetIds,
  widgetsUnavailable,
  isSubmitting,
  atCapacity,
  error,
  onSubmit,
}: AddWidgetDrawerProps) {
  const { t } = useI18n();
  const [widgetId, setWidgetId] = useState<string>("");

  // A widget already on the dashboard is a `409
  // CRM_DASHBOARD_WIDGET_ALREADY_ADDED`, so it is not offered at all.
  const options = widgets.filter((widget) => !placedWidgetIds.has(widget.id));

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={t.crmDashboards.addWidget}
      description={t.crmDashboards.addWidgetDescription}
      isDirty={widgetId.length > 0}
      isSubmitting={isSubmitting}
      submitDisabled={widgetId.length === 0 || atCapacity}
      onSubmit={() => {
        if (widgetId.length > 0) onSubmit(widgetId);
      }}
      error={error}
      labels={{
        submit: t.crmDashboards.addWidgetSubmit,
        cancel: t.common.cancel,
        discardTitle: t.common.discardTitle,
        discardDescription: t.common.discardDescription,
        discardConfirm: t.common.discardConfirm,
        discardCancel: t.common.cancel,
      }}
    >
      {atCapacity ? (
        <p role="note" className="text-xs text-muted-foreground">
          {formatTemplate(t.crmDashboards.widgetLimitReached, { limit: 20 })}
        </p>
      ) : null}

      {widgetsUnavailable ? (
        <p role="note" className="text-xs text-muted-foreground">
          {t.crmDashboards.widgetsUnavailable}
        </p>
      ) : options.length === 0 ? (
        <p role="note" className="text-xs text-muted-foreground">
          {t.crmDashboards.noWidgetsToAdd}
        </p>
      ) : (
        <Field label={t.crmDashboards.widget} required>
          <Select value={widgetId} onValueChange={setWidgetId} disabled={atCapacity}>
            <SelectTrigger>
              <SelectValue placeholder={t.crmDashboards.selectWidget} />
            </SelectTrigger>
            <SelectContent>
              {options.map((widget) => (
                <SelectItem key={widget.id} value={widget.id}>
                  {`${widget.name} · ${
                    t.crmDashboards.visualizations[widget.visualizationType] ??
                    widget.visualizationType
                  }`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      )}

      <p className="text-xs text-muted-foreground">{t.crmDashboards.addWidgetPositionNote}</p>
    </FormDrawer>
  );
}
