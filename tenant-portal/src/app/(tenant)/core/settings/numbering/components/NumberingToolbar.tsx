"use client";

import { RefreshCw, Search, X } from "lucide-react";
import {
  Button,
  Input,
  PageActions,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  iconSize,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import { companyLabel, type CompanyOption } from "../../company-options";
import { useNumberingToolbarSearch } from "../hooks/useNumberingToolbarSearch";

const ALL_COMPANIES_VALUE = "__all_companies__";

interface NumberingToolbarProps {
  readonly companies: readonly CompanyOption[];
  readonly companyFilter: string | undefined;
  readonly onCompanyFilterChange: (next: string | undefined) => void;
  readonly searchValue: string;
  readonly onSearchChange: (next: string) => void;
  readonly hasActiveFilters: boolean;
  readonly onReset: () => void;
  readonly isRefreshing: boolean;
  readonly onReload: () => void;
}

export function NumberingToolbar({
  companies,
  companyFilter,
  onCompanyFilterChange,
  searchValue,
  onSearchChange,
  hasActiveFilters,
  onReset,
  isRefreshing,
  onReload,
}: NumberingToolbarProps) {
  const { t, dir } = useI18n();
  const { localSearch, handleSearchInput, clearSearch, handleReset } = useNumberingToolbarSearch({
    searchValue,
    onSearchChange,
    onReset,
  });

  const hasMissingSelectedCompany =
    Boolean(companyFilter) && !companies.some((company) => company.id === companyFilter);

  return (
    <PageActions slot="actions">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex items-center">
          <Search
            className="pointer-events-none absolute start-2.5 size-3.5 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            size="sm"
            value={localSearch}
            onChange={(event) => handleSearchInput(event.target.value)}
            placeholder={t.coreSettings.numberingSearch}
            aria-label={t.coreSettings.numberingSearch}
            className="w-56 ps-8 pe-7"
          />
          {localSearch.length > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              aria-label={formatTemplate(t.filters.remove, {
                label: t.coreSettings.numberingSearch,
              })}
              onClick={clearSearch}
              className="absolute end-1.5 size-5 p-0 text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" aria-hidden="true" />
            </Button>
          ) : null}
        </div>

        <Select
          dir={dir}
          value={companyFilter ?? ALL_COMPANIES_VALUE}
          onValueChange={(next) =>
            onCompanyFilterChange(next === ALL_COMPANIES_VALUE ? undefined : next)
          }
          disabled={companies.length === 0 && !companyFilter}
        >
          <SelectTrigger textSize="compact"
            size="sm"
            aria-label={t.coreIdentity.cascade.company}
            className="w-44 max-w-52"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent textSize="compact">
            <SelectItem value={ALL_COMPANIES_VALUE}>
              {t.coreIdentity.filters.allCompanies}
            </SelectItem>
            {hasMissingSelectedCompany && companyFilter ? (
              <SelectItem value={companyFilter}>
                {companyLabel(
                  companies,
                  companyFilter,
                  t.coreSettings.numberingTenantWide,
                  t.coreSettings.unknownCompany,
                )}
              </SelectItem>
            ) : null}
            {companies.map((company) => (
              <SelectItem key={company.id} value={company.id}>
                {companyLabel(
                  companies,
                  company.id,
                  t.coreSettings.numberingTenantWide,
                  t.coreSettings.unknownCompany,
                )}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasActiveFilters ? (
          <Button type="button" variant="ghost" size="sm" onClick={handleReset}>
            <X className={iconSize({ size: "xs" })} aria-hidden="true" />
            {t.coreSettings.clearFilters}
          </Button>
        ) : null}

        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onReload}
          disabled={isRefreshing}
        >
          <RefreshCw
            className={isRefreshing ? "size-4 animate-spin" : "size-4"}
            aria-hidden="true"
          />
          {t.coreSettings.reload}
        </Button>
      </div>
    </PageActions>
  );
}
