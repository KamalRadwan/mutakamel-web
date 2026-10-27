"use client";

import { useMemo } from "react";
import { LayoutDashboard, MapPin } from "lucide-react";
import {
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/design-system";
import { useOrgNodeOptions } from "@/app/(tenant)/core/hooks/useCoreOptions";
import { useI18n } from "@/i18n/I18nContext";
import {
  COMPARE_MODES,
  DATE_PRESETS,
  type DashboardFilterSelection,
} from "../../dashboard-run-contract";

interface DashboardFilterBarProps {
  selection: DashboardFilterSelection;
  onChange: (selection: DashboardFilterSelection) => void;
  branchIds: readonly string[];
  currencyCodes: readonly string[];
  disabled: boolean;
  dashboardSwitcher?: {
    value: string;
    options: ReadonlyArray<{ value: string; label: string }>;
    onChange: (nextValue: string) => void;
  };
}

const ANY = "__any__";

export function DashboardFilterBar({
  selection,
  onChange,
  branchIds,
  currencyCodes,
  disabled,
  dashboardSwitcher,
}: DashboardFilterBarProps) {
  const { t } = useI18n();
  const branches = useOrgNodeOptions("branches");

  const branchOptions = useMemo(() => {
    const accessibleSet = new Set(branchIds);
    return branches.options.filter(
      (option) => accessibleSet.has(option.value),
    );
  }, [branchIds, branches.options]);

  const gridColsClass = dashboardSwitcher
    ? "grid grid-cols-1 gap-3 rounded-md border border-border bg-card p-3 sm:grid-cols-2 lg:grid-cols-5"
    : "grid grid-cols-1 gap-3 rounded-md border border-border bg-card p-3 sm:grid-cols-2 lg:grid-cols-4";

  return (
    <div className={gridColsClass}>
      <div className="flex flex-col gap-1">
        <Label htmlFor="dashboard-branch">{t.crmDashboards.branch}</Label>
        <Select
          value={selection.branchId ?? ANY}
          disabled={disabled}
          onValueChange={(next) =>
            onChange({ ...selection, branchId: next === ANY ? null : next })
          }
        >
          <SelectTrigger size="sm" id="dashboard-branch">
            <span className="flex min-w-0 items-center gap-1.5 truncate">
              <MapPin className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <SelectValue />
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>{t.crmDashboards.allBranches}</SelectItem>
            {branchOptions.map((branch) => (
              <SelectItem key={branch.value} value={branch.value}>
                {branch.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {dashboardSwitcher ? (
        <div className="flex flex-col gap-1">
          <Label htmlFor="dashboard-switcher-select">{t.crmDashboards.switchDashboard}</Label>
          <Select
            value={dashboardSwitcher.value}
            disabled={disabled}
            onValueChange={dashboardSwitcher.onChange}
          >
            <SelectTrigger size="sm" id="dashboard-switcher-select">
              <span className="flex min-w-0 items-center gap-1.5 truncate">
                <LayoutDashboard
                  className="size-3.5 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                <SelectValue />
              </span>
            </SelectTrigger>
            <SelectContent>
              {dashboardSwitcher.options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      <div className="flex flex-col gap-1">
        <Label htmlFor="dashboard-date-preset">{t.crmDashboards.datePreset}</Label>
        <Select
          value={selection.datePreset ?? ANY}
          disabled={disabled}
          onValueChange={(next) =>
            onChange({
              ...selection,
              datePreset: next === ANY ? null : (next as DashboardFilterSelection["datePreset"]),
            })
          }
        >
          <SelectTrigger size="sm" id="dashboard-date-preset">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>{t.crmDashboards.dashboardDefault}</SelectItem>
            {DATE_PRESETS.map((preset) => (
              <SelectItem key={preset} value={preset}>
                {t.crmDashboards.datePresets[preset]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="dashboard-compare">{t.crmDashboards.compare}</Label>
        <Select
          value={selection.compare ?? ANY}
          disabled={disabled}
          onValueChange={(next) =>
            onChange({
              ...selection,
              compare: next === ANY ? null : (next as DashboardFilterSelection["compare"]),
            })
          }
        >
          <SelectTrigger size="sm" id="dashboard-compare">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>{t.crmDashboards.dashboardDefault}</SelectItem>
            {COMPARE_MODES.map((mode) => (
              <SelectItem key={mode} value={mode}>
                {t.crmDashboards.compareModes[mode]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="dashboard-currency">{t.crmDashboards.currency}</Label>
        <Select
          value={selection.currencyCode ?? ANY}
          disabled={disabled}
          onValueChange={(next) =>
            onChange({ ...selection, currencyCode: next === ANY ? null : next })
          }
        >
          <SelectTrigger size="sm" id="dashboard-currency">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>{t.crmDashboards.allCurrencies}</SelectItem>
            {currencyCodes.map((code) => (
              <SelectItem key={code} value={code}>
                {code}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
