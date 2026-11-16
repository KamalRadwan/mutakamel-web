"use client";
import { Activity, AlertTriangle, Bell, Calendar, CheckSquare, FileText, Mail, MapPin, Phone } from "lucide-react";
import { Badge, DateTime, swatchSurfacePalette, type SwatchHue } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import type { WidgetResult } from "../../dashboard-run-contract";

export function AlertListView({
  result,
  label,
}: {
  result: WidgetResult;
  label: string;
}) {
  const { t } = useI18n();
  const rawRows = Array.isArray(result.typedResult?.rows)
    ? (result.typedResult.rows as Array<Record<string, unknown>>)
    : result.rows;

  const isCriticalSeverity = (severity: unknown): boolean =>
    severity === "CRITICAL";

  const criticalCount = rawRows.filter((row) => isCriticalSeverity(row.severity)).length;
  const warningCount = rawRows.filter((row) => row.severity === "WARNING").length;

  return (
    <div role="region" aria-label={label} className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-1.5">
        {criticalCount > 0 && (
          <Badge tone="negative">
            {formatTemplate(t.crmDashboards.criticalAlerts, { count: criticalCount })}
          </Badge>
        )}
        {warningCount > 0 && (
          <Badge tone="caution">
            {formatTemplate(t.crmDashboards.warningAlerts, { count: warningCount })}
          </Badge>
        )}
      </div>

      <div className="max-h-64 space-y-2 overflow-y-auto pe-1">
        {rawRows.map((row, index) => {
          const isCritical = isCriticalSeverity(row.severity);
          const palette = swatchSurfacePalette(isCritical ? "red" : row.severity === "WARNING" ? "amber" : row.severity === "SUCCESS" ? "green" : "blue");
          const title = typeof row.title === "string" ? row.title : "—";
          const reason =
            typeof row.reasonCode === "string"
              ? row.reasonCode
              : null;
          const entityRef =
            row.entityRef && typeof row.entityRef === "object"
              ? (row.entityRef as Record<string, unknown>)
              : null;
          const entityType =
            typeof entityRef?.type === "string"
              ? entityRef.type
              : null;
          const occurredAt = typeof row.occurredAt === "string" ? row.occurredAt : null;

          return (
            <div
              key={typeof row.id === "string" ? row.id : `alert-${index}`}
              className={`flex items-start justify-between gap-3 rounded-md border border-border border-s-4 bg-card p-2.5 ${palette.accentBorder}`}
            >
              <div className="flex min-w-0 items-start gap-2.5">
                <span
                  className={`mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-sm ${palette.iconBoxIdle}`}
                >
                  <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tone={isCritical ? "negative" : row.severity === "WARNING" ? "caution" : row.severity === "SUCCESS" ? "positive" : "neutral"}>
                      {t.crmDashboards.typedTable[row.severity as "CRITICAL" | "WARNING" | "SUCCESS" | "INFO"] ?? t.crmDashboards.scorecardStatuses.UNKNOWN}
                    </Badge>
                    <p className="text-xs font-semibold text-foreground">{title}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-2xs text-muted-foreground">
                    {entityType && (
                      <Badge className={`border normal-case tracking-normal ${palette.badge}`}>
                        {t.crmDashboardReports.statusValues[entityType] ?? t.crmDashboards.unknownEntityType}
                      </Badge>
                    )}
                    {reason && (
                      <span>
                        {t.crmDashboardReports.statusValues[reason] ?? t.crmDashboards.unknownAlertReason}
                      </span>
                    )}
                    {occurredAt && <DateTime value={occurredAt} />}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ActivityFeedView({
  result,
  label,
}: {
  result: WidgetResult;
  label: string;
}) {
  const { t, lang } = useI18n();
  const events = Array.isArray(result.typedResult?.events)
    ? (result.typedResult.events as Array<Record<string, unknown>>)
    : [];

  const eventVisual = (eventType: string): { hue: SwatchHue; Icon: typeof Activity } => {
    const normalized = eventType.toUpperCase();
    if (normalized.includes("CALL")) return { hue: "green", Icon: Phone };
    if (normalized.includes("MEETING") || normalized.includes("CALENDAR")) {
      return { hue: "blue", Icon: Calendar };
    }
    if (normalized.includes("EMAIL")) return { hue: "purple", Icon: Mail };
    if (normalized.includes("VISIT")) return { hue: "teal", Icon: MapPin };
    if (normalized.includes("TASK") || normalized.includes("FOLLOW_UP")) {
      return { hue: "amber", Icon: CheckSquare };
    }
    if (normalized.includes("REMINDER")) return { hue: "orange", Icon: Bell };
    if (normalized.includes("NOTE")) return { hue: "indigo", Icon: FileText };
    return { hue: "indigo", Icon: Activity };
  };

  return (
    <div role="region" aria-label={label} className="space-y-2.5">
      <div className="flex items-center justify-between gap-2 text-2xs">
        <span className="text-muted-foreground">{label}</span>
      </div>
      <div className="max-h-64 space-y-2 overflow-y-auto pe-1">
        {events.map((event, index) => {
          const eventType =
            typeof event.kind === "string"
              ? event.kind
              : "ACTIVITY";
          const title = lang === "ar" && typeof event.titleAr === "string" ? event.titleAr : typeof event.title === "string" ? event.title : "—";
          const occurredAt = typeof event.occurredAt === "string" ? event.occurredAt : null;
          const { hue, Icon } = eventVisual(eventType);
          const palette = swatchSurfacePalette(hue);

          return (
            <div
              key={typeof event.id === "string" ? event.id : `event-${index}`}
              className="flex items-start justify-between gap-3 rounded-md border border-border bg-card p-2.5"
            >
              <div className="flex min-w-0 items-start gap-2.5">
                <span
                  className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${palette.iconBoxIdle}`}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
                <div className="min-w-0 space-y-0.5">
                  <p className="text-xs font-semibold text-foreground">{title}</p>
                  <div className="flex flex-wrap items-center gap-1.5 text-2xs text-muted-foreground">
                    <Badge
                      className={`border normal-case tracking-normal ${palette.badge}`}
                    >
                      {t.crmDashboardReports.statusValues[eventType] ?? t.crmDashboards.unknownActivityType}
                    </Badge>
                    <span>{t.crmDashboards.typedTable[event.severity as "CRITICAL" | "WARNING" | "SUCCESS" | "INFO"] ?? t.crmDashboards.scorecardStatuses.UNKNOWN}</span>
                  </div>
                  {typeof event.description === "string" && <p className="text-xs text-muted-foreground"><bdi>{event.description}</bdi></p>}
                </div>
              </div>
              {occurredAt && (
                <div className="shrink-0 text-2xs text-muted-foreground tabular-nums">
                  <DateTime value={occurredAt} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
