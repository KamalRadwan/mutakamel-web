"use client";
import { DashboardRecoveryNotice, type DashboardRecoveryProps } from "../../components/DashboardRecoveryNotice";

import { useDashboardWidgetSelection } from "../hooks/useDashboardWidgetSelection";
import {
  Button,
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
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
  isSubmitting: boolean;
  atCapacity: boolean;
  error?: string;
  onSubmit: (widgetId: string) => void;
  blocked?: boolean;
  recovery?: DashboardRecoveryProps;
  onRetryWidgets?: () => void;
}

export function AddWidgetDrawer({
  open,
  onOpenChange,
  widgets,
  placedWidgetIds,
  widgetsUnavailable,
  hasMore,
  isLoadingMore,
  onLoadMore,
  isSubmitting,
  atCapacity,
  error,
  onSubmit,
  blocked = false,
  recovery,
  onRetryWidgets,
}: AddWidgetDrawerProps) {
  const { t } = useI18n();
  const form = useDashboardWidgetSelection(widgets, placedWidgetIds, blocked, widgetsUnavailable, atCapacity, onSubmit);
  const { widgetId, setWidgetId, options } = form;



  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={t.crmDashboards.addWidget}
      description={t.crmDashboards.addWidgetDescription}
      isDirty={widgetId.length > 0}
      isSubmitting={isSubmitting}
      submitDisabled={!form.allowed}
      onSubmit={form.submit}
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
    {recovery && <DashboardRecoveryNotice {...recovery} />}
      {atCapacity ? (
        <p role="note" className="text-xs text-muted-foreground">
          {formatTemplate(t.crmDashboards.widgetLimitReached, { limit: 20 })}
        </p>
      ) : null}

      {widgetsUnavailable ? (
        <div className="flex flex-col items-start gap-2"><p role="note" className="text-xs text-muted-foreground">{t.crmDashboards.widgetsUnavailable}</p>
          {onRetryWidgets && <Button variant="outline" onClick={onRetryWidgets}>{t.common.retry}</Button>}</div>
      ) : options.length === 0 ? (
        <p role="note" className="text-xs text-muted-foreground">
          {t.crmDashboards.noWidgetsToAdd}
        </p>
      ) : (
        <Field showLabel label={t.crmDashboards.widget} required>
          <Select value={widgetId} onValueChange={setWidgetId} disabled={blocked || isSubmitting || atCapacity}>
            <SelectTrigger size="sm">
              <SelectValue placeholder={t.crmDashboards.selectWidget} />
            </SelectTrigger>
            <SelectContent>
              {options.map((widget) => (
                <SelectItem key={widget.id} value={widget.id}>
                  {`${widget.name} · ${
                    t.crmDashboards.visualizations[widget.visualizationType] ??
                    t.crmDashboards.unknownVisualization
                  }`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      )}

      {hasMore ? (
        <Button variant="outline" disabled={isLoadingMore} loading={isLoadingMore} onClick={onLoadMore}>
          {t.crmDashboards.loadMoreWidgets}
        </Button>
      ) : null}
      <p className="text-xs text-muted-foreground">{t.crmDashboards.addWidgetPositionNote}</p>
    </FormDrawer>
  );
}



