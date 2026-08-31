"use client";

import {
  DateTime,
  DegradedBanner,
  Money,
  StatCard,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatNumber } from "@/lib/format/number";
import { displayWarnings, type WidgetResult } from "../../dashboards/dashboard-run-contract";
import { formatMetricValue, widgetTableModel } from "../../dashboards/widget-view";

interface WidgetPreviewProps {
  result: WidgetResult;
}

/**
 * `POST /widgets/preview` rendered as **values**, not as a drawing.
 *
 * The chart lives on the dashboard, where the widget is placed. A preview's
 * job is to answer "did this query produce the numbers I meant?", which the
 * table answers better than a 200 px sketch — and it is the same table the
 * dashboard renders beside every chart as its text equivalent.
 */
export function WidgetPreview({ result }: WidgetPreviewProps) {
  const { t, lang } = useI18n();
  const model = widgetTableModel(result, {
    label: t.crmDashboards.pointLabel,
    value: t.crmDashboards.pointValue,
  });
  const warnings = displayWarnings(result.warnings);

  return (
    <div className="flex flex-col gap-2">
      {result.value !== null ? (
        <StatCard
          label={t.crmDashboards.currentValue}
          value={formatMetricValue(result.value, result.unit, result.currency, lang)}
        />
      ) : null}

      {warnings.length > 0 ? (
        <DegradedBanner
          message={warnings
            .map((warning) => t.crmDashboards.widgetWarnings[warning] ?? warning)
            .join(" · ")}
        />
      ) : null}

      {model.rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t.crmDashboards.noData}</p>
      ) : (
        <Table>
          <caption className="pt-2 text-start text-2xs text-muted-foreground">
            {t.crmWidgets.previewCaption}
          </caption>
          <TableHeader>
            <TableRow>
              {model.columns.map((column) => (
                <TableHead
                  key={column.key}
                  scope="col"
                  className={column.numeric ? "text-end" : undefined}
                >
                  {column.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {model.rows.slice(0, 12).map((row) => (
              <TableRow key={row.key}>
                {row.cells.map((cell, index) => (
                  <TableCell
                    key={model.columns[index]?.key ?? String(index)}
                    className={model.columns[index]?.numeric ? "text-end tabular-nums" : undefined}
                  >
                    {cell.kind === "money" ? (
                      <Money value={String(cell.value)} currency={cell.currency ?? undefined} />
                    ) : cell.kind === "number" ? (
                      formatNumber(cell.value, lang)
                    ) : cell.kind === "datetime" ? (
                      <DateTime value={cell.value} />
                    ) : (
                      cell.text
                    )}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
