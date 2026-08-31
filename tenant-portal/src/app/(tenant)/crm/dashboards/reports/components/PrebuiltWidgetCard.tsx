"use client";

import {
  Card,
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
import { formatTemplate } from "@/lib/format/template";
import type { PrebuiltWidgetSpec, PrebuiltWidgetValue } from "../../prebuilt-contract";

interface PrebuiltWidgetCardProps {
  spec: PrebuiltWidgetSpec;
  value: PrebuiltWidgetValue;
}

/** Columns whose value is money, and the column that names its currency. */
const MONEY_COLUMNS = new Set(["value"]);
const INSTANT_COLUMNS = new Set(["updatedAt", "createdAt", "dueAt"]);
/** Columns whose value is a server enum, not tenant text. */
const ENUM_COLUMNS = new Set(["status", "type"]);

export function PrebuiltWidgetCard({ spec, value }: PrebuiltWidgetCardProps) {
  const { t, lang } = useI18n();
  const title = t.crmDashboardReports.widgets[spec.key] ?? spec.key;

  return (
    <Card className="flex flex-col gap-2 p-3">
      <h3 className="text-sm font-medium text-foreground">{title}</h3>
      {renderValue()}
    </Card>
  );

  function renderValue() {
    if (value.kind === "UNAVAILABLE") {
      return <p className="text-xs text-muted-foreground">{t.crmDashboardReports.unavailable}</p>;
    }
    if (value.kind === "COUNT") {
      return <StatCard label={title} value={formatNumber(value.value, lang)} />;
    }
    if (value.kind === "CONVERSION") {
      return (
        <div className="flex flex-col gap-1">
          <StatCard
            label={t.crmDashboardReports.conversionRate}
            // `rate` is a ratio in 0..1 — `converted / total` — so this is the
            // one place `style: "percent"` is correct on this screen.
            value={formatNumber(value.rate, lang, { style: "percent", maximumFractionDigits: 1 })}
          />
          <p className="text-2xs text-muted-foreground">
            {formatTemplate(t.crmDashboardReports.convertedOf, {
              converted: value.converted,
              total: value.total,
            })}
          </p>
        </div>
      );
    }
    if (value.kind === "CALENDAR") {
      return (
        <div className="flex flex-col gap-1">
          <StatCard
            label={t.crmDashboardReports.calendarMinutes}
            value={formatNumber(value.minutes, lang, {
              style: "unit",
              unit: "minute",
              unitDisplay: "short",
              maximumFractionDigits: 0,
            })}
          />
          <p className="text-2xs text-muted-foreground">
            {formatTemplate(t.crmDashboardReports.eventCount, { count: value.count })}
          </p>
        </div>
      );
    }
    if (value.kind === "MISSING_OWNER") {
      return (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <StatCard
            label={t.crmDashboardReports.missingOwnerOpportunities}
            value={formatNumber(value.opportunities, lang)}
          />
          <StatCard
            label={t.crmDashboardReports.missingOwnerLeads}
            value={formatNumber(value.leads, lang)}
          />
          <StatCard
            label={t.crmDashboardReports.missingOwnerCustomers}
            value={formatNumber(value.customerProfiles, lang)}
          />
        </div>
      );
    }
    if (value.kind === "MONEY_TOTALS") {
      return (
        <div className="flex flex-col gap-1.5">
          {value.total ? (
            <StatCard
              label={value.total.currencyCode}
              value={formatNumber(value.total.value, lang, { maximumFractionDigits: 2 })}
            />
          ) : null}
          {/* `currencyTotals` emits MULTI_CURRENCY_SPLIT and no single total
              when more than one currency is present — the per-currency rows
              are the answer, not a summed one. */}
          {value.warnings.includes("MULTI_CURRENCY_SPLIT") ? (
            <DegradedBanner message={t.crmDashboardReports.multiCurrencySplit} />
          ) : null}
          {value.byCurrency.length > 0 ? (
            <ul className="flex flex-col gap-0.5">
              {value.byCurrency.map((total) => (
                <li key={total.currencyCode} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{total.currencyCode}</span>
                  <Money value={String(total.value)} currency={total.currencyCode} />
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      );
    }

    const columns = spec.columns ?? [];
    if (value.rows.length === 0) {
      return <p className="text-xs text-muted-foreground">{t.crmDashboardReports.noRows}</p>;
    }
    return (
      <Table>
        <caption className="pt-2 text-start text-2xs text-muted-foreground">{title}</caption>
        <TableHeader>
          <TableRow>
            {columns.map((column) => (
              <TableHead key={column} scope="col">
                {t.crmDashboardReports.columns[column] ?? column}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {value.rows.map((row, index) => (
            <TableRow key={typeof row.id === "string" ? row.id : `row-${index}`}>
              {columns.map((column) => (
                <TableCell key={column}>{renderCell(row, column)}</TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }

  function renderCell(row: Record<string, unknown>, column: string) {
    const cell = row[column];
    if (cell === null || cell === undefined) return "";
    if (typeof cell === "number") {
      if (MONEY_COLUMNS.has(column)) {
        const currency = typeof row.currencyCode === "string" ? row.currencyCode : undefined;
        // `::float` on the server — this is already a double, and `String()`
        // is its exact form. See docs/api/crm-dashboards.md.
        return <Money value={String(cell)} currency={currency} />;
      }
      return formatNumber(cell, lang);
    }
    if (typeof cell === "string" && INSTANT_COLUMNS.has(column)) {
      return <DateTime value={cell} />;
    }
    // An enum value never reaches the screen raw. An unmapped one falls
    // through to its wire value in mono, which is how a backend enum addition
    // stays visible instead of blank.
    if (typeof cell === "string" && ENUM_COLUMNS.has(column)) {
      const label = t.crmDashboardReports.statusValues[cell];
      return label ?? <code className="font-mono text-2xs">{cell}</code>;
    }
    // `reason` is two different things: an enum on `dataCleanupItems`
    // (MISSING_AMOUNT / MISSING_CURRENCY / MISSING_OWNER / CHECK_RECORD) and
    // free tenant text on `lostReasons`. Label the ones that are enums and
    // pass the rest through as the text they are.
    if (typeof cell === "string" && column === "reason") {
      return t.crmDashboardReports.statusValues[cell] ?? cell;
    }
    return String(cell);
  }
}
