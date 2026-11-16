"use client";

import { useState } from "react";

import {
  Button,
  DateTime,
  Money,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatDecimalString, formatNumber } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import type { WidgetCell, WidgetTableModel } from "../../widget-view";

interface WidgetDataTableProps {
  model: WidgetTableModel;
  caption: string;
  /** Offered only where the row key is a drillable point key — see the tile. */
  onDrilldown?: (pointKey: string, label: string) => void;
  drilldownLabel?: string;
}

/**
 * The text equivalent of a chart, and the renderer for every visualization the
 * design system cannot draw.
 *
 * It is a real `Table` with a `caption`, not an `aria-label` on an SVG: a
 * screen reader can move through a table cell by cell, and cannot read a
 * canvas of shapes at all (docs/design/accessibility.md).
 */
export function WidgetDataTable({
  model,
  caption,
  onDrilldown,
  drilldownLabel,
}: WidgetDataTableProps) {
  const { t, lang } = useI18n();
  const [page, setPage] = useState({ model, visible: 50 });
  const visible = page.model === model ? page.visible : 50;
  const shown = Math.min(visible, model.rows.length);

  if (model.rows.length === 0) {
    return <p className="px-1 py-4 text-xs text-muted-foreground">{t.crmDashboards.noData}</p>;
  }

  function renderCell(cell: WidgetCell) {
    if (cell.kind === "missing") return model.compactMissing
      ? <><span aria-hidden="true">—</span><span className="sr-only">{t.common.noData}</span></>
      : t.common.noData;
    if (cell.kind === "money") {
      // The server already narrowed this to a double (`::float` / `Number()`),
      // so `String()` is the exact value that arrived — no further loss.
      return <Money value={String(cell.value)} currency={cell.currency ?? undefined} maximumFractionDigits={20} />;
    }
    if (cell.kind === "number") return formatNumber(cell.value, lang, {
      maximumFractionDigits: 20,
      ...(cell.signed ? { signDisplay: "exceptZero" } : {}),
      ...(cell.value !== 0 && Math.abs(cell.value) < 1e-20 ? { notation: "scientific", maximumSignificantDigits: 17 } : {}),
      ...(cell.unit === "PERCENT" ? { style: "unit", unit: "percent" } : cell.unit === "DURATION" ? { style: "unit", unit: "minute", unitDisplay: "short" } : {}),
    });
    if (cell.kind === "decimal") return formatDecimalString(cell.value, lang, cell.currency
      ? { style: "currency", currency: cell.currency, currencyDisplay: "code", minimumFractionDigits: 2, maximumFractionDigits: 3 }
      : { style: "unit", unit: "percent", maximumFractionDigits: 2 });
    if (cell.kind === "datetime") return <DateTime value={cell.value} />;
    if (cell.swatch) return <span className="inline-flex min-w-0 items-center gap-1.5">
      <span aria-hidden="true" className="size-2.5 shrink-0 rounded-sm" style={{ backgroundColor: cell.swatch }} />
      <bdi dir="auto">{cell.text}</bdi>
    </span>;
    return <bdi dir="auto">{cell.text}</bdi>;
  }

  return (
    <div className="space-y-2"><Table>
      <caption className="pt-2 text-start text-2xs text-muted-foreground">{caption} · {t.crmWidgets.review.fullValues}</caption>
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
        {model.rows.slice(0, visible).map((row) => (
          <TableRow key={row.key} className={row.total ? "bg-muted font-medium" : undefined}>
            {row.cells.map((cell, index) => {
              const signedRate = cell.kind === "number" && cell.signed && cell.unit === "PERCENT" ? cell.value : 0;
              const tone = signedRate > 0 ? " text-positive-700 dark:text-positive-400"
                : signedRate < 0 ? " text-negative-700 dark:text-negative-400" : "";
              return (
                <TableCell
                  key={model.columns[index]?.key ?? String(index)}
                  className={model.columns[index]?.numeric ? `text-end tabular-nums${tone}` : undefined}
                >
                  {index === 0 && !row.total && onDrilldown ? (
                    <Button
                      variant="link"
                      size="sm"
                      className="h-auto p-0"
                      onClick={() =>
                        onDrilldown(row.key, cell.kind === "text" ? cell.text : row.key)
                      }
                    >
                      {renderCell(cell)}
                      <span className="sr-only">{drilldownLabel}</span>
                    </Button>
                  ) : (
                    renderCell(cell)
                  )}
                </TableCell>
              );
            })}
          </TableRow>
        ))}
      </TableBody>
    </Table>
      {model.rows.length > 50 && <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <p>{formatTemplate(t.crmDashboards.tableRowsShown, { shown: formatNumber(shown, lang), total: formatNumber(model.rows.length, lang) })}</p>
        {shown < model.rows.length && <Button variant="outline" size="sm" onClick={() => setPage({ model, visible: visible + 50 })}>{t.crmDashboards.showMoreTableRows}</Button>}
      </div>}
    </div>
  );
}
