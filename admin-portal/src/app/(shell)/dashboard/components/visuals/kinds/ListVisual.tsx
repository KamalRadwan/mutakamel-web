"use client";

import Link from "next/link";
import { useI18n } from "@/i18n/I18nContext";
import type { DashboardVisual, DashboardVisualListRow } from "@/types/dashboard";
import {
  ChartEmptyState,
  ChartFigure,
  dashboardChartVisualItems,
} from "../../charts/ChartAccessibility";
import { visualColor } from "../visual-format";

type ListVisualModel = Extract<DashboardVisual, { kind: "list" }>;

const ROW_HEIGHT = 56;

/**
 * The records behind a number, each one reachable.
 *
 * Every other kind here ends at a statistic. This one ends at the row an
 * operator has to open, so `href` becomes a real `Link` rather than a tooltip
 * — which is also why the body is not `aria-hidden`: a link nobody can reach
 * is the same as no link.
 */
export function ListVisual({ visual }: { visual: ListVisualModel }) {
  const { lang, t } = useI18n();
  const rows = visual.data.rows;

  if (rows.length === 0) {
    return <ChartEmptyState title={visual.title} lang={lang} />;
  }

  const visible = dashboardChartVisualItems(rows);
  const height = visible.length * ROW_HEIGHT + 8;
  const hidden = rows.length - visible.length;
  const linked = rows.filter((row) => row.href).length;

  const summary =
    lang === "ar"
      ? `${visual.title}: ${rows.length} سجلًا${linked ? `، ${linked} منها يفتح صفحته مباشرة` : ""}.${hidden > 0 ? ` تعرض القائمة ${visible.length} منها، والباقي في جدول القيم الدقيقة.` : ""}`
      : `${visual.title}: ${rows.length} records${linked ? `, ${linked} of them opening their own page` : ""}.${hidden > 0 ? ` The list shows ${visible.length}; the rest are in the exact-value table.` : ""}`;

  return (
    <ChartFigure
      title={visual.title}
      summary={summary}
      lang={lang}
      height={height}
      bodyHidden={false}
      // A list row names a record, not a category — the shared chart copy's
      // "Category" would be the wrong word over a column of tenant names.
      columns={[
        t.dashboard.visuals.record,
        t.dashboard.visuals.detail,
        t.dashboard.visuals.note,
      ]}
      rows={rows.map((row) => ({
        key: row.key,
        cells: [row.label, row.detail ?? "—", row.value ?? "—"],
      }))}
    >
      <ul className="flex size-full list-none flex-col gap-1 overflow-auto p-0">
        {visible.map((row) => (
          <li key={row.key}>
            <ListRowBody row={row} openLabel={t.dashboard.visuals.openRecord} />
          </li>
        ))}
      </ul>
    </ChartFigure>
  );
}

function ListRowBody({
  row,
  openLabel,
}: {
  row: DashboardVisualListRow;
  openLabel: string;
}) {
  const content = (
    <>
      {row.tone && (
        // Index 0 for every row on purpose: the dot is a status marker, not a
        // series identity, so a tone outside the semantic set should read as
        // one flat colour down the list rather than as a rainbow.
        <span
          aria-hidden="true"
          className="mt-1 size-2 shrink-0 rounded-xs"
          style={{ backgroundColor: visualColor(0, row.tone) }}
        />
      )}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        {/* A tenant name is a proper noun, never vocabulary — `dir="auto"`
            keeps a Latin name readable inside the Arabic page. */}
        <span className="truncate text-xs font-medium text-foreground" dir="auto">
          {row.label}
        </span>
        {row.detail && (
          <span className="truncate font-mono text-xs text-muted-foreground" dir="auto">
            {row.detail}
          </span>
        )}
      </span>
      {row.value && (
        <span className="shrink-0 text-end text-xs text-muted-foreground" dir="auto">
          {row.value}
        </span>
      )}
    </>
  );

  const shared = "flex min-h-11 items-start gap-2 rounded-md px-2 py-2";

  // Only an in-app route becomes a link. Every href the reports emit today is
  // one, but this panel renders whatever a provider puts in the payload, and a
  // report should never be able to send an operator off the portal.
  if (!row.href || !isInternalRoute(row.href)) {
    return <span className={shared}>{content}</span>;
  }

  return (
    <Link
      href={row.href}
      title={`${openLabel}: ${row.label}`}
      className={`${shared} outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset`}
    >
      {content}
    </Link>
  );
}

/**
 * A single leading slash and nothing else. `//host` is protocol-relative and
 * leaves the site, and anything with a scheme is external by definition.
 */
function isInternalRoute(href: string): boolean {
  return href.startsWith("/") && !href.startsWith("//");
}
