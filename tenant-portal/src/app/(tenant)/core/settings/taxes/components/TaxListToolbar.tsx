"use client";

import { Lock, Search } from "lucide-react";
import {
  Badge,
  Button,
  Field,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  cn,
  iconSize,
} from "@/design-system";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import type { ActiveStatus } from "../../../core-validation";
import type { CompanyOption } from "../../company-options";

const ALL_FILTER_VALUE = "__filter_all__";

export interface TaxListToolbarProps {
  t: Dictionary;
  search: string;
  statusFilter: ActiveStatus | undefined;
  companyFilter: string | undefined;
  isScopeSelectOpen: boolean;
  inclusiveFilter: boolean | undefined;
  companies: readonly CompanyOption[];
  hasActiveFilters: boolean;
  isPermissionReadOnly: boolean;
  onSearchChange: (next: string) => void;
  onStatusFilterChange: (next: ActiveStatus | undefined) => void;
  onCompanyFilterChange: (next: string | undefined) => void;
  onScopeSelectOpenChange: (open: boolean) => void;
  onInclusiveFilterChange: (next: boolean | undefined) => void;
  onClearFilters: () => void;
}

export function TaxListToolbar({
  t,
  search,
  statusFilter,
  companyFilter,
  isScopeSelectOpen,
  inclusiveFilter,
  companies,
  hasActiveFilters,
  isPermissionReadOnly,
  onSearchChange,
  onStatusFilterChange,
  onCompanyFilterChange,
  onScopeSelectOpenChange,
  onInclusiveFilterChange,
  onClearFilters,
}: TaxListToolbarProps) {
  const selectedCompany = companyFilter
    ? companies.find((company) => company.id === companyFilter)
    : undefined;
  const renderedCompanies = isScopeSelectOpen
    ? companies
    : selectedCompany
      ? [selectedCompany]
      : [];
  return (
    <div className="flex flex-wrap items-end gap-3 border-b border-border px-4 py-3">
      <div className="min-w-56 flex-1">
        <Field label={t.coreSettings.taxSearch}>
          <div
            className={cn(
              "flex h-(--size-control-sm) items-center gap-2 rounded-md border border-input bg-surface-subtle px-2.5",
              "focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20",
            )}
          >
            <Search
              className={cn(iconSize({ size: "sm" }), "shrink-0 text-muted-foreground")}
              aria-hidden="true"
            />
            <Input
              size="sm"
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder={t.coreSettings.taxSearch}
              className="h-full min-w-0 flex-1 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          </div>
        </Field>
      </div>

      <div className="w-full sm:w-44">
        <Field showLabel label={t.coreSettings.taxCompany}>
          <Select
            value={companyFilter ?? ALL_FILTER_VALUE}
            open={isScopeSelectOpen}
            onOpenChange={onScopeSelectOpenChange}
            onValueChange={(next) =>
              onCompanyFilterChange(next === ALL_FILTER_VALUE ? undefined : next)
            }
            disabled={companies.length === 0 && !companyFilter}
          >
            <SelectTrigger textSize="compact" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent textSize="compact">
              <SelectItem value={ALL_FILTER_VALUE}>{t.coreIdentity.filters.allCompanies}</SelectItem>
              {renderedCompanies.map((company) => (
                <SelectItem key={company.id} value={company.id}>
                  {company.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <div className="w-full sm:w-40">
        <Field showLabel label={t.common.status}>
          <Select
            value={statusFilter ?? ALL_FILTER_VALUE}
            onValueChange={(next) =>
              onStatusFilterChange(next === ALL_FILTER_VALUE ? undefined : (next as ActiveStatus))
            }
          >
            <SelectTrigger size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_FILTER_VALUE}>{t.coreSettings.statusAny}</SelectItem>
              <SelectItem value="ACTIVE">{t.common.active}</SelectItem>
              <SelectItem value="INACTIVE">{t.common.inactive}</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>

      <div className="w-full sm:w-40">
        <Field showLabel label={t.coreSettings.taxInclusive}>
          <Select
            value={inclusiveFilter === undefined ? ALL_FILTER_VALUE : String(inclusiveFilter)}
            onValueChange={(next) =>
              onInclusiveFilterChange(next === ALL_FILTER_VALUE ? undefined : next === "true")
            }
          >
            <SelectTrigger size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_FILTER_VALUE}>{t.audit.filters.all}</SelectItem>
              <SelectItem value="true">{t.coreSettings.taxInclusiveYes}</SelectItem>
              <SelectItem value="false">{t.coreSettings.taxInclusiveNo}</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>

      {hasActiveFilters ? (
        <Button variant="ghost" size="sm" onClick={onClearFilters}>
          {t.coreSettings.clearFilters}
        </Button>
      ) : null}

      {isPermissionReadOnly ? (
        <Badge size="sm" tone="neutral" role="status" className="ms-auto">
          <Lock className={iconSize({ size: "xs" })} aria-hidden="true" />
          <span>{t.common.readOnly}</span>
        </Badge>
      ) : null}
    </div>
  );
}
