"use client";

import { useI18n, type Language } from "@/i18n/I18nContext";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/design-system";
import type { DashboardGroup } from "@/types/dashboard";
import { isUnavailableProjection } from "../../utils/dashboard-groups";
import { resolveFieldLabel } from "../../utils/dashboard-copy";
import { formatVisualValue } from "./visual-format";
import { unitOf } from "./infer-visuals";

interface BooleanCopy {
  yes: string;
  no: string;
}

/** Carried through the walk so every path segment resolves in one language. */
interface Naming {
  lang: Language;
  t: Dictionary;
}

interface ExactValueRow {
  key: string;
  section: string;
  field: string;
  value: string;
}

/**
 * One collapsed table per tab, in place of the ~150 bordered key-value tiles
 * the panel used to print. Charts carry the reading; this carries the
 * evidence — the design system's chart contract requires exact values to be
 * reachable without hover, and the print path reads this same markup.
 */
export function GroupExactValues({ group }: { group: DashboardGroup }) {
  const { t, lang } = useI18n();
  const copy = t.dashboard.visuals;

  if (!group.available) return null;

  const booleans: BooleanCopy = { yes: t.dashboard.yesLabel, no: t.dashboard.noLabel };
  const naming: Naming = { lang, t };
  const rows: ExactValueRow[] = [
    ...flatten(group.snapshot, copy.snapshotGroup, booleans, naming),
    ...flatten(group.period, copy.periodGroup, booleans, naming),
    ...flatten(group.breakdowns, copy.breakdownGroup, booleans, naming),
  ];

  if (rows.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border bg-muted p-4 text-xs text-muted-foreground">
        {t.dashboard.noAdditionalValues}
      </p>
    );
  }

  return (
    <details className="rounded-lg border border-border bg-card">
      <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-3 px-4 text-sm font-semibold text-foreground">
        <span>{copy.allValuesTitle}</span>
        <span className="font-mono text-xs font-normal text-muted-foreground">
          {rows.length}
        </span>
      </summary>
      <div className="border-t border-border px-4 pb-2 pt-3">
        <p className="mb-3 text-xs text-muted-foreground">{copy.allValuesSubtitle}</p>
        <div
          role="region"
          aria-label={copy.allValuesTitle}
          tabIndex={0}
          className="max-h-96 overflow-auto rounded-md border border-border outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        >
          <Table className="min-w-max border-collapse text-xs">
            <TableCaption className="sr-only">{copy.allValuesSubtitle}</TableCaption>
            <TableHeader className="sticky top-0 bg-muted text-muted-foreground">
              <TableRow className="hover:bg-transparent">
                <TableHead scope="col" className="px-3 py-2 text-start font-semibold">
                  {copy.groupColumn}
                </TableHead>
                <TableHead scope="col" className="px-3 py-2 text-start font-semibold">
                  {copy.fieldColumn}
                </TableHead>
                <TableHead scope="col" className="px-3 py-2 text-end font-semibold">
                  {copy.valueColumn}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-border bg-card text-foreground">
              {rows.map((row) => (
                <TableRow key={row.key} className="hover:bg-transparent">
                  <TableCell className="px-3 py-2 text-start text-muted-foreground">
                    {row.section}
                  </TableCell>
                  <TableCell className="px-3 py-2 text-start">{row.field}</TableCell>
                  <TableCell
                    className="px-3 py-2 text-end font-mono tabular-nums"
                    dir="auto"
                  >
                    {row.value}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </details>
  );
}

/** Depth-first over the bag, joining nested keys with a middle dot. */
function flatten(
  bag: Record<string, unknown>,
  section: string,
  booleans: BooleanCopy,
  naming: Naming,
  path: string[] = [],
): ExactValueRow[] {
  return Object.entries(bag).flatMap(([field, value]) => {
    const trail = [...path, field];
    const id = `${section}.${trail.join(".")}`;
    const label = resolveFieldLabel(trail, naming.lang, naming.t);

    if (isUnavailableProjection(value)) {
      return [{ key: id, section, field: label, value: value.reasonCode ?? "—" }];
    }
    if (Array.isArray(value)) {
      return value.flatMap((entry, index) =>
        isRecord(entry)
          ? flatten(entry, section, booleans, naming, [...trail, String(index + 1)])
          : [
              {
                key: `${id}.${index}`,
                section,
                field: `${label} ${index + 1}`,
                value: render(field, entry, naming.lang, booleans),
              },
            ],
      );
    }
    if (isRecord(value)) {
      return flatten(value, section, booleans, naming, trail);
    }
    return [
      {
        key: id,
        section,
        field: label,
        value: render(field, value, naming.lang, booleans),
      },
    ];
  });
}

function render(
  field: string,
  value: unknown,
  lang: "ar" | "en",
  booleans: BooleanCopy,
): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? booleans.yes : booleans.no;
  if (typeof value === "number") return formatVisualValue(lang, value, unitOf(field));
  if (typeof value === "string" && Number.isFinite(Number(value))) {
    return formatVisualValue(lang, Number(value), unitOf(field));
  }
  return String(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
