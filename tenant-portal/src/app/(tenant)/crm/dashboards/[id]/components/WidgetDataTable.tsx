"use client";

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
import { formatNumber } from "@/lib/format/number";
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
 * It is a real `<table>` with a `<caption>`, not an `aria-label` on an SVG: a
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

  if (model.rows.length === 0) {
    return <p className="px-1 py-4 text-xs text-muted-foreground">{t.crmDashboards.noData}</p>;
  }

  function renderCell(cell: WidgetCell) {
    if (cell.kind === "money") {
      // The server already narrowed this to a double (`::float` / `Number()`),
      // so `String()` is the exact value that arrived — no further loss.
      return <Money value={String(cell.value)} currency={cell.currency ?? undefined} />;
    }
    if (cell.kind === "number") return formatNumber(cell.value, lang);
    if (cell.kind === "datetime") return <DateTime value={cell.value} />;
    return cell.text;
  }

  return (
    <Table>
      <caption className="pt-2 text-start text-2xs text-muted-foreground">{caption}</caption>
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
        {model.rows.map((row) => (
          <TableRow key={row.key}>
            {row.cells.map((cell, index) => (
              <TableCell
                key={model.columns[index]?.key ?? String(index)}
                className={model.columns[index]?.numeric ? "text-end tabular-nums" : undefined}
              >
                {index === 0 && onDrilldown ? (
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
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
