"use client";

import {
  Field,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { tradeStatusValues, type TradeStatusKind } from "../trade-document-status";

export interface TradeDocumentFiltersProps {
  kind: TradeStatusKind;
  value: string;
  onChange: (status: string) => void;
}

/** The sentinel for "no status filter" — `Select` cannot carry an empty value. */
const ANY_STATUS = "__any__";

/**
 * The only filter a commercial-document list has.
 *
 * `DocumentListQueryDto` reads `page`, `limit`, `status` and `partyId` and
 * nothing else — no search, no sort, no date range on any of the six list
 * routes. `FilterBar` is deliberately not used here: it always renders a
 * search input, and a search box over a route with no search parameter is a
 * control that silently does nothing.
 *
 * `partyId` is a UUID rather than a name and there is no party picker in Phase
 * 11's scope, so it is not offered either — a raw-UUID text box is not a filter
 * a person can use.
 */
export function TradeDocumentFilters({ kind, value, onChange }: TradeDocumentFiltersProps) {
  const { t } = useI18n();

  return (
    <div className="max-w-xs">
      <Field label={t.common.status}>
        <Select
          value={value === "" ? ANY_STATUS : value}
          onValueChange={(next) => onChange(next === ANY_STATUS ? "" : next)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY_STATUS}>{t.tradeDocuments.statusAny}</SelectItem>
            {tradeStatusValues(kind).map((status) => (
              <SelectItem key={status} value={status}>
                {t.statusValues[`${kind}.${status}`] ?? status}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
    </div>
  );
}
