"use client";

import {
  Button,
  DateTime,
  ErrorState,
  Money,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  Skeleton,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatNumber } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import type { NormalizedApiError } from "@/lib/api/errors";
import { DRILLDOWN_FIELDS, type DrilldownRecord } from "../../dashboard-run-contract";
import type { DrilldownState } from "../hooks/useWidgetDrilldown";

interface DrilldownSheetProps {
  target: DrilldownState | null;
  records: DrilldownRecord[];
  hasMore: boolean;
  isLoading: boolean;
  error: NormalizedApiError | null;
  onLoadMore: () => void;
  onClose: () => void;
}

/** The two fields that are an instant, and the two that are money. */
const INSTANT_FIELDS = new Set(["occurredAt", "createdAt", "updatedAt", "dueAt", "closedAt", "convertedAt"]);
const MONEY_FIELD = "amount";

/**
 * The records behind one plotted point.
 *
 * The response is **cursor**-paged, never page-numbered: `pageInfo` carries
 * `hasMore` and an opaque `nextCursor` and no total, so this offers a
 * load-more rather than a fabricated pager
 * (docs/design/states.md#pagination-is-real-or-absent).
 */
export function DrilldownSheet({
  target,
  records,
  hasMore,
  isLoading,
  error,
  onLoadMore,
  onClose,
}: DrilldownSheetProps) {
  const { t, lang } = useI18n();

  return (
    <Sheet
      open={target !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent className="sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{t.crmDashboards.drilldownTitle}</SheetTitle>
          <SheetDescription>
            {target
              ? formatTemplate(t.crmDashboards.drilldownDescription, {
                  widget: target.widget.name,
                  point: target.pointLabel,
                })
              : ""}
          </SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
          {error ? (
            <ErrorState
              title={t.crmDashboards.drilldownFailed}
              description={
                t.crmDashboards.errors[error.code ?? ""] ?? t.crmDashboards.actionFailed
              }
            />
          ) : null}

          {isLoading && records.length === 0 ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : null}

          {!isLoading && !error && records.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">
              {t.crmDashboards.drilldownEmpty}
            </p>
          ) : null}

          <ul className="flex flex-col gap-1.5">
            {records.map((record) => (
              <li key={record.id} className="rounded-sm border border-border bg-card p-2.5">
                <dl className="grid grid-cols-2 gap-x-3 gap-y-1">
                  {DRILLDOWN_FIELDS.filter(
                    (field) => field !== "id" && record.fields[field] !== undefined && record.fields[field] !== null,
                  ).map((field) => {
                    const value = record.fields[field];
                    return (
                      <div key={field} className="min-w-0">
                        <dt className="truncate text-2xs text-muted-foreground">
                          {t.crmDashboards.drilldownFields[field]}
                        </dt>
                        <dd className="truncate text-xs text-foreground">
                          {typeof value === "string" && INSTANT_FIELDS.has(field) ? (
                            <DateTime value={value} />
                          ) : field === MONEY_FIELD && typeof value === "number" ? (
                            <Money
                              value={String(value)}
                              currency={
                                typeof record.fields.currencyCode === "string"
                                  ? record.fields.currencyCode
                                  : undefined
                              }
                            />
                          ) : typeof value === "number" ? (
                            formatNumber(value, lang)
                          ) : (
                            String(value)
                          )}
                        </dd>
                      </div>
                    );
                  })}
                </dl>
              </li>
            ))}
          </ul>

          {hasMore ? (
            <Button variant="outline" onClick={onLoadMore} disabled={isLoading}>
              {t.timeline.loadMore}
            </Button>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
