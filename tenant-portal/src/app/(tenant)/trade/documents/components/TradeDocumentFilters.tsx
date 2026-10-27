"use client";

import { Search, X } from "lucide-react";
import {
  Button,
  Input,
  PageActions,
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
  partyId?: string;
  onPartyIdChange?: (partyId: string) => void;
}

/** The sentinel for "no status filter" — `Select` cannot carry an empty value. */
const ANY_STATUS = "__any__";

/**
 * Filter bar for commercial-document lists (`status` and `partyId`).
 */
export function TradeDocumentFilters({
  kind,
  value,
  onChange,
  partyId = "",
  onPartyIdChange,
}: TradeDocumentFiltersProps) {
  const { t } = useI18n();

  return (
    <PageActions slot="actions">
      <div className="flex flex-wrap items-center gap-2">
        {onPartyIdChange && (
          <div className="relative flex items-center">
            <Search
              className="pointer-events-none absolute start-2.5 size-3.5 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              type="search"
              dir="ltr"
              value={partyId}
              onChange={(event) => onPartyIdChange(event.target.value)}
              placeholder={t.common.search}
              aria-label={t.common.search}
              data-testid="trade-party-search-input"
              className="h-8 w-64 ps-8 pe-7 font-mono text-xs"
            />
            {partyId && (
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={() => onPartyIdChange("")}
                aria-label={t.crmOpportunities.basicSearch.clear}
                className="absolute end-1.5 size-5 p-0 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" aria-hidden="true" />
              </Button>
            )}
          </div>
        )}
        <Select
          value={value === "" ? ANY_STATUS : value}
          onValueChange={(next) => onChange(next === ANY_STATUS ? "" : next)}
        >
          <SelectTrigger size="sm" aria-label={t.common.status} className="w-44">
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
      </div>
    </PageActions>
  );
}
